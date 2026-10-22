import type { ApiError } from "./types";

function isApiError(e: unknown): e is ApiError {
  return typeof e === "object" && e !== null && "code" in e;
}

/** Texto para mostrar: el mensaje de 'Invalid' tal cual; genérico para el resto. */
export function describeError(e: unknown): string {
  if (isApiError(e)) {
    if (e.code === "Invalid" && e.message) return e.message;
    if (e.code === "NotFound") return "No se encontró lo que buscabas. Puede que ya no exista.";
  }
  return "Algo salió mal. Inténtalo de nuevo.";
}
