// Adaptado de Magic UI — Shimmer Button (https://magicui.design/docs/components/shimmer-button)
import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
}

export function ShimmerButton({
  shimmerColor = "#e6f7b5",
  shimmerSize = "0.06em",
  shimmerDuration = "3s",
  borderRadius = "12px",
  background = "linear-gradient(135deg, #1d6f3e, #3f9a45 60%, #7fb93f)",
  className,
  children,
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      style={
        {
          "--spread": "90deg",
          "--shimmer-color": shimmerColor,
          "--radius": borderRadius,
          "--speed": shimmerDuration,
          "--cut": shimmerSize,
          "--bg": background,
        } as CSSProperties
      }
      className={cn(
        "group relative z-0 flex cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap border border-white/15 px-6 py-3 font-medium text-white",
        "[background:var(--bg)] [border-radius:var(--radius)]",
        "transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
      {...props}
    >
      {/* chispa */}
      <div className="absolute inset-0 -z-30 overflow-visible blur-[2px] [container-type:size]">
        <div className="animate-shimmer-slide absolute inset-0 aspect-square h-[100cqh] rounded-none [mask:none]">
          <div className="animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>
      {children}
      {/* brillo interno */}
      <div className="absolute inset-0 size-full rounded-[var(--radius)] shadow-[inset_0_-8px_10px_#ffffff1f] transition-all duration-300 group-hover:shadow-[inset_0_-6px_10px_#ffffff3f] group-active:shadow-[inset_0_-10px_10px_#ffffff3f]" />
      {/* fondo */}
      <div className="absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]" />
    </button>
  );
}
