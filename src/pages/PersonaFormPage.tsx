import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Footprints, HeartHandshake, House, MapPin, Megaphone, NotebookPen, Phone, Save, UserRound } from "lucide-react";
import { useUser } from "@/context/auth";
import { api, errorMsg } from "@/lib/api";
import { useData } from "@/lib/use-data";
import { hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DIAS_SEMANA,
  ESTADO_LABEL,
  type Casa,
  type CasaPropia,
  type Estado,
  type Lider,
  type Origen,
  type PersonaDetalle,
} from "@/lib/types";
import { Field, Input, Segmented, Select, Switch, Textarea } from "@/components/ui/field";
import { BannerStrip } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, PageLoader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { BlurFade } from "@/components/magicui/blur-fade";
import { ShimmerButton } from "@/components/magicui/shimmer-button";

type FormState = {
  nombres: string;
  apellidos: string;
  telefono_casa: string;
  telefono_personal: string;
  direccion: string;
  zona: string;
  origen: Origen;
  invitado_por: string;
  fecha_llegada: string;
  casa_amistad_id: string;
  lider_id: string;
  estado: Estado;
  notas: string;
  // Su hogar como casa de amistad
  casa_activa: boolean;
  casa_nombre: string;
  casa_dia: string;
  casa_hora: string;
};

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary [&_svg]:size-4.5">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function PersonaForm({ inicial, id, casaPropia }: { inicial: FormState; id?: number; casaPropia?: CasaPropia | null }) {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useState<FormState>(inicial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: casas } = useData<Casa[]>("/casas");
  const { data: lideres } = useData<Lider[]>("/lideres");

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setError(null);
  };

  function elegirCasa(casaId: string) {
    const casa = casas?.find((c) => String(c.id) === casaId);
    // Si la casa tiene líder y aún no hay líder asignado, se sugiere automáticamente
    setF((s) => ({ ...s, casa_amistad_id: casaId, lider_id: !s.lider_id && casa?.lider_id ? String(casa.lider_id) : s.lider_id }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.casa_activa && !f.direccion.trim()) {
      setError("Para registrar su hogar como casa de amistad, escribe la dirección.");
      document.getElementById("direccion")?.focus();
      return;
    }
    const { casa_activa, casa_nombre, casa_dia, casa_hora, ...persona } = f;
    const body = {
      ...persona,
      casa_amistad_id: casa_activa ? "" : persona.casa_amistad_id,
      casa_propia: { activa: casa_activa, nombre: casa_nombre, dia_reunion: casa_dia, hora: casa_hora },
    };
    setBusy(true);
    setError(null);
    try {
      if (id) {
        await api.put(`/personas/${id}`, body);
        toast.ok("Cambios guardados");
        navigate(`/personas/${id}`);
      } else {
        const r = await api.post<{ id: number }>("/personas", body);
        toast.ok(`${f.nombres} quedó registrado(a)`);
        navigate(`/personas/${r.id}`);
      }
    } catch (err) {
      setError(errorMsg(err));
      setBusy(false);
    }
  }

  const evangelismo = f.origen === "evangelismo";

  return (
    <form onSubmit={submit} className="space-y-4">
      <BlurFade delay={0.05}>
        <Section icon={<UserRound />} title="Datos personales">
          <Field label="Nombres" htmlFor="nombres" required>
            <Input id="nombres" value={f.nombres} onChange={(e) => set("nombres", e.target.value)} required maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Apellidos" htmlFor="apellidos" required>
            <Input id="apellidos" value={f.apellidos} onChange={(e) => set("apellidos", e.target.value)} required maxLength={80} autoComplete="off" />
          </Field>
        </Section>
      </BlurFade>

      <BlurFade delay={0.1}>
        <Section icon={<Phone />} title="Contacto y ubicación">
          <Field label="Teléfono personal" htmlFor="tel-personal">
            <Input id="tel-personal" type="tel" inputMode="tel" value={f.telefono_personal} onChange={(e) => set("telefono_personal", e.target.value)} maxLength={30} />
          </Field>
          <Field label="Teléfono de casa" htmlFor="tel-casa">
            <Input id="tel-casa" type="tel" inputMode="tel" value={f.telefono_casa} onChange={(e) => set("telefono_casa", e.target.value)} maxLength={30} />
          </Field>
          <Field label="Dirección" htmlFor="direccion" className="sm:col-span-2">
            <Input id="direccion" value={f.direccion} onChange={(e) => set("direccion", e.target.value)} maxLength={250} placeholder="Calle, número, referencias…" />
          </Field>
          <Field label="Zona / sector" htmlFor="zona">
            <div className="relative">
              <MapPin className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="zona" value={f.zona} onChange={(e) => set("zona", e.target.value)} maxLength={80} className="pl-9" placeholder="Ej. Zona Norte" />
            </div>
          </Field>
        </Section>
      </BlurFade>

      <BlurFade delay={0.15}>
        <Section icon={<Footprints />} title="¿Cómo llegó?" description="Cómo fue captado y quién lo trajo.">
          <div className="sm:col-span-2">
            <Segmented<Origen>
              name="origen"
              value={f.origen}
              onChange={(v) => set("origen", v)}
              options={[
                { value: "visitante", label: "Visitante", icon: <Footprints /> },
                { value: "evangelismo", label: "Evangelismo", icon: <Megaphone /> },
              ]}
            />
          </div>
          <Field
            label={evangelismo ? "Persona que lo contactó" : "Persona que lo invitó"}
            htmlFor="invitado"
            hint={evangelismo ? "Quién le predicó o hizo el primer contacto" : "Quién lo invitó a la iglesia"}
          >
            <Input id="invitado" value={f.invitado_por} onChange={(e) => set("invitado_por", e.target.value)} maxLength={120} />
          </Field>
          <Field label={evangelismo ? "Fecha del contacto" : "Fecha de su primera visita"} htmlFor="fecha-llegada">
            <Input id="fecha-llegada" type="date" value={f.fecha_llegada} max={hoyISO()} onChange={(e) => set("fecha_llegada", e.target.value)} />
          </Field>
        </Section>
      </BlurFade>

      <BlurFade delay={0.2}>
        <Section icon={<House />} title="Casa de amistad y asignación" description="Su hogar, la casa a la que asiste y el líder responsable.">
          {/* Interruptor: su hogar será casa de amistad */}
          <div
            className={cn(
              "rounded-2xl border p-4 transition-colors duration-300 sm:col-span-2",
              f.casa_activa ? "border-primary/40 bg-primary/8" : "bg-secondary/50",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                  f.casa_activa ? "bg-linear-to-br from-primary to-brand-lime text-white" : "bg-muted text-muted-foreground",
                )}
              >
                <HeartHandshake className="size-5" />
              </span>
              <label htmlFor="casa-toggle" className="min-w-0 flex-1 cursor-pointer">
                <p className="text-sm font-medium">¿Su hogar será casa de amistad?</p>
                <p className="text-xs text-muted-foreground">Su casa quedará registrada como casa de amistad y será el anfitrión.</p>
              </label>
              <Switch id="casa-toggle" checked={f.casa_activa} onChange={(v) => set("casa_activa", v)} />
            </div>

            <AnimatePresence initial={false}>
              {f.casa_activa && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-4 pt-4 sm:grid-cols-3">
                    <Field label="Nombre de la casa" htmlFor="casa-nombre" className="sm:col-span-3">
                      <Input
                        id="casa-nombre"
                        value={f.casa_nombre}
                        onChange={(e) => set("casa_nombre", e.target.value)}
                        maxLength={100}
                        placeholder={`Casa de ${[f.nombres, f.apellidos].filter(Boolean).join(" ") || "…"}`}
                      />
                    </Field>
                    <Field label="Día de reunión" htmlFor="casa-dia">
                      <Select id="casa-dia" value={f.casa_dia} onChange={(e) => set("casa_dia", e.target.value)}>
                        <option value="">Por definir</option>
                        {DIAS_SEMANA.map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Hora" htmlFor="casa-hora">
                      <Input id="casa-hora" type="time" value={f.casa_hora} onChange={(e) => set("casa_hora", e.target.value)} />
                    </Field>
                    <p className="flex items-start gap-1.5 self-end pb-2.5 text-xs text-muted-foreground">
                      <MapPin className="mt-px size-3.5 shrink-0" />
                      {f.direccion.trim() ? `Se reunirán en: ${f.direccion}` : <span className="text-warning">Escribe la dirección arriba</span>}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!f.casa_activa && casaPropia && (
              <p className="mt-3 rounded-lg bg-warning/12 px-3 py-2 text-xs text-warning">
                Al guardar se eliminará la casa de amistad «{casaPropia.nombre}»
                {casaPropia.total_personas === 2 && " y su otro miembro quedará sin casa asignada"}
                {casaPropia.total_personas > 2 && ` y sus otros ${casaPropia.total_personas - 1} miembros quedarán sin casa asignada`}.
              </p>
            )}
          </div>

          {!f.casa_activa && (
            <Field label="Casa de amistad a la que asiste" htmlFor="casa">
              <Select id="casa" value={f.casa_amistad_id} onChange={(e) => elegirCasa(e.target.value)}>
                <option value="">Sin asignar</option>
                {casas
                  ?.filter((c) => !id || c.anfitrion_id !== id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.zona ? ` · ${c.zona}` : ""}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          <Field label="Líder asignado" htmlFor="lider">
            <Select id="lider" value={f.lider_id} onChange={(e) => set("lider_id", e.target.value)}>
              <option value="">Sin asignar</option>
              {lideres?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                  {l.id === user.id ? " (yo)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado" htmlFor="estado">
            <Select id="estado" value={f.estado} onChange={(e) => set("estado", e.target.value as Estado)}>
              {(Object.keys(ESTADO_LABEL) as Estado[]).map((k) => (
                <option key={k} value={k}>
                  {ESTADO_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
        </Section>
      </BlurFade>

      <BlurFade delay={0.25}>
        <Section icon={<NotebookPen />} title="Observaciones">
          <Field label="Notas generales" htmlFor="notas" className="sm:col-span-2" hint="Peticiones de oración, situación familiar, intereses, etc.">
            <Textarea id="notas" value={f.notas} onChange={(e) => set("notas", e.target.value)} maxLength={3000} />
          </Field>
        </Section>
      </BlurFade>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/85 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <Button type="button" variant="outline" className="h-11 px-4" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <ShimmerButton type="submit" disabled={busy} className="h-11 py-0 text-sm">
          <Save className="size-4" />
          {busy ? "Guardando…" : id ? "Guardar cambios" : "Registrar persona"}
        </ShimmerButton>
      </div>
    </form>
  );
}

const vacio = (): FormState => ({
  nombres: "",
  apellidos: "",
  telefono_casa: "",
  telefono_personal: "",
  direccion: "",
  zona: "",
  origen: "visitante",
  invitado_por: "",
  fecha_llegada: hoyISO(),
  casa_amistad_id: "",
  lider_id: "",
  estado: "nuevo",
  notas: "",
  casa_activa: false,
  casa_nombre: "",
  casa_dia: "",
  casa_hora: "",
});

export function PersonaNuevaPage() {
  const user = useUser();
  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to="/personas" />
      <BlurFade>
        <BannerStrip className="mb-5" />
      </BlurFade>
      <PageHeader title="Registrar persona" description="Datos de un visitante o persona alcanzada en evangelismo." />
      <PersonaForm inicial={{ ...vacio(), lider_id: user.rol === "lider" ? String(user.id) : "" }} />
    </div>
  );
}

export function PersonaEditarPage() {
  const { id } = useParams();
  const { data, error } = useData<PersonaDetalle>(`/personas/${id}`);
  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <PageLoader />;
  const s = (v: string | number | null) => (v == null ? "" : String(v));
  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to={`/personas/${data.id}`} />
      <PageHeader title={`Editar a ${data.nombres}`} />
      <PersonaForm
        id={data.id}
        casaPropia={data.casa_propia}
        inicial={{
          casa_activa: !!data.casa_propia,
          casa_nombre: s(data.casa_propia?.nombre ?? null),
          casa_dia: s(data.casa_propia?.dia_reunion ?? null),
          casa_hora: s(data.casa_propia?.hora ?? null),
          nombres: data.nombres,
          apellidos: data.apellidos,
          telefono_casa: s(data.telefono_casa),
          telefono_personal: s(data.telefono_personal),
          direccion: s(data.direccion),
          zona: s(data.zona),
          origen: data.origen,
          invitado_por: s(data.invitado_por),
          fecha_llegada: s(data.fecha_llegada),
          casa_amistad_id: s(data.casa_amistad_id),
          lider_id: s(data.lider_id),
          estado: data.estado,
          notas: s(data.notas),
        }}
      />
    </div>
  );
}

export function BackLink({ to, label = "Volver" }: { to: string; label?: string }) {
  return (
    <Link to={to} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}
