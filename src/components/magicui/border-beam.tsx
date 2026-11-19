// Adaptado de Magic UI — Border Beam (https://magicui.design/docs/components/border-beam)
import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface BorderBeamProps {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  className?: string;
}

export function BorderBeam({
  size = 120,
  duration = 8,
  delay = 0,
  colorFrom = "#a6ce4c",
  colorTo = "#2e8b50",
  borderWidth = 1.5,
  className,
}: BorderBeamProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent"
      style={{
        borderWidth,
        borderStyle: "solid",
        maskClip: "padding-box, border-box",
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
        maskImage: "linear-gradient(transparent, transparent), linear-gradient(#000, #000)",
        WebkitMaskImage: "linear-gradient(transparent, transparent), linear-gradient(#000, #000)",
      }}
    >
      <motion.div
        className={cn("absolute aspect-square", className)}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
          } as CSSProperties
        }
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: "100%" }}
        transition={{ repeat: Infinity, ease: "linear", duration, delay: -delay }}
      />
    </div>
  );
}
