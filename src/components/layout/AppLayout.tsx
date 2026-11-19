import { useEffect, useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  House,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth, useUser } from "@/context/auth";
import { useTheme } from "@/lib/use-data";
import { api, errorMsg } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/brand";

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const user = useUser();
  const navigate = useNavigate();
  const items = [
    { to: "/", label: "Inicio", icon: LayoutDashboard, end: true },
    { to: "/personas", label: "Personas", icon: UsersRound },
    { to: "/casas", label: "Casas de amistad", icon: House },
    ...(user.rol === "admin" ? [{ to: "/usuarios", label: "Líderes y usuarios", icon: ShieldCheck }] : []),
  ];

  return (
    <nav className="flex flex-col gap-1">
      <ShimmerButton
        className="mb-4 w-full py-2.5 text-sm"
        onClick={() => {
          navigate("/personas/nueva");
          onNavigate?.();
        }}
      >
        <UserPlus className="size-4" />
        Registrar persona
      </ShimmerButton>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-activo"
                  className="absolute inset-0 rounded-lg bg-primary/12 ring-1 ring-primary/20"
                  transition={{ type: "spring", damping: 30, stiffness: 380 }}
                />
              )}
              <it.icon className={cn("relative size-4", isActive && "text-primary")} />
              <span className="relative">{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function UserBox({ onPassword }: { onPassword: () => void }) {
  const user = useUser();
  const { logout } = useAuth();
  const { dark, toggle } = useTheme();
  return (
    <div className="rounded-xl border bg-card/60 p-3">
      <div className="flex items-center gap-3">
        <Avatar nombre={user.nombre} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">{user.nombre}</p>
          <p className="text-xs text-muted-foreground">{user.rol === "admin" ? "Administrador" : "Líder"}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1">
        <Button variant="ghost" size="sm" onClick={toggle} title={dark ? "Modo claro" : "Modo oscuro"} aria-label="Cambiar tema">
          {dark ? <Sun /> : <Moon />}
        </Button>
        <Button variant="ghost" size="sm" onClick={onPassword} title="Cambiar contraseña" aria-label="Cambiar contraseña">
          <KeyRound />
        </Button>
        <Button variant="ghost" size="sm" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
          <LogOut />
        </Button>
      </div>
    </div>
  );
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("nueva") !== f.get("confirmar")) return setErr("Las contraseñas nuevas no coinciden");
    setBusy(true);
    setErr(null);
    try {
      await api.put("/auth/password", { actual: f.get("actual"), nueva: f.get("nueva") });
      toast.ok("Contraseña actualizada");
      onClose();
    } catch (e) {
      setErr(errorMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Cambiar contraseña">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Contraseña actual" htmlFor="pw-actual">
          <Input id="pw-actual" name="actual" type="password" autoComplete="current-password" required />
        </Field>
        <Field label="Nueva contraseña" htmlFor="pw-nueva" hint="Mínimo 6 caracteres">
          <Input id="pw-nueva" name="nueva" type="password" autoComplete="new-password" minLength={6} required />
        </Field>
        <Field label="Repite la nueva contraseña" htmlFor="pw-conf">
          <Input id="pw-conf" name="confirmar" type="password" autoComplete="new-password" minLength={6} required />
        </Field>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" disabled={busy}>
            Guardar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const [pw, setPw] = useState(false);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="relative min-h-svh">
      {/* textura de fondo sutil */}
      <div className="pointer-events-none fixed inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]">
        <DotPattern className="fill-foreground/[0.07]" />
      </div>

      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background/80 px-4 py-5 backdrop-blur-xl lg:flex">
        <div className="mb-6 px-1">
          <Brand />
        </div>
        <Nav />
        <div className="mt-auto">
          <UserBox onPassword={() => setPw(true)} />
        </div>
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Brand />
        <Button variant="outline" size="icon-lg" onClick={() => setDrawer(true)} aria-label="Abrir menú">
          <Menu />
        </Button>
      </header>

      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r bg-background px-4 py-5"
            >
              <div className="mb-6 flex items-center justify-between px-1">
                <Brand />
                <Button variant="ghost" size="icon" onClick={() => setDrawer(false)} aria-label="Cerrar menú">
                  <X />
                </Button>
              </div>
              <Nav onNavigate={() => setDrawer(false)} />
              <div className="mt-auto">
                <UserBox
                  onPassword={() => {
                    setDrawer(false);
                    setPw(true);
                  }}
                />
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>

      <PasswordDialog open={pw} onClose={() => setPw(false)} />
    </div>
  );
}
