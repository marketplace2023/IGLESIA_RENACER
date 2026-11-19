// Adaptado de Magic UI — Blur Fade
import type { ReactNode } from "react";
import { motion } from "motion/react";

export function BlurFade({
  children,
  delay = 0,
  className,
  y = 8,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay: 0.04 + delay, duration: 0.4, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
