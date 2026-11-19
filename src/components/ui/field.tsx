import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { GlowField } from "@/components/aceternity/glow";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-[var(--radius)] border-none bg-secondary px-3 text-sm text-foreground shadow-[inset_0_0_0_1px_var(--color-input)] outline-none transition " +
  "placeholder:text-muted-foreground/70 focus-visible:shadow-[inset_0_0_0_1px_var(--color-ring),0_0_0_3px_color-mix(in_oklch,var(--color-ring)_30%,transparent)] " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <GlowField>
      <input className={cn(control, "h-10", className)} {...props} />
    </GlowField>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <GlowField>
      <textarea className={cn(control, "min-h-24 resize-y py-2.5", className)} {...props} />
    </GlowField>
  );
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <GlowField>
      <div className="relative">
        <select className={cn(control, "h-10 cursor-pointer appearance-none pr-9", className)} {...props}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </GlowField>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-medium text-foreground/85", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Interruptor sí/no accesible (role="switch"). */
export function Switch({
  checked,
  onChange,
  id,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        checked ? "bg-linear-to-r from-primary to-brand-lime" : "bg-input",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={cn("block size-6 rounded-full bg-white shadow-md", checked ? "ml-auto" : "")}
      />
    </button>
  );
}

/** Selector de opciones en pastillas (radio group). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  name,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  name: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <label
            key={o.value}
            className={cn(
              "flex min-w-fit flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border px-3 py-2.5 text-sm font-medium transition [&_svg]:size-4",
              "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
              active
                ? "border-primary/60 bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_var(--color-primary)]"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={active} onChange={() => onChange(o.value)} className="sr-only" />
            {o.icon}
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
