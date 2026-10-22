const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Fecha relativa en hora local: hoy, ayer, día de la semana (últimos 6 días) o "12 oct". */
export function relativeDate(epochMs: number, now: Date = new Date()): string {
  const d = new Date(epochMs);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return WEEKDAYS[d.getDay()];
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** Tiempo transcurrido: "ahora mismo", "hace 30 s", "hace 5 min", "hace 2 h", "hace 3 d". */
export function timeAgo(epochMs: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - epochMs) / 1000));
  if (s < 10) return "ahora mismo";
  if (s < 60) return `hace ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function fullDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString("es", { dateStyle: "long", timeStyle: "short" });
}
