import { getSettings, getActiveModel, getFastModel, OllamaMessage, ChatOptions } from "./ollama";

async function* streamOllama(messages: OllamaMessage[], opts: ChatOptions = {}): AsyncGenerator<string> {
  const { chatStream } = await import("./ollama");
  for await (const chunk of chatStream(messages, opts)) {
    yield chunk;
  }
}

export async function* chatStreamUnified(
  messages: OllamaMessage[],
  opts: ChatOptions & { useFastModel?: boolean } = {}
): AsyncGenerator<string> {
  const settings = await getSettings();
  const provider = (settings as any)?.provider || "ollama";

  if (provider === "ollama") {
    const model = opts.model || (opts.useFastModel ? await getFastModel() : await getActiveModel());
    yield* streamOllama(messages, { ...opts, model });
    return;
  }

  // OpenAI-compatible style for cloud providers if keys present
  if (provider === "openai" && (settings as any)?.openaiApiKey) {
    const apiKey = (settings as any).openaiApiKey;
    const model = opts.model || (settings as any)?.defaultModel || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: opts.temperature ?? 0.7,
      }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip
        }
      }
    }
    return;
  }

  if (provider === "openrouter" && (settings as any)?.openrouterApiKey) {
    const apiKey = (settings as any).openrouterApiKey;
    const model = opts.model || (settings as any)?.defaultModel || "openrouter/auto";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "BMU AI Tutor",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: opts.temperature ?? 0.7,
      }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip
        }
      }
    }
    return;
  }

  if (provider === "deepseek" && (settings as any)?.deepseekApiKey) {
    const apiKey = (settings as any).deepseekApiKey;
    const model = opts.model || (settings as any)?.defaultModel || "deepseek-chat";
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: opts.temperature ?? 0.7,
      }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`DeepSeek request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip
        }
      }
    }
    return;
  }

  if (provider === "custom" && (settings as any)?.customApiBase && (settings as any)?.customApiKey) {
    const apiKey = (settings as any).customApiKey;
    const base = (settings as any).customApiBase.replace(/\/$/, "");
    const model = opts.model || (settings as any)?.customModel || (settings as any)?.defaultModel || "gpt-4o-mini";
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: opts.temperature ?? 0.7,
      }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`Custom API request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip
        }
      }
    }
    return;
  }

  // Fallback to ollama
  const model = opts.model || (opts.useFastModel ? await getFastModel() : await getActiveModel());
  yield* streamOllama(messages, { ...opts, model });
}

export async function* chatStream(...args: any[]): AsyncGenerator<string> {
  // @ts-ignore
  return chatStreamUnified(args[0], args[1]);
}
