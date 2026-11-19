// Adaptado de Magic UI — Number Ticker (https://magicui.design/docs/components/number-ticker)
import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("es");

export function NumberTicker({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const inView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(
    () =>
      spring.on("change", (v) => {
        if (ref.current) ref.current.textContent = nf.format(Math.round(v));
      }),
    [spring],
  );

  return (
    <span ref={ref} className={cn("inline-block tabular-nums tracking-tight", className)}>
      0
    </span>
  );
}
