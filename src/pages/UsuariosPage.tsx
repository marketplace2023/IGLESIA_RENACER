import { useState, type FormEvent } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useUser } from "@/context/auth";
import { api, errorMsg } from "@/lib/api";
import { useData } from "@/lib/use-data";
import type { Rol, Usuario } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Segmented } from "@/components/ui/field";
import { Card, PageHeader, PageLoader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { BlurFade } from "@/components/magicui/blur-fade";

function UsuarioDialog({ u, open, onClose, onSaved }: { u: Usuario | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const me = useUser();
  const toast = useToast();
  const [rol, setRol] = useState<Rol>(u?.rol ?? "lider");
  const [activo, setActivo] = useState(u ? !!u.activo : true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esYo = u?.id === me.id;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = { ...Object.fromEntries(new FormData(e.currentTarget)), rol, activo };
    setBusy(true);
    setError(null);
    try {
      if (u) await api.put(`/usuarios/${u.id}`, body);
      else await api.post("/usuarios", body);
      toast.ok(u ? "Usuario actualizado" : "Usuario creado");
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={u ? `Editar a ${u.nombre}` : "Nuevo líder o usuario"}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" htmlFor="u-nombre" required className="sm:col-span-2">
          <Input id="u-nombre" name="nombre" defaultValue={u?.nombre} required maxLength={100} />
        </Field>
        <Field label="Usuario (para ingresar)" htmlFor="u-usuario" required hint="Sin espacios. Ej. maria.lopez">
          <Input id="u-usuario" name="usuario" defaultValue={u?.usuario} required autoCapitalize="none" pattern="[A-Za-z0-9._\-]{3,}" />
        </Field>
        <Field label="Teléfono" htmlFor="u-tel">
          <Input id="u-tel" name="telefono" type="tel" defaultValue={u?.telefono ?? ""} maxLength={30} />
        </Field>
        <Field label={u ? "Nueva contraseña" : "Contraseña"} htmlFor="u-pw" required={!u} hint={u ? "Déjala vacía para no cambiarla" : "Mínimo 6 caracteres"} className="sm:col-span-2">
          <Input id="u-pw" name="password" type="password" autoComplete="new-password" minLength={6} required={!u} />
        </Field>
        <Field label="Rol" className="sm:col-span-2" hint={rol === "admin" ? "Ve y administra todo: personas, casas y usuarios." : "Ve las personas que tiene asignadas, que registró o de su casa de amistad."}>
          <Segmented<Rol>
            name="rol"
            value={rol}
            onChange={(v) => !esYo && setRol(v)}
            options={[
              { value: "lider", label: "Líder", icon: <UserRound /> },
              { value: "admin", label: "Administrador", icon: <ShieldCheck /> },
            ]}
          />
        </Field>
        {u && !esYo && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
            Usuario activo (puede ingresar)
          </label>
        )}
        {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
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

export function UsuariosPage() {
  const me = useUser();
  const toast = useToast();
  const { data, reload } = useData<Usuario[]>("/usuarios");
  const [dialog, setDialog] = useState<{ u: Usuario | null; n: number; open: boolean }>({ u: null, n: 0, open: false });
  const [borrar, setBorrar] = useState<Usuario | null>(null);

  async function eliminar() {
    if (!borrar) return;
    try {
      await api.del(`/usuarios/${borrar.id}`);
      toast.ok("Usuario eliminado");
      setBorrar(null);
      reload();
    } catch (e) {
      toast.error(errorMsg(e));
    }
  }

  if (!data) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="Líderes y usuarios"
        description="Quiénes pueden ingresar a la aplicación."
        actions={
          <Button size="lg" onClick={() => setDialog({ u: null, n: Date.now(), open: true })}>
            <Plus /> Nuevo usuario
          </Button>
        }
      />
      <BlurFade>
        <Card className="divide-y">
          {data.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap sm:px-5">
              <Avatar nombre={u.nombre} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {u.nombre}
                  {u.id === me.id && <span className="text-xs font-normal text-muted-foreground">(tú)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{u.usuario}
                  {u.telefono && ` · ${u.telefono}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {u.rol === "admin" ? <Badge tone="primary"><ShieldCheck className="size-3" /> Admin</Badge> : <Badge tone="info">Líder</Badge>}
                {!u.activo && <Badge tone="danger">Desactivado</Badge>}
                <Badge>{u.total_personas} personas</Badge>
                {!!u.total_casas && <Badge>{u.total_casas} casa{u.total_casas > 1 ? "s" : ""}</Badge>}
              </div>
              <div className="ml-auto flex">
                <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setDialog({ u, n: Date.now(), open: true })}>
                  <Pencil />
                </Button>
                {u.id !== me.id && (
                  <Button variant="ghost" size="icon-sm" aria-label="Eliminar" onClick={() => setBorrar(u)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      </BlurFade>

      {/* key: reinicia el estado del formulario cada vez que se abre */}
      <UsuarioDialog key={dialog.n} u={dialog.u} open={dialog.open} onClose={() => setDialog((d) => ({ ...d, open: false }))} onSaved={reload} />
      <ConfirmDialog
        open={!!borrar}
        title="¿Eliminar usuario?"
        message={
          <>
            <b className="text-foreground">{borrar?.nombre}</b> ya no podrá ingresar. Sus personas y casas quedarán sin líder asignado; su historial
            de contactos se conserva. Si solo quieres quitarle el acceso, mejor desactívalo.
          </>
        }
        onConfirm={eliminar}
        onCancel={() => setBorrar(null)}
      />
    </>
  );
}
