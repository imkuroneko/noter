export const MIN_PASSWORD = 8;

export const TOO_SHORT = "La contraseña debe tener al menos 8 caracteres.";
export const MISMATCH = "Las contraseñas no coinciden.";

/** Valida una contraseña nueva y su repetición; devuelve el mensaje de error o null. El backend es la autoridad. */
export function validateNewPassword(password: string, repeat: string): string | null {
  if ([...password].length < MIN_PASSWORD) return TOO_SHORT;
  if (password !== repeat) return MISMATCH;
  return null;
}
