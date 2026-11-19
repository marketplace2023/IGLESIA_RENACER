import { Link } from "react-router-dom";
import {
  BellRing,
  CalendarDays,
  ChevronRight,
  Footprints,
  HeartHandshake,
  Megaphone,
  MessageCircle,
  Phone,
  Sparkles,
  UserPlus,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useUser } from "@/context/auth";
import { useData } from "@/lib/use-data";
import { ETAPA_LABEL, TIPO_LABEL, type Etapa, type Resumen } from "@/lib/types";
import { fecha, hace, telLink, waLink } from "@/lib/format";
import { GlowCard } from "@/components/aceternity/glow";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Avatar } from "@/components/ui/avatar";
import { EstadoBadge, OrigenBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, PageHeader, PageLoader } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

function Stat({
  label,
  value,
  icon,
  hint,
  to,
  tone = "primary",
}: {
  label: string;
  value: number;
  icon: ReactNode;
  hint?: string;
  to?: string;
  tone?: "primary" | "info" | "success" | "warning";
}) {
  const toneCls = {
    primary: "bg-primary/12 text-primary",
    info: "bg-info/12 text-info",
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning",
  }[tone];
  const body = (
    <GlowCard className="h-full p-5 transition-transform duration-300 hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg [&_svg]:size-4", toneCls)}>{icon}</span>
      </div>
      <NumberTicker value={value} className="mt-3 text-3xl font-semibold" />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </GlowCard>
  );
  return to ? (
    <Link to={to} className="block rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

export function DashboardPage() {
  const user = useUser();
  const { data, loading, error } = useData<Resumen>("/resumen");

  if (loading && !data) return <PageLoader />;
  if (error || !data) return <p className="text-destructive">{error}</p>;

  const pctEv = data.total ? Math.round((data.evangelismo / data.total) * 100) : 0;
  const estados = [
    { k: "Nuevos", v: data.nuevo, c: "bg-primary" },
    { k: "En seguimiento", v: data.en_seguimiento, c: "bg-info" },
    { k: "Integrados", v: data.integrado, c: "bg-success" },
    { k: "Inactivos", v: data.inactivo, c: "bg-muted-foreground/40" },
  ];

  return (
    <>
      <BlurFade>
        <PageHeader
          title={`${saludo()}, ${user.nombre.split(" ")[0]}`}
          description={
            user.rol === "admin"
              ? "Resumen general de la iglesia."
              : "Resumen de las personas a tu cargo y de tu casa de amistad."
          }
          actions={
            <Button size="lg" render={<Link to="/personas/nueva" />}>
              <UserPlus /> Registrar persona
            </Button>
          }
        />
      </BlurFade>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <BlurFade delay={0.05}>
          <Stat label="Personas registradas" value={data.total} icon={<UsersRound />} to="/personas" />
        </BlurFade>
        <BlurFade delay={0.1}>
          <Stat label="Nuevos este mes" value={data.nuevos_mes} icon={<Sparkles />} tone="success" />
        </BlurFade>
        <BlurFade delay={0.15}>
          <Stat label="Contactos este mes" value={data.contactos_mes} icon={<HeartHandshake />} tone="info" hint="Visitas, llamadas y mensajes" />
        </BlurFade>
        <BlurFade delay={0.2}>
          <Stat
            label="Sin seguimiento"
            value={data.pendientes}
            icon={<BellRing />}
            tone="warning"
            hint={`Más de ${data.dias_pendiente} días sin contacto`}
            to="/personas?pendientes=1"
          />
        </BlurFade>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* Pendientes */}
        <BlurFade delay={0.25} className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader
              title="Necesitan un contacto"
              icon={<BellRing />}
              action={
                data.pendientes > 0 && (
                  <Button variant="ghost" size="sm" render={<Link to="/personas?pendientes=1" />}>
                    Ver todos <ChevronRight />
                  </Button>
                )
              }
            />
            <div className="p-2">
              {data.pendientes_lista.length === 0 ? (
                <div className="p-3">
                  <EmptyState icon={<HeartHandshake />} title="¡Todo al día!">
                    Nadie lleva más de {data.dias_pendiente} días sin contacto.
                  </EmptyState>
                </div>
              ) : (
                <ul className="divide-y">
                  {data.pendientes_lista.map((p) => {
                    const tel = p.telefono_personal || p.telefono_casa;
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                        <Avatar nombre={p.nombres} apellido={p.apellidos} />
                        <Link to={`/personas/${p.id}`} className="min-w-0 flex-1 hover:underline">
                          <p className="truncate text-sm font-medium">
                            {p.nombres} {p.apellidos}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.ultimo_contacto ? `Último contacto: ${hace(p.ultimo_contacto).toLowerCase()}` : `Sin contactos · llegó ${fecha(p.fecha_llegada)}`}
                          </p>
                        </Link>
                        <div className="hidden sm:block">
                          <EstadoBadge estado={p.estado} etapa={p.etapa} />
                        </div>
                        {tel && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon-sm" render={<a href={telLink(tel)} aria-label="Llamar" />}>
                              <Phone />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              render={<a href={waLink(tel)} target="_blank" rel="noreferrer" aria-label="WhatsApp" />}
                            >
                              <MessageCircle />
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </BlurFade>

        {/* Origen y estado */}
        <BlurFade delay={0.3} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader title="Cómo llegaron" icon={<Footprints />} />
            <div className="space-y-5 p-5">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Megaphone className="size-3.5 text-warning" /> Evangelismo <b className="font-semibold">{data.evangelismo}</b>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <b className="font-semibold">{data.visitante}</b> Visitantes <Footprints className="size-3.5 text-info" />
                  </span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-info/70">
                  <div className="bg-warning transition-all duration-700" style={{ width: `${data.total ? pctEv : 50}%` }} />
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Por estado</p>
                <ul className="space-y-2.5">
                  {estados.map((e) => (
                    <li key={e.k} className="flex items-center gap-3 text-sm">
                      <span className={cn("size-2.5 rounded-full", e.c)} />
                      <span className="flex-1">{e.k}</span>
                      <span className="w-24">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                          <span className={cn("block h-full rounded-full", e.c)} style={{ width: `${data.total ? (e.v / data.total) * 100 : 0}%` }} />
                        </span>
                      </span>
                      <span className="w-6 text-right font-medium tabular-nums">{e.v}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {data.integrado > 0 && (
                <div>
                  <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Estatus integrado</p>
                  <ul className="space-y-2">
                    {(Object.keys(ETAPA_LABEL) as Etapa[]).map((k) => (
                      <li key={k}>
                        <Link
                          to={`/personas?estado=integrado&etapa=${k}`}
                          className="flex items-center gap-3 rounded-md text-sm hover:text-primary"
                        >
                          <span className="size-1.5 rounded-full bg-success/70" />
                          <span className="flex-1">{ETAPA_LABEL[k]}</span>
                          <span className="w-6 text-right font-medium tabular-nums">{data.etapas?.[k] ?? 0}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </BlurFade>

        {/* Recientes */}
        <BlurFade delay={0.35} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader title="Registrados recientemente" icon={<Sparkles />} />
            {data.recientes.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={<UserPlus />} title="Aún no hay personas">
                  Registra al primer visitante o fruto de evangelismo.
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y p-2">
                {data.recientes.map((p) => (
                  <li key={p.id}>
                    <Link to={`/personas/${p.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
                      <Avatar nombre={p.nombres} apellido={p.apellidos} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {p.nombres} {p.apellidos}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {fecha(p.fecha_llegada ?? p.creado_en)}
                          {p.invitado_por && ` · por ${p.invitado_por}`}
                        </p>
                      </div>
                      <OrigenBadge origen={p.origen} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </BlurFade>

        {/* Actividad */}
        <BlurFade delay={0.4} className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader title="Últimos contactos y visitas" icon={<CalendarDays />} />
            {data.actividad.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={<CalendarDays />} title="Sin actividad todavía">
                  Cuando registres visitas o llamadas aparecerán aquí.
                </EmptyState>
              </div>
            ) : (
              <ol className="relative space-y-4 p-5 before:absolute before:top-6 before:bottom-6 before:left-[27px] before:w-px before:bg-border">
                {data.actividad.map((a) => (
                  <li key={a.id} className="relative flex gap-4">
                    <span className="relative z-10 mt-1 size-2.5 shrink-0 translate-x-px rounded-full bg-primary ring-4 ring-card" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p>
                        <span className="font-medium">{TIPO_LABEL[a.tipo]}</span> con{" "}
                        <Link to={`/personas/${a.persona_id}`} className="font-medium text-primary hover:underline">
                          {a.nombres} {a.apellidos}
                        </Link>
                      </p>
                      {a.observaciones && <p className="mt-0.5 line-clamp-2 text-muted-foreground">{a.observaciones}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fecha(a.fecha)}
                        {a.usuario_nombre && ` · ${a.usuario_nombre}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </BlurFade>
      </div>
    </>
  );
}
