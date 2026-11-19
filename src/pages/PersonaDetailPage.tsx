import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays,
  CalendarPlus,
  Church,
  Footprints,
  House,
  MapPin,
  Megaphone,
  MessageCircle,
  NotebookPen,
  Pencil,
  Phone,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useUser } from "@/context/auth";
import { api, errorMsg } from "@/lib/api";
import { useData } from "@/lib/use-data";
import { fecha, fechaLarga, hace, hoyISO, telLink, waLink } from "@/lib/format";
import { ESTADO_LABEL, ETAPA_LABEL, TIPO_LABEL, type Estado, type Etapa, type PersonaDetalle, type TipoContacto } from "@/lib/types";
import { EstadoEtapaFields } from "@/components/estado-etapa";
import { Avatar } from "@/components/ui/avatar";
import { EstadoBadge, OrigenBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Segmented, Textarea } from "@/components/ui/field";
import { Card, CardHeader, EmptyState, PageLoader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { BlurFade } from "@/components/magicui/blur-fade";
import { BorderBeam } from "@/components/magicui/border-beam";
import { GlowCard } from "@/components/aceternity/glow";
import { BackLink } from "./PersonaFormPage";

const TIPO_ICON: Record<TipoContacto, ReactNode> = {
  visita: <House />,
  llamada: <Phone />,
  whatsapp: <MessageCircle />,
  reunion: <Church />,
  otro: <NotebookPen />,
};

function Dato({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm break-words">{children || <span className="text-muted-foreground">—</span>}</div>
      </div>
    </div>
  );
}

function NuevoContactoDialog({ open, onClose, personaId, nombre, onSaved }: { open: boolean; onClose: () => void; personaId: number; nombre: string; onSaved: () => void }) {
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoContacto>("visita");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      await api.post(`/personas/${personaId}/seguimientos`, { tipo, fecha: f.get("fecha"), observaciones: f.get("observaciones") });
      toast.ok("Contacto registrado");
      form.reset();
      setTipo("visita");
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Registrar contacto o visita" description={`Seguimiento a ${nombre}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Tipo de contacto">
          <Segmented<TipoContacto>
            name="tipo"
            value={tipo}
            onChange={setTipo}
            className="[&>label]:basis-[calc(50%-0.25rem)] sm:[&>label]:basis-auto"
            options={(Object.keys(TIPO_LABEL) as TipoContacto[]).map((k) => ({ value: k, label: TIPO_LABEL[k], icon: TIPO_ICON[k] }))}
          />
        </Field>
        <Field label="Fecha" htmlFor="seg-fecha" required>
          <Input id="seg-fecha" name="fecha" type="date" defaultValue={hoyISO()} max={hoyISO()} required />
        </Field>
        <Field label="Observaciones" htmlFor="seg-obs" hint="¿Cómo le fue? ¿Peticiones de oración? ¿Próximos pasos?">
          <Textarea id="seg-obs" name="observaciones" maxLength={3000} />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Guardando…" : "Guardar contacto"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function PersonaDetailPage() {
  const { id } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: p, error, reload } = useData<PersonaDetalle>(`/personas/${id}`);
  const [nuevo, setNuevo] = useState(false);
  const [borrarPersona, setBorrarPersona] = useState(false);
  const [borrarSeg, setBorrarSeg] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <EmptyState icon={<UserRound />} title={error}><Link to="/personas" className="text-primary hover:underline">Volver a la lista</Link></EmptyState>;
  if (!p) return <PageLoader />;

  async function cambiarEstado(estado: Estado, etapa: Etapa | null) {
    try {
      await api.patch(`/personas/${p!.id}/estado`, { estado, etapa });
      toast.ok(`Estado: ${ESTADO_LABEL[estado]}${etapa ? ` · ${ETAPA_LABEL[etapa]}` : ""}`);
      reload();
    } catch (e) {
      toast.error(errorMsg(e));
    }
  }

  async function eliminarPersona() {
    setBusy(true);
    try {
      await api.del(`/personas/${p!.id}`);
      toast.ok("Persona eliminada");
      navigate("/personas", { replace: true });
    } catch (e) {
      toast.error(errorMsg(e));
      setBusy(false);
    }
  }

  async function eliminarSeguimiento() {
    if (borrarSeg == null) return;
    setBusy(true);
    try {
      await api.del(`/seguimientos/${borrarSeg}`);
      toast.ok("Contacto eliminado");
      setBorrarSeg(null);
      reload();
    } catch (e) {
      toast.error(errorMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const tel = p.telefono_personal || p.telefono_casa;
  const evangelismo = p.origen === "evangelismo";

  return (
    <>
      <BackLink to="/personas" label="Personas" />

      {/* Encabezado */}
      <BlurFade>
        <div className="relative mb-4 overflow-hidden rounded-3xl border bg-card p-5 sm:p-6">
          <BorderBeam size={180} duration={12} />
          <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar nombre={p.nombres} apellido={p.apellidos} className="size-16 text-lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {p.nombres} {p.apellidos}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <OrigenBadge origen={p.origen} />
                <EstadoBadge estado={p.estado} etapa={p.etapa} />
                <span className="text-xs text-muted-foreground">· Último contacto: {hace(p.ultimo_contacto).toLowerCase()}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {tel && (
                <>
                  <Button variant="outline" size="lg" render={<a href={telLink(tel)} />}>
                    <Phone /> Llamar
                  </Button>
                  <Button variant="outline" size="lg" render={<a href={waLink(tel)} target="_blank" rel="noreferrer" />}>
                    <MessageCircle /> WhatsApp
                  </Button>
                </>
              )}
              <Button variant="outline" size="icon-lg" render={<Link to={`/personas/${p.id}/editar`} aria-label="Editar" />}>
                <Pencil />
              </Button>
              {user.rol === "admin" && (
                <Button variant="destructive" size="icon-lg" onClick={() => setBorrarPersona(true)} aria-label="Eliminar persona">
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Datos */}
        <div className="space-y-4 lg:col-span-2">
          <BlurFade delay={0.05}>
            <GlowCard>
              <CardHeader title="Datos de contacto" icon={<UserRound />} />
              <div className="space-y-4 p-5">
                <Dato icon={<Phone />} label="Teléfono personal">
                  {p.telefono_personal && <a href={telLink(p.telefono_personal)} className="hover:underline">{p.telefono_personal}</a>}
                </Dato>
                <Dato icon={<Phone />} label="Teléfono de casa">
                  {p.telefono_casa && <a href={telLink(p.telefono_casa)} className="hover:underline">{p.telefono_casa}</a>}
                </Dato>
                <Dato icon={<MapPin />} label="Dirección / zona">
                  {[p.direccion, p.zona].filter(Boolean).join(" · ")}
                </Dato>
              </div>
            </GlowCard>
          </BlurFade>

          <BlurFade delay={0.1}>
            <GlowCard>
              <CardHeader title="Llegada y asignación" icon={evangelismo ? <Megaphone /> : <Footprints />} />
              <div className="space-y-4 p-5">
                <Dato icon={evangelismo ? <Megaphone /> : <Footprints />} label="Cómo llegó">
                  {evangelismo ? "Por evangelismo" : "Como visitante"}
                  {p.fecha_llegada && <span className="text-muted-foreground"> · {fecha(p.fecha_llegada)}</span>}
                </Dato>
                <Dato icon={<UsersRound />} label={evangelismo ? "Lo contactó" : "Lo invitó"}>
                  {p.invitado_por}
                </Dato>
                <Dato icon={<House />} label="Casa de amistad">
                  {p.casa_nombre}
                </Dato>
                <Dato icon={<UserRound />} label="Líder asignado">
                  {p.lider_nombre}
                </Dato>
                <div className="space-y-4 border-t pt-4">
                  <EstadoEtapaFields idPrefix="estado-rapido" estado={p.estado} etapa={p.etapa} onChange={cambiarEstado} />
                </div>
              </div>
            </GlowCard>
          </BlurFade>

          {p.notas && (
            <BlurFade delay={0.15}>
              <Card>
                <CardHeader title="Notas" icon={<NotebookPen />} />
                <p className="p-5 text-sm whitespace-pre-wrap text-muted-foreground">{p.notas}</p>
              </Card>
            </BlurFade>
          )}
          <p className="px-1 text-xs text-muted-foreground">
            Registrado {fecha(p.creado_en)}
            {p.creado_por_nombre && ` por ${p.creado_por_nombre}`}
          </p>
        </div>

        {/* Historial */}
        <BlurFade delay={0.1} className="lg:col-span-3">
          <Card>
            <CardHeader
              title={`Contactos y visitas (${p.seguimientos.length})`}
              icon={<CalendarDays />}
              action={
                <Button size="sm" onClick={() => setNuevo(true)}>
                  <CalendarPlus /> Registrar
                </Button>
              }
            />
            <div className="p-5">
              {p.seguimientos.length === 0 ? (
                <EmptyState icon={<CalendarPlus />} title="Sin contactos todavía">
                  Registra la primera visita, llamada o mensaje para comenzar su seguimiento.
                  <div className="mt-4">
                    <Button onClick={() => setNuevo(true)}>
                      <CalendarPlus /> Registrar contacto
                    </Button>
                  </div>
                </EmptyState>
              ) : (
                <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-px before:bg-border">
                  <AnimatePresence initial={false}>
                    {p.seguimientos.map((s) => (
                      <motion.li
                        key={s.id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="group relative flex gap-4"
                      >
                        <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border bg-card text-primary [&_svg]:size-4">
                          {TIPO_ICON[s.tipo]}
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className="font-medium">{TIPO_LABEL[s.tipo]}</p>
                            <p className="text-xs text-muted-foreground first-letter:uppercase" title={fechaLarga(s.fecha)}>
                              {fecha(s.fecha)} · {hace(s.fecha).toLowerCase()}
                            </p>
                          </div>
                          {s.observaciones && <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{s.observaciones}</p>}
                          <div className="mt-1 flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">{s.usuario_nombre ? `Registrado por ${s.usuario_nombre}` : ""}</p>
                            {(user.rol === "admin" || s.usuario_id === user.id) && (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="opacity-60 group-hover:opacity-100"
                                onClick={() => setBorrarSeg(s.id)}
                                aria-label="Eliminar contacto"
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ol>
              )}
            </div>
          </Card>
        </BlurFade>
      </div>

      <NuevoContactoDialog open={nuevo} onClose={() => setNuevo(false)} personaId={p.id} nombre={p.nombres} onSaved={reload} />
      <ConfirmDialog
        open={borrarPersona}
        title="¿Eliminar a esta persona?"
        message={`Se borrará a ${p.nombres} ${p.apellidos} y todo su historial de contactos${
          ""
        }. Esta acción no se puede deshacer. Si solo dejó de asistir, considera marcarla como "Inactivo".`}
        onConfirm={eliminarPersona}
        onCancel={() => setBorrarPersona(false)}
        busy={busy}
      />
      <ConfirmDialog
        open={borrarSeg != null}
        title="¿Eliminar este contacto?"
        message="El registro se quitará del historial."
        onConfirm={eliminarSeguimiento}
        onCancel={() => setBorrarSeg(null)}
        busy={busy}
      />
    </>
  );
}
