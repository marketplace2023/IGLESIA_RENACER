import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ESTADO_LABEL, ETAPA_LABEL, ORIGEN_LABEL, type Estado, type Etapa, type Origen } from "@/lib/types";

const tones = {
  neutral: "bg-muted text-muted-foreground ring-border",
  primary: "bg-primary/12 text-primary ring-primary/25",
  success: "bg-success/12 text-success ring-success/25",
  info: "bg-info/12 text-info ring-info/25",
  warning: "bg-warning/14 text-warning ring-warning/30",
  danger: "bg-destructive/12 text-destructive ring-destructive/25",
};

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const estadoTone: Record<Estado, Tone> = { nuevo: "primary", en_seguimiento: "info", integrado: "success", inactivo: "neutral" };

/** Estado; si es "Integrado" muestra la etapa (p. ej. "Integrado · En Consolidación"). */
export function EstadoBadge({ estado, etapa }: { estado: Estado; etapa?: Etapa | null }) {
  return (
    <Badge tone={estadoTone[estado]}>
      {ESTADO_LABEL[estado]}
      {estado === "integrado" && etapa && <span className="font-normal opacity-85">· {ETAPA_LABEL[etapa]}</span>}
    </Badge>
  );
}

export function OrigenBadge({ origen }: { origen: Origen }) {
  return <Badge tone={origen === "evangelismo" ? "warning" : "info"}>{ORIGEN_LABEL[origen]}</Badge>;
}
