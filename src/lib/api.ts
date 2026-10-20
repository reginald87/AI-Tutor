"use client";

export async function apiFetch<T = any>(
  url: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || "Request failed") as Error & { status?: number; data?: any };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export const apiGet = <T = any>(url: string) => apiFetch<T>(url);
export const apiPost = <T = any>(url: string, body?: unknown) => apiFetch<T>(url, { method: "POST", body });
export const apiPatch = <T = any>(url: string, body?: unknown) => apiFetch<T>(url, { method: "PATCH", body });
export const apiDelete = <T = any>(url: string) => apiFetch<T>(url, { method: "DELETE" });

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls `poll` every `intervalMs` until it returns true. Used after an async
 * generation request so the UI can wait for the result without holding the
 * HTTP request open (proxy/Cloudflare timeouts would otherwise cut it off).
 */
export async function pollUntil(
  poll: () => Promise<boolean>,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<void> {
  const intervalMs = opts.intervalMs ?? 6000;
  const timeoutMs = opts.timeoutMs ?? 9 * 60 * 1000;
  const start = Date.now();
  for (;;) {
    if (await poll()) return;
    if (Date.now() - start >= timeoutMs) {
      throw new Error("Generation is still running. Check back in a minute.");
    }
    await sleep(intervalMs);
  }
}
export const apiUpload = async (url: string, formData: FormData) => {
  const res = await fetch(url, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Upload failed");
  return data;
};
