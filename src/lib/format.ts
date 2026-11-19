/** Fecha local en formato YYYY-MM-DD */
export function hoyISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parse(fecha: string) {
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const fmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
const fmtLargo = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function fecha(f: string | null | undefined) {
  return f ? fmt.format(parse(f)) : "—";
}
export function fechaLarga(f: string) {
  return fmtLargo.format(parse(f));
}

export function diasDesde(f: string) {
  const ms = parse(hoyISO()).getTime() - parse(f).getTime();
  return Math.round(ms / 86_400_000);
}

export function hace(f: string | null | undefined) {
  if (!f) return "Nunca";
  const d = diasDesde(f);
  if (d <= 0) return "Hoy";
  if (d === 1) return "Ayer";
  if (d < 30) return `Hace ${d} días`;
  const m = Math.floor(d / 30);
  if (m < 12) return m === 1 ? "Hace 1 mes" : `Hace ${m} meses`;
  const a = Math.floor(m / 12);
  return a === 1 ? "Hace 1 año" : `Hace ${a} años`;
}

export function iniciales(nombre: string, apellido = "") {
  const a = nombre.trim()[0] ?? "";
  const b = (apellido.trim() || nombre.trim().split(/\s+/)[1] || "")[0] ?? "";
  return (a + b).toUpperCase();
}

/** Link de WhatsApp a partir de un teléfono (solo dígitos). */
export function waLink(tel: string) {
  return `https://wa.me/${tel.replace(/\D/g, "")}`;
}
export function telLink(tel: string) {
  return `tel:${tel.replace(/[^\d+]/g, "")}`;
}
