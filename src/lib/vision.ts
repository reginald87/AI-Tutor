import { prisma } from "./prisma";
import { CONFIG } from "./config";

export interface VisionResult {
  text: string;
}

/**
 * Describes an image (e.g. a whiteboard or diagram photo) using a
 * vision-capable Ollama model. Falls back to the model configured in
 * Settings.visionModel, then CONFIG (none by default). Returns null when no
 * vision model is configured so callers can surface a friendly message.
 */
export async function describeImage(
  base64: string,
  prompt: string,
  opts: { signal?: AbortSignal } = {}
): Promise<VisionResult | null> {
  const setting = await prisma.setting.findUnique({ where: { id: "global" } });
  const model = setting?.visionModel;
  if (!model) return null;

  const res = await fetch(`${CONFIG.ollamaHost}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
          images: [base64],
        },
      ],
      stream: false,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vision model request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data?.message?.content as string) || "";
  return { text };
}
