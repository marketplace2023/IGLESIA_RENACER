import { createContext, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck } from "lucide-react";

type Toast = { id: number; tipo: "ok" | "error"; texto: string };
type Ctx = { ok: (t: string) => void; error: (t: string) => void };

const ToastCtx = createContext<Ctx | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const [value] = useState<Ctx>(() => {
    const push = (tipo: Toast["tipo"], texto: string) => {
      const id = nextId++;
      setItems((xs) => [...xs, { id, tipo, texto }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tipo === "error" ? 5000 : 3000);
    };
    return { ok: (t) => push("ok", t), error: (t) => push("error", t) };
  });

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      >
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl border bg-popover px-4 py-3 text-sm shadow-lg"
            >
              {t.tipo === "ok" ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <span>{t.texto}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast fuera de ToastProvider");
  return ctx;
}
