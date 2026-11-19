// Adaptado de Aceternity UI — Input / Card Spotlight: un brillo radial que sigue al mouse.
import { useState, type MouseEvent, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";

/** Envoltura para inputs: el borde se ilumina donde está el mouse. */
export function GlowField({ children, className }: { children: ReactNode; className?: string }) {
  const [visible, setVisible] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const radius = visible ? 110 : 0;
  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${x}px ${y}px, var(--color-primary), transparent 80%)`;

  function onMove({ currentTarget, clientX, clientY }: MouseEvent<HTMLDivElement>) {
    const r = currentTarget.getBoundingClientRect();
    x.set(clientX - r.left);
    y.set(clientY - r.top);
  }

  return (
    <motion.div
      style={{ background }}
      onMouseMove={onMove}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      className={cn("group/input rounded-[calc(var(--radius)+2px)] p-[1.5px] transition duration-300", className)}
    >
      {children}
    </motion.div>
  );
}

/** Tarjeta con un halo de luz que sigue al mouse. */
export function GlowCard({
  children,
  className,
  color = "color-mix(in oklch, var(--color-primary) 18%, transparent)",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  const x = useMotionValue(-500);
  const y = useMotionValue(-500);
  const background = useMotionTemplate`radial-gradient(320px circle at ${x}px ${y}px, ${color}, transparent 75%)`;

  return (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      onMouseLeave={() => {
        x.set(-500);
        y.set(-500);
      }}
      className={cn("group/card relative overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xs", className)}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
        style={{ background }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
