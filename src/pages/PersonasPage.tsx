import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BellRing, ChevronRight, HeartHandshake, MessageCircle, Phone, Search, UserPlus, UsersRound, X } from "lucide-react";
import { useUser } from "@/context/auth";
import { useData } from "@/lib/use-data";
import { ESTADO_LABEL, type Casa, type Estado, type Lider, type Persona } from "@/lib/types";
import { hace, telLink, waLink, diasDesde } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge, EstadoBadge, OrigenBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, PageHeader, Spinner } from "@/components/ui/misc";
import { BlurFade } from "@/components/magicui/blur-fade";
import { cn } from "@/lib/utils";

function UltimoContacto({ p }: { p: Persona }) {
  const viejo = !p.ultimo_contacto || diasDesde(p.ultimo_contacto) > 15;
  const activo = p.estado === "nuevo" || p.estado === "en_seguimiento";
  return (
    <span className={cn("text-sm", viejo && activo ? "text-warning" : "text-muted-foreground")}>
      {hace(p.ultimo_contacto)}
    </span>
  );
}

function Telefonos({ p }: { p: Persona }) {
  const tel = p.telefono_personal || p.telefono_casa;
  if (!tel) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm tabular-nums">{tel}</span>
      <Button variant="ghost" size="icon-xs" render={<a href={telLink(tel)} aria-label={`Llamar a ${p.nombres}`} onClick={(e) => e.stopPropagation()} />}>
        <Phone />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        render={<a href={waLink(tel)} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${p.nombres}`} onClick={(e) => e.stopPropagation()} />}
      >
        <MessageCircle />
      </Button>
    </div>
  );
}

export function PersonasPage() {
  const user = useUser();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const { data: lideres } = useData<Lider[]>("/lideres");
  const { data: casas } = useData<Casa[]>("/casas");

  // Búsqueda con pequeño retardo mientras se escribe
  useEffect(() => {
    const t = setTimeout(() => {
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (q.trim()) n.set("q", q.trim());
          else n.delete("q");
          return n;
        },
        { replace: true },
      );
    }, 250);
    return () => clearTimeout(t);
  }, [q, setParams]);

  const { data, loading } = useData<Persona[]>(`/personas?${params.toString()}`);

  const setFilter = (k: string, v: string) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (v) n.set(k, v);
        else n.delete(k);
        return n;
      },
      { replace: true },
    );

  const filtrosActivos = ["origen", "estado", "lider", "casa", "pendientes"].some((k) => params.get(k));
  const pendientes = params.get("pendientes") === "1";

  return (
    <>
      <PageHeader
        title="Personas"
        description={
          data ? `${data.length} ${data.length === 1 ? "persona" : "personas"}${pendientes ? " que necesitan seguimiento" : ""}` : "Cargando…"
        }
        actions={
          <Button size="lg" render={<Link to="/personas/nueva" />}>
            <UserPlus /> Registrar persona
          </Button>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, teléfono, zona, dirección o quién lo invitó…"
            className="pl-10"
            aria-label="Buscar personas"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Select value={params.get("origen") ?? ""} onChange={(e) => setFilter("origen", e.target.value)} aria-label="Cómo llegó">
            <option value="">Cómo llegó: todos</option>
            <option value="evangelismo">Evangelismo</option>
            <option value="visitante">Visitante</option>
          </Select>
          <Select value={params.get("estado") ?? ""} onChange={(e) => setFilter("estado", e.target.value)} aria-label="Estado">
            <option value="">Estado: todos</option>
            {(Object.keys(ESTADO_LABEL) as Estado[]).map((k) => (
              <option key={k} value={k}>
                {ESTADO_LABEL[k]}
              </option>
            ))}
          </Select>
          <Select value={params.get("casa") ?? ""} onChange={(e) => setFilter("casa", e.target.value)} aria-label="Casa de amistad">
            <option value="">Casa de amistad: todas</option>
            <option value="ninguna">Sin casa asignada</option>
            {casas?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
          <Select value={params.get("lider") ?? ""} onChange={(e) => setFilter("lider", e.target.value)} aria-label="Líder">
            <option value="">Líder: todos</option>
            <option value="ninguno">Sin líder asignado</option>
            {user.rol === "lider" && <option value={user.id}>Solo los míos</option>}
            {lideres
              ?.filter((l) => user.rol === "admin" || l.id !== user.id)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("pendientes", pendientes ? "" : "1")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
              pendientes ? "border-warning/50 bg-warning/15 text-warning" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={pendientes}
          >
            <BellRing className="size-3.5" /> Solo sin seguimiento (+15 días)
          </button>
          {filtrosActivos && (
            <button
              type="button"
              onClick={() => setParams(q.trim() ? { q: q.trim() } : {}, { replace: true })}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" /> Limpiar filtros
            </button>
          )}
          {loading && <Spinner className="ml-auto size-4" />}
        </div>
      </Card>

      {data && data.length === 0 ? (
        <EmptyState icon={<UsersRound />} title={q || filtrosActivos ? "No hay resultados" : "Aún no hay personas registradas"}>
          {q || filtrosActivos ? (
            "Prueba con otra búsqueda o quita algunos filtros."
          ) : (
            <Link to="/personas/nueva" className="text-primary hover:underline">
              Registra a la primera persona
            </Link>
          )}
        </EmptyState>
      ) : (
        data && (
          <BlurFade>
            {/* Tabla (escritorio) */}
            <Card className="hidden overflow-hidden md:block">
              <table className="w-full text-left">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Teléfono</th>
                    <th className="px-4 py-3 font-medium">Llegó por</th>
                    <th className="hidden px-4 py-3 font-medium xl:table-cell">Casa / Líder</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Último contacto</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/personas/${p.id}`)}
                      className="group cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <Link to={`/personas/${p.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <Avatar nombre={p.nombres} apellido={p.apellidos} className="size-8" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {p.nombres} {p.apellidos}
                              {p.casa_propia_id && <HeartHandshake className="ml-1.5 inline size-3.5 text-success" aria-label="Anfitrión de casa de amistad" />}
                            </p>
                            {p.zona && <p className="truncate text-xs text-muted-foreground">{p.zona}</p>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Telefonos p={p} />
                      </td>
                      <td className="px-4 py-3">
                        <OrigenBadge origen={p.origen} />
                      </td>
                      <td className="hidden px-4 py-3 text-sm xl:table-cell">
                        <p className="truncate">{p.casa_nombre ?? <span className="text-muted-foreground">Sin casa</span>}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.lider_nombre ?? "Sin líder"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <EstadoBadge estado={p.estado} />
                      </td>
                      <td className="px-4 py-3">
                        <UltimoContacto p={p} />
                      </td>
                      <td className="pr-3">
                        <ChevronRight className="size-4 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Tarjetas (móvil) */}
            <ul className="space-y-2 md:hidden">
              {data.map((p) => (
                <li key={p.id}>
                  <Card className="p-3.5">
                    <Link to={`/personas/${p.id}`} className="flex items-center gap-3">
                      <Avatar nombre={p.nombres} apellido={p.apellidos} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {p.nombres} {p.apellidos}
                          {p.casa_propia_id && <HeartHandshake className="ml-1.5 inline size-3.5 text-success" aria-label="Anfitrión de casa de amistad" />}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[p.zona, p.lider_nombre].filter(Boolean).join(" · ") || "Sin líder asignado"}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <OrigenBadge origen={p.origen} />
                      <EstadoBadge estado={p.estado} />
                      <Badge>Contacto: {hace(p.ultimo_contacto).toLowerCase()}</Badge>
                    </div>
                    {(p.telefono_personal || p.telefono_casa) && (
                      <div className="mt-2 border-t pt-2">
                        <Telefonos p={p} />
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          </BlurFade>
        )
      )}
    </>
  );
}
