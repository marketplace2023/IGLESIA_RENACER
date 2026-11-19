import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useAuth } from "@/context/auth";
import { errorMsg } from "@/lib/api";
import { Field, Input } from "@/components/ui/field";
import { BANNER_URL, Logo } from "@/components/brand";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { BorderBeam } from "@/components/magicui/border-beam";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text";
import { Spotlight } from "@/components/aceternity/spotlight";
import { Meteors } from "@/components/aceternity/meteors";

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await login(String(f.get("usuario")), String(f.get("password")));
    } catch (err) {
      setError(errorMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-svh bg-background lg:grid-cols-[1.15fr_1fr]">
      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        className="relative h-56 overflow-hidden sm:h-72 lg:h-auto"
      >
        <img src={BANNER_URL} alt="Congregación en adoración" className="absolute inset-0 size-full object-cover object-[left_30%]" />
        {/* fundido hacia el formulario */}
        <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-transparent lg:bg-linear-to-l lg:from-background lg:via-background/5" />
        <div className="absolute inset-0 bg-green-950/10" />
      </motion.div>

      {/* Formulario */}
      <div className="relative flex items-start justify-center overflow-hidden px-4 pt-2 pb-10 lg:items-center lg:py-10">
        <Spotlight className="-top-40 left-0 md:-top-20 md:left-20" fill="#a6ce4c" />
        <DotPattern className="[mask-image:radial-gradient(420px_circle_at_center,white,transparent)]" />
        <div className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-lime-500/15 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
          className="relative z-10 w-full max-w-sm"
        >
          <div className="relative overflow-hidden rounded-3xl border bg-card/85 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
            <Meteors number={10} />
            <BorderBeam size={160} duration={9} />

            <div className="relative">
              <Logo className="mb-5 size-16 rounded-2xl" />
              <h1 className="text-3xl font-semibold tracking-tight">
                <AnimatedGradientText>Renacer</AnimatedGradientText>
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Registro y seguimiento de nuevos creyentes y visitantes.</p>

              <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
                <Field label="Usuario" htmlFor="usuario">
                  <Input id="usuario" name="usuario" autoComplete="username" autoCapitalize="none" placeholder="tu usuario" required autoFocus />
                </Field>
                <Field label="Contraseña" htmlFor="password">
                  <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
                </Field>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                    className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {error}
                  </motion.p>
                )}

                <ShimmerButton type="submit" disabled={busy} className="mt-2 w-full">
                  {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  {busy ? "Ingresando…" : "Ingresar"}
                  {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
                </ShimmerButton>
              </form>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">¿No tienes acceso? Pídele a un administrador que te cree un usuario.</p>
        </motion.div>
      </div>
    </div>
  );
}
