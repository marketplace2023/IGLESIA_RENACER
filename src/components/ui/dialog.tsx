import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      panel.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=radio]), select, textarea")?.focus();
    }, 60);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={cn(
              "relative max-h-[92svh] w-full overflow-y-auto rounded-t-2xl border bg-popover p-5 text-popover-foreground shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6",
              className,
            )}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
              </div>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar">
                <X />
              </Button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Eliminar",
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <div className="text-sm text-muted-foreground">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" size="lg" onClick={onCancel} data-autofocus>
          Cancelar
        </Button>
        <Button variant="destructive" size="lg" onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
