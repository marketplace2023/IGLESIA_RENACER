import { cn } from "@/lib/utils";
import { iniciales } from "@/lib/format";

const palette = [
  "from-emerald-400 to-green-700",
  "from-rose-400 to-pink-600",
  "from-sky-400 to-indigo-600",
  "from-emerald-400 to-teal-600",
  "from-violet-400 to-purple-600",
  "from-amber-400 to-orange-500",
];

export function Avatar({ nombre, apellido = "", className }: { nombre: string; apellido?: string; className?: string }) {
  const n = [...(nombre + apellido)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-xs font-semibold text-white shadow-sm",
        palette[n % palette.length],
        className,
      )}
    >
      {iniciales(nombre, apellido)}
    </span>
  );
}
