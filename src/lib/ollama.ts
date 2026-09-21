import { prisma } from "./prisma";
import { CONFIG } from "./config";

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
}

export async function getActiveModel(): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { id: "global" } });
  return s?.defaultModel || CONFIG.ollamaModel;
}

export async function ollamaHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${CONFIG.ollamaHost}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Streams assistant text tokens from Ollama's /api/chat endpoint.
 */
export async function* chatStream(
  messages: OllamaMessage[],
  opts: ChatOptions = {}
): AsyncGenerator<string> {
  const model = opts.model || (await getActiveModel());
  const host = CONFIG.ollamaHost;

  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      // Keep the model resident so the next request doesn't pay the load penalty.
      keep_alive: 1800,
      options: { temperature: opts.temperature ?? 0.7, num_ctx: 4096, num_predict: 1024 },
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      try {
        const json = JSON.parse(line);
        if (json.message?.content) yield json.message.content as string;
        if (json.done) return;
      } catch {
        // partial JSON line; ignore and continue
      }
    }
  }
}

/**
 * Non-streaming completion used for structured output (e.g. quiz JSON).
 */
export async function generate(
  prompt: string,
  opts: ChatOptions & { system?: string } = {}
): Promise<string> {
  const model = opts.model || (await getActiveModel());
  const res = await fetch(`${CONFIG.ollamaHost}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      system: opts.system,
      stream: false,
      format: "json",
      // Keep the model resident; model load is the biggest cost on small VPS CPUs.
      keep_alive: 1800,
      options: { temperature: opts.temperature ?? 0.4, num_ctx: 6144, num_predict: 2048 },
    }),
    // Fail with a clear error instead of hanging forever. 240s < nginx's 300s
    // proxy_read_timeout, so nginx won't 504 before this fires.
    signal: opts.signal ?? AbortSignal.timeout(240_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.response as string) || "";
}

/**
 * Strips markdown code fences and parses the first JSON object found.
 */
export function parseJsonBlock<T = unknown>(raw: string): T {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Fallback: extract the outermost { ... } block.
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
  }
  return JSON.parse(text) as T;
}
