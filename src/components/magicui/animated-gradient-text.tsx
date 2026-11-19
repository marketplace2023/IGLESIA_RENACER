// Adaptado de Magic UI — Animated Gradient Text
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AnimatedGradientText({
  children,
  className,
  colors = ["#a6ce4c", "#2e8b50", "#6fbf4a", "#2e8b50", "#a6ce4c"],
}: {
  children: ReactNode;
  className?: string;
  colors?: string[];
}) {
  return (
    <span
      style={{ "--bg-size": "300%", backgroundImage: `linear-gradient(90deg, ${colors.join(", ")})` } as CSSProperties}
      className={cn("animate-gradient inline bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent", className)}
    >
      {children}
    </span>
  );
}
