// Adaptado de Aceternity UI — Meteors (https://ui.aceternity.com/components/meteors)
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// Pseudoaleatorio determinista para que el render sea puro.
const rand = (i: number, seed: number) => {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function Meteors({ number = 14, className }: { number?: number; className?: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: number }, (_, i) => (
        <span
          key={i}
          className={cn(
            "animate-meteor absolute size-0.5 rotate-[215deg] rounded-full bg-lime-200 shadow-[0_0_0_1px_#ffffff10]",
            "before:absolute before:top-1/2 before:h-px before:w-[60px] before:-translate-y-1/2 before:bg-linear-to-r before:from-lime-300/80 before:to-transparent before:content-['']",
            className,
          )}
          style={
            {
              top: `${-5 + rand(i, 1) * 40}%`,
              left: `${rand(i, 2) * 110}%`,
              animationDelay: `${(rand(i, 3) * 6).toFixed(2)}s`,
              animationDuration: `${(4 + rand(i, 4) * 6).toFixed(2)}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
