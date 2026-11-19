// Adaptado de Magic UI — Dot Pattern (https://magicui.design/docs/components/dot-pattern)
import { useId } from "react";
import { cn } from "@/lib/utils";

export function DotPattern({ size = 18, radius = 1, className }: { size?: number; radius?: number; className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full fill-foreground/15", className)}>
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <circle cx={size / 2} cy={size / 2} r={radius} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  );
}
