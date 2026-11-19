/**
 * API de Renacer. La misma app corre:
 *  - en Netlify como función serverless (netlify/functions/api.ts)
 *  - en tu computadora con `npm run dev` (server/index.ts)
 */
import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { all, ensureDb, get, getJwtSecret, transaction, type Param } from "./db.ts";

const COOKIE = "renacer_session";
const SESSION_DAYS = 7;
const DIAS_PENDIENTE = 15;

type Rol = "admin" | "lider";
type SessionUser = { id: number; nombre: string; usuario: string; telefono: string | null; rol: Rol; activo: number };
type Body = Record<string, unknown>;

/* ───────────────────────── helpers ───────────────────────── */

/** Texto limpio o null. */
const txt = (v: unknown, max = 200): string | null => {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t ? t.slice(0, max) : null;
};
const idOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function isoDe(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/**
 * "Hoy" según el navegador del usuario (parámetro ?hoy=YYYY-MM-DD).
 * El servidor de Netlify corre en UTC y podría estar en otro día que la iglesia.
 */
function hoyDe(req: Request) {
  const h = req.query.hoy ?? (req.body as Body | undefined)?.hoy;
  return isDate(h) ? h : isoDe(new Date());
}
function restarDias(iso: string, dias: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDe(new Date(y, m - 1, d - dias));
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const me = (res: Response) => res.locals.user as SessionUser;
const isAdmin = (u: SessionUser) => u.rol === "admin";
const uniqueError = (e: unknown) =>
  (e as { code?: string })?.code === "23505" || (e instanceof Error && /unique|duplicate key/i.test(e.message));

/** Filtro SQL para que un líder solo vea a "sus" personas. */
function scope(u: SessionUser, alias = "p"): { sql: string; params: Param[] } {
  if (isAdmin(u)) return { sql: "TRUE", params: [] };
  return {
    sql: `(${alias}.lider_id = ? OR ${alias}.creado_por = ? OR ${alias}.casa_amistad_id IN (SELECT id FROM casas_amistad WHERE lider_id = ?))`,
    params: [u.id, u.id, u.id],
  };
}

async function personaAccesible(u: SessionUser, id: number) {
  const s = scope(u);
  const p = await get<{ id: number }>(`SELECT p.id FROM personas p WHERE p.id = ? AND ${s.sql}`, [id, ...s.params]);
  if (!p) throw new HttpError(404, "Persona no encontrada");
}

/* ───────────────────────── app ───────────────────────── */

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true); // Netlify está detrás de un proxy HTTPS
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());

const api = express.Router();
// En Netlify la petición puede llegar como /api/... o como /.netlify/functions/api/...
app.use(["/api", "/.netlify/functions/api"], api);

api.use(async (_req, _res, next) => {
  await ensureDb();
  next();
});

/* ───────────────────────── auth ───────────────────────── */

function cookieOpts(req: Request) {
  return { httpOnly: true, sameSite: "lax" as const, secure: req.secure, path: "/" };
}

function setSession(req: Request, res: Response, userId: number) {
  const token = jwt.sign({ id: userId }, getJwtSecret(), { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, { ...cookieOpts(req), maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
}

async function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: "No autenticado" });
  let payload: { id: number };
  try {
    payload = jwt.verify(token, getJwtSecret()) as { id: number };
  } catch {
    res.clearCookie(COOKIE, cookieOpts(req));
    return res.status(401).json({ error: "Sesión expirada" });
  }
  const user = await get<SessionUser>("SELECT id, nombre, usuario, telefono, rol, activo FROM usuarios WHERE id = ?", [
    payload.id,
  ]);
  if (!user || !user.activo) {
    res.clearCookie(COOKIE, cookieOpts(req));
    return res.status(401).json({ error: "Sesión no válida" });
  }
  res.locals.user = user;
  next();
}

function adminOnly(_req: Request, res: Response, next: NextFunction) {
  if (!isAdmin(me(res))) return res.status(403).json({ error: "Solo un administrador puede hacer esto" });
  next();
}

// Limitador simple de intentos de login por IP (por instancia)
const intentos = new Map<string, { n: number; hasta: number }>();
function demasiadosIntentos(ip: string) {
  const r = intentos.get(ip);
  return !!r && r.n >= 8 && r.hasta > Date.now();
}
function registrarFallo(ip: string) {
  const r = intentos.get(ip);
  if (!r || r.hasta < Date.now()) intentos.set(ip, { n: 1, hasta: Date.now() + 15 * 60_000 });
  else r.n++;
}

api.post("/auth/login", async (req, res) => {
  const ip = req.ip ?? "?";
  if (demasiadosIntentos(ip))
    return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos e inténtalo otra vez." });

  const usuario = txt(req.body?.usuario, 60);
  const password = String(req.body?.password ?? "");
  const u = usuario
    ? await get<SessionUser & { password_hash: string }>("SELECT * FROM usuarios WHERE lower(usuario) = lower(?)", [usuario])
    : undefined;

  if (!u || !bcrypt.compareSync(password, u.password_hash)) {
    registrarFallo(ip);
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }
  if (!u.activo) return res.status(403).json({ error: "Tu usuario está desactivado. Habla con un administrador." });

  intentos.delete(ip);
  setSession(req, res, u.id);
  const { password_hash: _omit, ...user } = u;
  void _omit;
  res.json({ user });
});

api.post("/auth/logout", (req, res) => {
  res.clearCookie(COOKIE, cookieOpts(req));
  res.json({ ok: true });
});

api.use(auth);

api.get("/auth/me", (_req, res) => res.json({ user: me(res) }));

api.put("/auth/password", async (req, res) => {
  const actual = String(req.body?.actual ?? "");
  const nueva = String(req.body?.nueva ?? "");
  if (nueva.length < 6) throw new HttpError(400, "La nueva contraseña debe tener al menos 6 caracteres");
  const row = await get<{ password_hash: string }>("SELECT password_hash FROM usuarios WHERE id = ?", [me(res).id]);
  if (!row || !bcrypt.compareSync(actual, row.password_hash)) throw new HttpError(400, "La contraseña actual no es correcta");
  await all("UPDATE usuarios SET password_hash = ? WHERE id = ?", [bcrypt.hashSync(nueva, 10), me(res).id]);
  res.json({ ok: true });
});

/* ───────────────────────── usuarios / líderes ───────────────────────── */

api.get("/lideres", async (_req, res) => {
  res.json(await all("SELECT id, nombre, rol FROM usuarios WHERE activo = 1 ORDER BY nombre"));
});

api.get("/usuarios", adminOnly, async (_req, res) => {
  res.json(
    await all(`
      SELECT u.id, u.nombre, u.usuario, u.telefono, u.rol, u.activo, u.creado_en,
        (SELECT COUNT(*) FROM personas p WHERE p.lider_id = u.id)::int AS total_personas,
        (SELECT COUNT(*) FROM casas_amistad c WHERE c.lider_id = u.id)::int AS total_casas
      FROM usuarios u ORDER BY u.activo DESC, u.nombre`),
  );
});

function parseUsuario(b: Body, creando: boolean) {
  const nombre = txt(b.nombre, 100);
  const usuario = txt(b.usuario, 60)?.toLowerCase() ?? null;
  const rol = b.rol === "admin" ? "admin" : "lider";
  const password = b.password ? String(b.password) : "";
  if (!nombre) throw new HttpError(400, "El nombre es obligatorio");
  if (!usuario || !/^[a-z0-9._-]{3,}$/.test(usuario))
    throw new HttpError(400, "El usuario debe tener 3+ caracteres (letras, números, punto, guion)");
  if (creando && password.length < 6) throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
  if (!creando && password && password.length < 6) throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
  return { nombre, usuario, rol, password, telefono: txt(b.telefono, 30), activo: b.activo === false ? 0 : 1 };
}

api.post("/usuarios", adminOnly, async (req, res) => {
  const d = parseUsuario(req.body ?? {}, true);
  try {
    const row = await get<{ id: number }>(
      "INSERT INTO usuarios (nombre, usuario, telefono, password_hash, rol, activo) VALUES (?,?,?,?,?,?) RETURNING id",
      [d.nombre, d.usuario, d.telefono, bcrypt.hashSync(d.password, 10), d.rol, d.activo],
    );
    res.status(201).json({ id: row?.id });
  } catch (e) {
    if (uniqueError(e)) throw new HttpError(409, "Ese nombre de usuario ya existe");
    throw e;
  }
});

api.put("/usuarios/:id", adminOnly, async (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id || !(await get("SELECT id FROM usuarios WHERE id = ?", [id]))) throw new HttpError(404, "Usuario no encontrado");
  const d = parseUsuario(req.body ?? {}, false);
  if (id === me(res).id && (d.rol !== "admin" || !d.activo))
    throw new HttpError(400, "No puedes quitarte el rol de administrador ni desactivarte a ti mismo");
  try {
    await all("UPDATE usuarios SET nombre=?, usuario=?, telefono=?, rol=?, activo=? WHERE id=?", [
      d.nombre, d.usuario, d.telefono, d.rol, d.activo, id,
    ]);
    if (d.password) await all("UPDATE usuarios SET password_hash=? WHERE id=?", [bcrypt.hashSync(d.password, 10), id]);
    res.json({ ok: true });
  } catch (e) {
    if (uniqueError(e)) throw new HttpError(409, "Ese nombre de usuario ya existe");
    throw e;
  }
});

api.delete("/usuarios/:id", adminOnly, async (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id) throw new HttpError(404, "Usuario no encontrado");
  if (id === me(res).id) throw new HttpError(400, "No puedes eliminar tu propio usuario");
  // Las referencias (personas, casas, seguimientos) quedan en NULL por ON DELETE SET NULL
  await all("DELETE FROM usuarios WHERE id = ?", [id]);
  res.json({ ok: true });
});

/* ───────────────────────── casas de amistad ───────────────────────── */

// Las casas de amistad se registran aquí primero y luego se asocian a cada persona.
api.get("/casas", async (_req, res) => {
  res.json(
    await all(`
      SELECT c.*, u.nombre AS lider_nombre,
        a.nombres || ' ' || a.apellidos AS anfitrion_nombre,
        COALESCE(a.telefono_personal, a.telefono_casa) AS anfitrion_telefono,
        (SELECT COUNT(*) FROM personas p WHERE p.casa_amistad_id = c.id)::int AS total_personas
      FROM casas_amistad c
      LEFT JOIN usuarios u ON u.id = c.lider_id
      LEFT JOIN personas a ON a.id = c.anfitrion_id
      ORDER BY c.nombre`),
  );
});

async function parseCasa(b: Body): Promise<Param[]> {
  const nombre = txt(b.nombre, 100);
  if (!nombre) throw new HttpError(400, "El nombre de la casa de amistad es obligatorio");
  const lider_id = idOrNull(b.lider_id);
  if (lider_id && !(await get("SELECT id FROM usuarios WHERE id = ?", [lider_id]))) throw new HttpError(400, "Líder no válido");
  return [nombre, txt(b.direccion, 250), txt(b.zona, 80), txt(b.dia_reunion, 30), txt(b.hora, 10), lider_id];
}

api.post("/casas", adminOnly, async (req, res) => {
  const row = await get<{ id: number }>(
    "INSERT INTO casas_amistad (nombre, direccion, zona, dia_reunion, hora, lider_id) VALUES (?,?,?,?,?,?) RETURNING id",
    await parseCasa(req.body ?? {}),
  );
  res.status(201).json({ id: row?.id });
});

api.put("/casas/:id", adminOnly, async (req, res) => {
  const id = idOrNull(req.params.id);
  const rows = await all(
    "UPDATE casas_amistad SET nombre=?, direccion=?, zona=?, dia_reunion=?, hora=?, lider_id=? WHERE id=? RETURNING id",
    [...(await parseCasa(req.body ?? {})), id],
  );
  if (!rows.length) throw new HttpError(404, "Casa de amistad no encontrada");
  res.json({ ok: true });
});

api.delete("/casas/:id", adminOnly, async (req, res) => {
  // Los miembros quedan sin casa por ON DELETE SET NULL
  await all("DELETE FROM casas_amistad WHERE id = ?", [idOrNull(req.params.id)]);
  res.json({ ok: true });
});

/* ───────────────────────── personas ───────────────────────── */

const PERSONA_SELECT = `
  SELECT p.*, u.nombre AS lider_nombre, c.nombre AS casa_nombre, cr.nombre AS creado_por_nombre,
    (SELECT MAX(s.fecha) FROM seguimientos s WHERE s.persona_id = p.id) AS ultimo_contacto,
    (SELECT COUNT(*)     FROM seguimientos s WHERE s.persona_id = p.id)::int AS total_contactos,
    (SELECT ch.id FROM casas_amistad ch WHERE ch.anfitrion_id = p.id) AS casa_propia_id
  FROM personas p
  LEFT JOIN usuarios u       ON u.id  = p.lider_id
  LEFT JOIN usuarios cr      ON cr.id = p.creado_por
  LEFT JOIN casas_amistad c  ON c.id  = p.casa_amistad_id`;

api.get("/personas", async (req, res) => {
  const s = scope(me(res));
  const where = [s.sql];
  const params: Param[] = [...s.params];
  const q = txt(req.query.q, 80);

  if (q) {
    const like = `%${q}%`;
    where.push(
      "((p.nombres || ' ' || p.apellidos) ILIKE ? OR p.telefono_personal ILIKE ? OR p.telefono_casa ILIKE ? OR p.zona ILIKE ? OR p.direccion ILIKE ? OR p.invitado_por ILIKE ?)",
    );
    params.push(like, like, like, like, like, like);
  }
  if (req.query.origen === "evangelismo" || req.query.origen === "visitante") {
    where.push("p.origen = ?");
    params.push(req.query.origen);
  }
  const estado = txt(req.query.estado, 20);
  if (estado) {
    where.push("p.estado = ?");
    params.push(estado);
  }
  const etapa = txt(req.query.etapa, 30);
  if (etapa) {
    where.push("p.etapa = ?");
    params.push(etapa);
  }
  const lider = req.query.lider === "ninguno" ? "ninguno" : idOrNull(req.query.lider);
  if (lider === "ninguno") where.push("p.lider_id IS NULL");
  else if (lider) {
    where.push("p.lider_id = ?");
    params.push(lider);
  }
  const casa = req.query.casa === "ninguna" ? "ninguna" : idOrNull(req.query.casa);
  if (casa === "ninguna") where.push("p.casa_amistad_id IS NULL");
  else if (casa) {
    where.push("p.casa_amistad_id = ?");
    params.push(casa);
  }

  let sql = `${PERSONA_SELECT} WHERE ${where.join(" AND ")}`;
  if (req.query.pendientes === "1") {
    sql = `SELECT * FROM (${sql}) t WHERE t.estado IN ('nuevo','en_seguimiento')
           AND (t.ultimo_contacto IS NULL OR t.ultimo_contacto < ?)
           ORDER BY COALESCE(t.ultimo_contacto, '0000') ASC, t.creado_en ASC`;
    params.push(restarDias(hoyDe(req), DIAS_PENDIENTE));
  } else {
    sql += " ORDER BY p.creado_en DESC, p.id DESC";
  }
  res.json(await all(sql, params));
});

api.get("/personas/:id", async (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id) throw new HttpError(404, "Persona no encontrada");
  await personaAccesible(me(res), id);
  const [persona, seguimientos, casa_propia] = await Promise.all([
    get(`${PERSONA_SELECT} WHERE p.id = ?`, [id]),
    all(
      `SELECT s.*, u.nombre AS usuario_nombre FROM seguimientos s
       LEFT JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.persona_id = ? ORDER BY s.fecha DESC, s.id DESC`,
      [id],
    ),
    get(
      `SELECT c.id, c.nombre, c.dia_reunion, c.hora,
         (SELECT COUNT(*) FROM personas x WHERE x.casa_amistad_id = c.id)::int AS total_personas
       FROM casas_amistad c WHERE c.anfitrion_id = ?`,
      [id],
    ),
  ]);
  res.json({ ...persona, casa_propia: casa_propia ?? null, seguimientos });
});

const ESTADOS = ["nuevo", "en_seguimiento", "integrado", "inactivo"];
const ETAPAS = ["ganado", "consolidacion", "escuela_formacion", "academia_lideres", "lanzado", "discipulado"];

async function parsePersona(b: Body) {
  const nombres = txt(b.nombres, 80);
  const apellidos = txt(b.apellidos, 80);
  if (!nombres || !apellidos) throw new HttpError(400, "Nombres y apellidos son obligatorios");
  if (b.origen !== "evangelismo" && b.origen !== "visitante") throw new HttpError(400, "Indica cómo llegó: evangelismo o visitante");
  const casa_amistad_id = idOrNull(b.casa_amistad_id);
  const lider_id = idOrNull(b.lider_id);
  if (casa_amistad_id && !(await get("SELECT id FROM casas_amistad WHERE id = ?", [casa_amistad_id])))
    throw new HttpError(400, "Casa de amistad no válida");
  if (lider_id && !(await get("SELECT id FROM usuarios WHERE id = ?", [lider_id]))) throw new HttpError(400, "Líder no válido");
  return {
    nombres,
    apellidos,
    telefono_casa: txt(b.telefono_casa, 30),
    telefono_personal: txt(b.telefono_personal, 30),
    direccion: txt(b.direccion, 250),
    zona: txt(b.zona, 80),
    origen: b.origen,
    invitado_por: txt(b.invitado_por, 120),
    fecha_llegada: isDate(b.fecha_llegada) ? b.fecha_llegada : null,
    casa_amistad_id,
    lider_id,
    ...estadoYEtapa(b),
    notas: txt(b.notas, 3000),
  };
}

/** Estado y, si es "integrado", su etapa (Ganado, En Consolidación, …). */
function estadoYEtapa(b: Body) {
  const estado = ESTADOS.includes(String(b.estado)) ? String(b.estado) : "nuevo";
  if (estado !== "integrado") return { estado, etapa: null };
  const etapa = ETAPAS.includes(String(b.etapa)) ? String(b.etapa) : "ganado";
  return { estado, etapa };
}

api.post("/personas", async (req, res) => {
  const d = await parsePersona(req.body ?? {});
  const row = await get<{ id: number }>(
    `INSERT INTO personas (nombres, apellidos, telefono_casa, telefono_personal, direccion, zona, origen,
       invitado_por, fecha_llegada, casa_amistad_id, lider_id, estado, etapa, notas, creado_por)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
    [d.nombres, d.apellidos, d.telefono_casa, d.telefono_personal, d.direccion, d.zona, d.origen as string,
     d.invitado_por, d.fecha_llegada ?? hoyDe(req), d.casa_amistad_id, d.lider_id, d.estado, d.etapa, d.notas, me(res).id],
  );
  res.status(201).json({ id: row?.id });
});

api.put("/personas/:id", async (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id) throw new HttpError(404, "Persona no encontrada");
  await personaAccesible(me(res), id);
  const d = await parsePersona(req.body ?? {});
  await all(
    `UPDATE personas SET nombres=?, apellidos=?, telefono_casa=?, telefono_personal=?, direccion=?, zona=?,
       origen=?, invitado_por=?, fecha_llegada=?, casa_amistad_id=?, lider_id=?, estado=?, etapa=?, notas=?,
       actualizado_en = now()
     WHERE id=?`,
    [d.nombres, d.apellidos, d.telefono_casa, d.telefono_personal, d.direccion, d.zona, d.origen as string,
     d.invitado_por, d.fecha_llegada, d.casa_amistad_id, d.lider_id, d.estado, d.etapa, d.notas, id],
  );
  res.json({ ok: true });
});

api.patch("/personas/:id/estado", async (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id) throw new HttpError(404, "Persona no encontrada");
  await personaAccesible(me(res), id);
  if (!ESTADOS.includes(String(req.body?.estado))) throw new HttpError(400, "Estado no válido");
  const { estado, etapa } = estadoYEtapa(req.body ?? {});
  await all("UPDATE personas SET estado=?, etapa=?, actualizado_en=now() WHERE id=?", [estado, etapa, id]);
  res.json({ ok: true });
});

api.delete("/personas/:id", adminOnly, async (req, res) => {
  // Sus seguimientos se borran en cascada; si era anfitrión de una casa, la casa queda sin anfitrión.
  await all("DELETE FROM personas WHERE id = ?", [idOrNull(req.params.id)]);
  res.json({ ok: true });
});

/* ───────────────────────── seguimientos (contactos / visitas) ───────────────────────── */

const TIPOS = ["visita", "llamada", "whatsapp", "reunion", "otro"];

api.post("/personas/:id/seguimientos", async (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id) throw new HttpError(404, "Persona no encontrada");
  await personaAccesible(me(res), id);
  const tipo = String(req.body?.tipo);
  if (!TIPOS.includes(tipo)) throw new HttpError(400, "Tipo de contacto no válido");
  const fecha = isDate(req.body?.fecha) ? req.body.fecha : hoyDe(req);
  await transaction(async (tx) => {
    await tx.query("INSERT INTO seguimientos (persona_id, tipo, fecha, observaciones, usuario_id) VALUES (?,?,?,?,?)", [
      id, tipo, fecha, txt(req.body?.observaciones, 3000), me(res).id,
    ]);
    // Al primer contacto, una persona "nueva" pasa a "en seguimiento".
    await tx.query("UPDATE personas SET estado='en_seguimiento', actualizado_en=now() WHERE id=? AND estado='nuevo'", [id]);
  });
  res.status(201).json({ ok: true });
});

api.delete("/seguimientos/:id", async (req, res) => {
  const id = idOrNull(req.params.id);
  const s = await get<{ usuario_id: number | null }>("SELECT usuario_id FROM seguimientos WHERE id = ?", [id]);
  if (!s) throw new HttpError(404, "Registro no encontrado");
  const u = me(res);
  if (!isAdmin(u) && s.usuario_id !== u.id) throw new HttpError(403, "Solo puedes borrar contactos que registraste tú");
  await all("DELETE FROM seguimientos WHERE id = ?", [id]);
  res.json({ ok: true });
});

/* ───────────────────────── resumen / dashboard ───────────────────────── */

api.get("/resumen", async (req, res) => {
  const s = scope(me(res));
  const hoy = hoyDe(req);
  const inicioMes = hoy.slice(0, 8) + "01";
  const limite = restarDias(hoy, DIAS_PENDIENTE);

  const base = `SELECT p.*,
      (SELECT MAX(x.fecha) FROM seguimientos x WHERE x.persona_id = p.id) AS ultimo_contacto
    FROM personas p WHERE ${s.sql}`;

  const [totales, contactosMes, pendientes, recientes, actividad, etapas] = await Promise.all([
    get<Record<string, number>>(
      `SELECT COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE origen = 'evangelismo')::int AS evangelismo,
         COUNT(*) FILTER (WHERE origen = 'visitante')::int   AS visitante,
         COUNT(*) FILTER (WHERE COALESCE(fecha_llegada, to_char(creado_en, 'YYYY-MM-DD')) >= ?)::int AS nuevos_mes,
         COUNT(*) FILTER (WHERE estado = 'nuevo')::int AS nuevo,
         COUNT(*) FILTER (WHERE estado = 'en_seguimiento')::int AS en_seguimiento,
         COUNT(*) FILTER (WHERE estado = 'integrado')::int AS integrado,
         COUNT(*) FILTER (WHERE estado = 'inactivo')::int AS inactivo,
         COUNT(*) FILTER (WHERE estado IN ('nuevo','en_seguimiento')
                            AND (ultimo_contacto IS NULL OR ultimo_contacto < ?))::int AS pendientes
       FROM (${base}) b`,
      [inicioMes, limite, ...s.params],
    ),
    get<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM seguimientos sg JOIN personas p ON p.id = sg.persona_id
       WHERE sg.fecha >= ? AND ${s.sql}`,
      [inicioMes, ...s.params],
    ),
    all(
      `SELECT t.id, t.nombres, t.apellidos, t.telefono_personal, t.telefono_casa, t.ultimo_contacto, t.fecha_llegada, t.estado
       FROM (${base}) t
       WHERE t.estado IN ('nuevo','en_seguimiento') AND (t.ultimo_contacto IS NULL OR t.ultimo_contacto < ?)
       ORDER BY COALESCE(t.ultimo_contacto, '0000') ASC, t.creado_en ASC LIMIT 6`,
      [...s.params, limite],
    ),
    all(
      `SELECT p.id, p.nombres, p.apellidos, p.origen, p.fecha_llegada, p.creado_en, p.invitado_por
       FROM personas p WHERE ${s.sql} ORDER BY p.creado_en DESC, p.id DESC LIMIT 6`,
      s.params,
    ),
    all(
      `SELECT sg.id, sg.tipo, sg.fecha, sg.observaciones, p.id AS persona_id, p.nombres, p.apellidos,
         us.nombre AS usuario_nombre
       FROM seguimientos sg JOIN personas p ON p.id = sg.persona_id
       LEFT JOIN usuarios us ON us.id = sg.usuario_id
       WHERE ${s.sql} ORDER BY sg.fecha DESC, sg.id DESC LIMIT 8`,
      s.params,
    ),
    all<{ etapa: string; n: number }>(
      `SELECT p.etapa, COUNT(*)::int AS n FROM personas p
       WHERE p.estado = 'integrado' AND p.etapa IS NOT NULL AND ${s.sql} GROUP BY p.etapa`,
      s.params,
    ),
  ]);

  res.json({
    ...totales,
    contactos_mes: contactosMes?.n ?? 0,
    dias_pendiente: DIAS_PENDIENTE,
    pendientes_lista: pendientes,
    recientes,
    actividad,
    etapas: Object.fromEntries(etapas.map((e) => [e.etapa, e.n])),
  });
});

/* ───────────────────────── errores ───────────────────────── */

api.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Ocurrió un error inesperado en el servidor" });
});
