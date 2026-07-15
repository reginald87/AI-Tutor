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
export const apiUpload = async (url: string, formData: FormData) => {
  const res = await fetch(url, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Upload failed");
  return data;
};
