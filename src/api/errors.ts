import type { ApiError } from "./types";

export function isApiError(e: unknown): e is ApiError {
  return typeof e === "object" && e !== null && "code" in e;
}

/** Segundos de espera si el error es Throttled; null en otro caso. */
export function throttleSeconds(e: unknown): number | null {
  if (isApiError(e) && e.code === "Throttled") {
    const n = Number(e.message);
    return Number.isFinite(n) && n > 0 ? Math.ceil(n) : 1;
  }
  return null;
}

/** Texto para mostrar: el mensaje de 'Invalid' tal cual; genérico (sin detalles) para el resto. */
export function describeError(e: unknown): string {
  if (isApiError(e)) {
    if (e.code === "Invalid" && e.message) return String(e.message);
    if (e.code === "NotFound") return "No se encontró lo que buscabas. Puede que ya no exista.";
    if (e.code === "BadPassword") return "Contraseña incorrecta.";
    if (e.code === "Throttled") return `Demasiados intentos. Espera ${throttleSeconds(e)} s.`;
    if (e.code === "Locked") return "La bóveda está bloqueada.";
  }
  return "Algo salió mal. Inténtalo de nuevo.";
}
