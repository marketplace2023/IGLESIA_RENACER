import { hoyISO } from "./format";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  // "hoy" según el navegador: el servidor (Netlify) trabaja en UTC
  const conHoy = `${url}${url.includes("?") ? "&" : "?"}hoy=${hoyISO()}`;
  try {
    res = await fetch(`/api${conHoy}`, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. Revisa tu conexión.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith("/auth/")) window.dispatchEvent(new Event("auth:expired"));
    throw new ApiError(res.status, data?.error ?? "Ocurrió un error inesperado");
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body ?? {}),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body ?? {}),
  del: <T>(url: string) => request<T>("DELETE", url),
};

export const errorMsg = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error inesperado");
