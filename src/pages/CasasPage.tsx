import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Clock, HeartHandshake, House, MapPin, Pencil, Phone, Plus, Trash2, UserRound, UsersRound } from "lucide-react";
import { useUser } from "@/context/auth";
import { api, errorMsg } from "@/lib/api";
import { useData } from "@/lib/use-data";
import { telLink } from "@/lib/format";
import { DIAS_SEMANA, type Casa, type Lider } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, PageHeader, PageLoader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { GlowCard } from "@/components/aceternity/glow";
import { BlurFade } from "@/components/magicui/blur-fade";

/** Registrar o editar una casa de amistad. Después se asocia a cada persona desde su formulario. */
function CasaDialog({ casa, open, onClose, onSaved }: { casa: Casa | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data: lideres } = useData<Lider[]>(open ? "/lideres" : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError(null);
    try {
      if (casa) await api.put(`/casas/${casa.id}`, body);
      else await api.post("/casas", body);
      toast.ok(casa ? "Casa de amistad actualizada" : "Casa de amistad registrada");
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={casa ? "Editar casa de amistad" : "Nueva casa de amistad"}
      description={casa ? undefined : "Luego podrás asignarla a cada persona desde su registro."}
    >
      {/* key: reinicia los valores al cambiar de casa */}
      <form key={casa?.id ?? "nueva"} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="c-nombre" required className="sm:col-span-2">
          <Input id="c-nombre" name="nombre" defaultValue={casa?.nombre} required maxLength={100} placeholder="Ej. Casa de amistad Los Olivos" />
        </Field>
        <Field label="Dirección" htmlFor="c-dir" className="sm:col-span-2">
          <Input id="c-dir" name="direccion" defaultValue={casa?.direccion ?? ""} maxLength={250} placeholder="Calle, número, referencias…" />
        </Field>
        <Field label="Zona / sector" htmlFor="c-zona">
          <Input id="c-zona" name="zona" defaultValue={casa?.zona ?? ""} maxLength={80} />
        </Field>
        <Field label="Líder responsable" htmlFor="c-lider">
          <Select id="c-lider" name="lider_id" defaultValue={casa?.lider_id ?? ""} key={lideres ? "ok" : "cargando"}>
            <option value="">Sin asignar</option>
            {lideres?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Día de reunión" htmlFor="c-dia">
          <Select id="c-dia" name="dia_reunion" defaultValue={casa?.dia_reunion ?? ""}>
            <option value="">Por definir</option>
            {DIAS_SEMANA.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Hora" htmlFor="c-hora">
          <Input id="c-hora" name="hora" type="time" defaultValue={casa?.hora ?? ""} />
        </Field>
        {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function CasasPage() {
  const user = useUser();
  const toast = useToast();
  const admin = user.rol === "admin";
  const { data, loading, reload } = useData<Casa[]>("/casas");
  const [editando, setEditando] = useState<Casa | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [borrar, setBorrar] = useState<Casa | null>(null);

  const nueva = () => {
    setEditando(null);
    setAbierto(true);
  };

  async function eliminar() {
    if (!borrar) return;
    try {
      await api.del(`/casas/${borrar.id}`);
      toast.ok("Casa de amistad eliminada");
      setBorrar(null);
      reload();
    } catch (e) {
      toast.error(errorMsg(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Casas de amistad"
        description="Regístralas aquí y luego asígnalas a cada persona."
        actions={
          admin && (
            <Button size="lg" onClick={nueva}>
              <Plus /> Nueva casa
            </Button>
          )
        }
      />

      {loading && !data ? (
        <PageLoader />
      ) : data?.length === 0 ? (
        <EmptyState icon={<House />} title="Aún no hay casas de amistad">
          {admin ? (
            <>
              Registra la primera para poder asignar personas.
              <div className="mt-4">
                <Button onClick={nueva}>
                  <Plus /> Nueva casa
                </Button>
              </div>
            </>
          ) : (
            "Un administrador debe registrarlas."
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data?.map((c, i) => (
            <BlurFade key={c.id} delay={i * 0.04}>
              <GlowCard className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3 p-5 pb-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-lime-400/25 to-green-700/25 text-primary">
                      <House className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate leading-tight font-semibold">{c.nombre}</h2>
                      {c.zona && <p className="text-xs text-muted-foreground">{c.zona}</p>}
                    </div>
                  </div>
                  {admin && (
                    <div className="flex shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editar"
                        onClick={() => {
                          setEditando(c);
                          setAbierto(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Eliminar" onClick={() => setBorrar(c)}>
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
                <ul className="space-y-2 px-5 pb-4 text-sm">
                  {/* Casas creadas con la versión anterior pueden tener anfitrión */}
                  {c.anfitrion_id && (
                    <li className="flex items-center gap-2">
                      <HeartHandshake className="size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">Anfitrión:</span>
                      <Link to={`/personas/${c.anfitrion_id}`} className="truncate font-medium hover:underline">
                        {c.anfitrion_nombre}
                      </Link>
                      {c.anfitrion_telefono && (
                        <a href={telLink(c.anfitrion_telefono)} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Llamar al anfitrión">
                          <Phone className="size-4" />
                        </a>
                      )}
                    </li>
                  )}
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <UserRound className="size-4 shrink-0" />
                    {c.lider_nombre ? `Líder: ${c.lider_nombre}` : "Sin líder asignado"}
                  </li>
                  {c.direccion && (
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="size-4 shrink-0" />
                      <span className="truncate">{c.direccion}</span>
                    </li>
                  )}
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4 shrink-0" />
                    {[c.dia_reunion, c.hora].filter(Boolean).join(" · ") || "Horario por definir"}
                  </li>
                </ul>
                <Link to={`/personas?casa=${c.id}`} className="mt-auto flex items-center justify-between border-t px-5 py-3 text-sm hover:bg-muted/40">
                  <span className="flex items-center gap-2">
                    <UsersRound className="size-4 text-primary" />
                    {c.total_personas} {c.total_personas === 1 ? "persona" : "personas"}
                  </span>
                  <span className="text-xs text-muted-foreground">Ver →</span>
                </Link>
              </GlowCard>
            </BlurFade>
          ))}
        </div>
      )}

      <CasaDialog casa={editando} open={abierto} onClose={() => setAbierto(false)} onSaved={reload} />
      <ConfirmDialog
        open={!!borrar}
        title="¿Eliminar casa de amistad?"
        message={`Las ${borrar?.total_personas ?? 0} personas de "${borrar?.nombre}" quedarán sin casa asignada (no se borran).`}
        onConfirm={eliminar}
        onCancel={() => setBorrar(null)}
      />
    </>
  );
}
