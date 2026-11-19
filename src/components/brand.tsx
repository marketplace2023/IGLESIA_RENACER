import { cn } from "@/lib/utils";

export const LOGO_URL = "/assets/logo.jpeg";
export const BANNER_URL = "/assets/banner.jpeg";

/** Logo de la iglesia sobre una baldosa blanca (el archivo tiene fondo blanco). */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md ring-1 shadow-green-900/15 ring-black/5",
        className,
      )}
    >
      <img src={LOGO_URL} alt="Logo de la iglesia" className="size-full scale-[1.12] object-contain" draggable={false} />
    </span>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <div className="leading-tight">
        <p className="font-semibold tracking-tight">Renacer</p>
        <p className="text-[11px] text-muted-foreground">Registro y seguimiento</p>
      </div>
    </div>
  );
}

/** Franja con el banner de la iglesia que se funde con el fondo. */
export function BannerStrip({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-40 overflow-hidden rounded-3xl border sm:h-56", className)}>
      <img src={BANNER_URL} alt="" className="size-full object-cover object-[center_20%]" draggable={false} />
      <div className="absolute inset-0 bg-linear-to-t from-background via-background/10 to-transparent" />
    </div>
  );
}
