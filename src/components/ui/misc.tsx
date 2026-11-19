import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn("size-5 animate-spin text-muted-foreground", className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="size-6" />
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-5">{icon}</div>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border bg-card text-card-foreground shadow-xs", className)}>{children}</div>;
}

export function CardHeader({ title, action, icon }: { title: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
      <h2 className="flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-primary">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}
