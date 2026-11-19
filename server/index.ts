import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { SqlValue } from "sql.js";
import { DATA_DIR, all, exec, get, initDb, lastId, run, transaction } from "./db.ts";

await initDb();

const PORT = Number(process.env.PORT ?? 3001);
const COOKIE = "renacer_session";
const SESSION_DAYS = 7;
const SECRET = loadSecret();

type Rol = "admin" | "lider";
type SessionUser = { id: number; nombre: string; usuario: string; telefono: string | null; rol: Rol; activo: number };
type Body = Record<string, unknown>;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());

/* ───────────────────────── helpers ───────────────────────── */

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, "jwt.secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(file, secret);
  return secret;
}

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

function localISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localISO(d);
}

const DIAS_PENDIENTE = 15;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const me = (res: Response) => res.locals.user as SessionUser;
const isAdmin = (u: SessionUser) => u.rol === "admin";

/** Filtro SQL para que un líder solo vea a "sus" personas. */
function scope(u: SessionUser, alias = "p"): { sql: string; params: SqlValue[] } {
  if (isAdmin(u)) return { sql: "1=1", params: [] };
  return {
    sql: `(${alias}.lider_id = ? OR ${alias}.creado_por = ? OR ${alias}.casa_amistad_id IN (SELECT id FROM casas_amistad WHERE lider_id = ?))`,
    params: [u.id, u.id, u.id],
  };
}

function personaAccesible(u: SessionUser, id: number) {
  const s = scope(u);
  const p = get<{ id: number; creado_por: number | null }>(
    `SELECT p.id, p.creado_por FROM personas p WHERE p.id = ? AND ${s.sql}`,
    [id, ...s.params],
  );
  if (!p) throw new HttpError(404, "Persona no encontrada");
  return p;
}

/* ───────────────────────── auth ───────────────────────── */

function setSession(res: Response, userId: number) {
  const token = jwt.sign({ id: userId }, SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: "No autenticado" });
  try {
    const payload = jwt.verify(token, SECRET) as { id: number };
    const user = get<SessionUser>(
      "SELECT id, nombre, usuario, telefono, rol, activo FROM usuarios WHERE id = ?",
      [payload.id],
    );
    if (!user || !user.activo) {
      res.clearCookie(COOKIE, { path: "/" });
      return res.status(401).json({ error: "Sesión no válida" });
    }
    res.locals.user = user;
    next();
  } catch {
    res.clearCookie(COOKIE, { path: "/" });
    return res.status(401).json({ error: "Sesión expirada" });
  }
}

function adminOnly(_req: Request, res: Response, next: NextFunction) {
  if (!isAdmin(me(res))) return res.status(403).json({ error: "Solo un administrador puede hacer esto" });
  next();
}

// Limitador simple de intentos de login por IP
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

app.post("/api/auth/login", (req, res) => {
  const ip = req.ip ?? "?";
  if (demasiadosIntentos(ip))
    return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos e inténtalo otra vez." });

  const usuario = txt(req.body?.usuario, 60);
  const password = String(req.body?.password ?? "");
  const u = usuario
    ? get<SessionUser & { password_hash: string }>("SELECT * FROM usuarios WHERE usuario = ?", [usuario])
    : undefined;

  if (!u || !bcrypt.compareSync(password, u.password_hash)) {
    registrarFallo(ip);
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }
  if (!u.activo) return res.status(403).json({ error: "Tu usuario está desactivado. Habla con un administrador." });

  intentos.delete(ip);
  setSession(res, u.id);
  const { password_hash: _omit, ...user } = u;
  void _omit;
  res.json({ user });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
});

app.use("/api", auth);

app.get("/api/auth/me", (_req, res) => res.json({ user: me(res) }));

app.put("/api/auth/password", (req, res) => {
  const actual = String(req.body?.actual ?? "");
  const nueva = String(req.body?.nueva ?? "");
  if (nueva.length < 6) throw new HttpError(400, "La nueva contraseña debe tener al menos 6 caracteres");
  const row = get<{ password_hash: string }>("SELECT password_hash FROM usuarios WHERE id = ?", [me(res).id]);
  if (!row || !bcrypt.compareSync(actual, row.password_hash))
    throw new HttpError(400, "La contraseña actual no es correcta");
  run("UPDATE usuarios SET password_hash = ? WHERE id = ?", [bcrypt.hashSync(nueva, 10), me(res).id]);
  res.json({ ok: true });
});

/* ───────────────────────── usuarios / líderes ───────────────────────── */

app.get("/api/lideres", (_req, res) => {
  res.json(all("SELECT id, nombre, rol FROM usuarios WHERE activo = 1 ORDER BY nombre"));
});

app.get("/api/usuarios", adminOnly, (_req, res) => {
  res.json(
    all(`
      SELECT u.id, u.nombre, u.usuario, u.telefono, u.rol, u.activo, u.creado_en,
        (SELECT COUNT(*) FROM personas p WHERE p.lider_id = u.id) AS total_personas,
        (SELECT COUNT(*) FROM casas_amistad c WHERE c.lider_id = u.id) AS total_casas
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
  if (!creando && password && password.length < 6)
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
  return { nombre, usuario, rol, password, telefono: txt(b.telefono, 30), activo: b.activo === false ? 0 : 1 };
}

const uniqueError = (e: unknown) => e instanceof Error && /UNIQUE/i.test(e.message);

app.post("/api/usuarios", adminOnly, (req, res) => {
  const d = parseUsuario(req.body ?? {}, true);
  try {
    const { id } = run(
      "INSERT INTO usuarios (nombre, usuario, telefono, password_hash, rol, activo) VALUES (?,?,?,?,?,?)",
      [d.nombre, d.usuario, d.telefono, bcrypt.hashSync(d.password, 10), d.rol, d.activo],
    );
    res.status(201).json({ id });
  } catch (e) {
    if (uniqueError(e)) throw new HttpError(409, "Ese nombre de usuario ya existe");
    throw e;
  }
});

app.put("/api/usuarios/:id", adminOnly, (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id || !get("SELECT id FROM usuarios WHERE id = ?", [id])) throw new HttpError(404, "Usuario no encontrado");
  const d = parseUsuario(req.body ?? {}, false);
  if (id === me(res).id && (d.rol !== "admin" || !d.activo))
    throw new HttpError(400, "No puedes quitarte el rol de administrador ni desactivarte a ti mismo");
  try {
    run("UPDATE usuarios SET nombre=?, usuario=?, telefono=?, rol=?, activo=? WHERE id=?", [
      d.nombre, d.usuario, d.telefono, d.rol, d.activo, id,
    ]);
    if (d.password) run("UPDATE usuarios SET password_hash=? WHERE id=?", [bcrypt.hashSync(d.password, 10), id]);
    res.json({ ok: true });
  } catch (e) {
    if (uniqueError(e)) throw new HttpError(409, "Ese nombre de usuario ya existe");
    throw e;
  }
});

app.delete("/api/usuarios/:id", adminOnly, (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id) throw new HttpError(404, "Usuario no encontrado");
  if (id === me(res).id) throw new HttpError(400, "No puedes eliminar tu propio usuario");
  transaction(() => {
    exec("UPDATE personas SET lider_id = NULL WHERE lider_id = ?", [id]);
    exec("UPDATE personas SET creado_por = NULL WHERE creado_por = ?", [id]);
    exec("UPDATE casas_amistad SET lider_id = NULL WHERE lider_id = ?", [id]);
    exec("UPDATE seguimientos SET usuario_id = NULL WHERE usuario_id = ?", [id]);
    exec("DELETE FROM usuarios WHERE id = ?", [id]);
  });
  res.json({ ok: true });
});

/* ───────────────────────── casas de amistad ───────────────────────── */

// Las casas de amistad NO se crean aparte: nacen al registrar (o editar) a una persona
// marcando que su hogar será casa de amistad. Aquí solo se listan, ajustan y eliminan.
app.get("/api/casas", (_req, res) => {
  res.json(
    all(`
      SELECT c.*, u.nombre AS lider_nombre,
        a.nombres || ' ' || a.apellidos AS anfitrion_nombre,
        COALESCE(a.telefono_personal, a.telefono_casa) AS anfitrion_telefono,
        (SELECT COUNT(*) FROM personas p WHERE p.casa_amistad_id = c.id) AS total_personas
      FROM casas_amistad c
      LEFT JOIN usuarios u ON u.id = c.lider_id
      LEFT JOIN personas a ON a.id = c.anfitrion_id
      ORDER BY c.nombre`),
  );
});

app.put("/api/casas/:id", adminOnly, (req, res) => {
  const id = idOrNull(req.params.id);
  const b: Body = req.body ?? {};
  const nombre = txt(b.nombre, 100);
  if (!nombre) throw new HttpError(400, "El nombre de la casa de amistad es obligatorio");
  const lider_id = idOrNull(b.lider_id);
  if (lider_id && !get("SELECT id FROM usuarios WHERE id = ?", [lider_id])) throw new HttpError(400, "Líder no válido");
  // Dirección y zona vienen del hogar del anfitrión (se editan en la ficha de la persona)
  const { changes } = run("UPDATE casas_amistad SET nombre=?, dia_reunion=?, hora=?, lider_id=? WHERE id=?", [
    nombre, txt(b.dia_reunion, 30), txt(b.hora, 10), lider_id, id,
  ]);
  if (!changes) throw new HttpError(404, "Casa de amistad no encontrada");
  res.json({ ok: true });
});

app.delete("/api/casas/:id", adminOnly, (req, res) => {
  const id = idOrNull(req.params.id);
  transaction(() => {
    exec("UPDATE personas SET casa_amistad_id = NULL WHERE casa_amistad_id = ?", [id]);
    exec("DELETE FROM casas_amistad WHERE id = ?", [id]);
  });
  res.json({ ok: true });
});

/* ───────────────────────── personas ───────────────────────── */

const PERSONA_SELECT = `
  SELECT p.*, u.nombre AS lider_nombre, c.nombre AS casa_nombre, cr.nombre AS creado_por_nombre,
    (SELECT MAX(s.fecha) FROM seguimientos s WHERE s.persona_id = p.id) AS ultimo_contacto,
    (SELECT COUNT(*)     FROM seguimientos s WHERE s.persona_id = p.id) AS total_contactos,
    (SELECT ch.id FROM casas_amistad ch WHERE ch.anfitrion_id = p.id) AS casa_propia_id
  FROM personas p
  LEFT JOIN usuarios u       ON u.id  = p.lider_id
  LEFT JOIN usuarios cr      ON cr.id = p.creado_por
  LEFT JOIN casas_amistad c  ON c.id  = p.casa_amistad_id`;

app.get("/api/personas", (req, res) => {
  const u = me(res);
  const s = scope(u);
  const where = [s.sql];
  const params: SqlValue[] = [...s.params];
  const q = txt(req.query.q, 80);

  if (q) {
    const like = `%${q}%`;
    where.push(
      "((p.nombres || ' ' || p.apellidos) LIKE ? OR p.telefono_personal LIKE ? OR p.telefono_casa LIKE ? OR p.zona LIKE ? OR p.direccion LIKE ? OR p.invitado_por LIKE ?)",
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
           AND (t.ultimo_contacto IS NULL OR t.ultimo_contacto < ?)`;
    params.push(daysAgoISO(DIAS_PENDIENTE));
    sql += " ORDER BY COALESCE(t.ultimo_contacto, '0000') ASC, t.creado_en ASC";
  } else {
    sql += " ORDER BY p.creado_en DESC, p.id DESC";
  }
  res.json(all(sql, params));
});

app.get("/api/personas/:id", (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id) throw new HttpError(404, "Persona no encontrada");
  personaAccesible(me(res), id);
  const persona = get(`${PERSONA_SELECT} WHERE p.id = ?`, [id]);
  const seguimientos = all(
    `SELECT s.*, u.nombre AS usuario_nombre FROM seguimientos s
     LEFT JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.persona_id = ? ORDER BY s.fecha DESC, s.id DESC`,
    [id],
  );
  const casa_propia =
    get(
      `SELECT c.id, c.nombre, c.dia_reunion, c.hora,
         (SELECT COUNT(*) FROM personas x WHERE x.casa_amistad_id = c.id) AS total_personas
       FROM casas_amistad c WHERE c.anfitrion_id = ?`,
      [id],
    ) ?? null;
  res.json({ ...persona, casa_propia, seguimientos });
});

const ESTADOS = ["nuevo", "en_seguimiento", "integrado", "inactivo"];

function parsePersona(b: Body) {
  const nombres = txt(b.nombres, 80);
  const apellidos = txt(b.apellidos, 80);
  if (!nombres || !apellidos) throw new HttpError(400, "Nombres y apellidos son obligatorios");
  if (b.origen !== "evangelismo" && b.origen !== "visitante")
    throw new HttpError(400, "Indica cómo llegó: evangelismo o visitante");
  const telefono_casa = txt(b.telefono_casa, 30);
  const telefono_personal = txt(b.telefono_personal, 30);
  const estado = ESTADOS.includes(String(b.estado)) ? String(b.estado) : "nuevo";
  const fecha_llegada = isDate(b.fecha_llegada) ? b.fecha_llegada : null;
  const casa_amistad_id = idOrNull(b.casa_amistad_id);
  const lider_id = idOrNull(b.lider_id);
  if (casa_amistad_id && !get("SELECT id FROM casas_amistad WHERE id = ?", [casa_amistad_id]))
    throw new HttpError(400, "Casa de amistad no válida");
  if (lider_id && !get("SELECT id FROM usuarios WHERE id = ?", [lider_id])) throw new HttpError(400, "Líder no válido");
  return {
    nombres, apellidos, telefono_casa, telefono_personal,
    direccion: txt(b.direccion, 250), zona: txt(b.zona, 80), origen: b.origen,
    invitado_por: txt(b.invitado_por, 120), fecha_llegada, casa_amistad_id, lider_id, estado,
    notas: txt(b.notas, 3000),
  };
}

type PersonaData = ReturnType<typeof parsePersona>;
type CasaPropia = { nombre: string; dia_reunion: string | null; hora: string | null } | null;

/** Datos de "su hogar será casa de amistad" (null si el interruptor está apagado). */
function parseCasaPropia(b: Body, d: PersonaData): CasaPropia {
  const c = (b.casa_propia ?? null) as Body | null;
  if (!c || c.activa !== true) return null;
  if (!d.direccion) throw new HttpError(400, "Para registrar su hogar como casa de amistad, escribe la dirección");
  return {
    nombre: txt(c.nombre, 100) ?? `Casa de ${d.nombres} ${d.apellidos}`,
    dia_reunion: txt(c.dia_reunion, 30),
    hora: txt(c.hora, 10),
  };
}

/** Crea, actualiza o elimina la casa de amistad del hogar de la persona (usar dentro de transaction). */
function guardarCasaPropia(personaId: number, d: PersonaData, casa: CasaPropia) {
  const existente = get<{ id: number }>("SELECT id FROM casas_amistad WHERE anfitrion_id = ?", [personaId]);
  if (casa) {
    let casaId: number;
    if (existente) {
      casaId = existente.id;
      exec(
        "UPDATE casas_amistad SET nombre=?, direccion=?, zona=?, dia_reunion=?, hora=?, lider_id=COALESCE(lider_id, ?) WHERE id=?",
        [casa.nombre, d.direccion, d.zona, casa.dia_reunion, casa.hora, d.lider_id, casaId],
      );
    } else {
      exec(
        "INSERT INTO casas_amistad (nombre, direccion, zona, dia_reunion, hora, lider_id, anfitrion_id) VALUES (?,?,?,?,?,?,?)",
        [casa.nombre, d.direccion, d.zona, casa.dia_reunion, casa.hora, d.lider_id, personaId],
      );
      casaId = lastId();
    }
    // El anfitrión pertenece a su propia casa de amistad
    exec("UPDATE personas SET casa_amistad_id=? WHERE id=?", [casaId, personaId]);
  } else if (existente) {
    // Se apagó el interruptor: la casa deja de existir y sus miembros quedan sin casa
    exec("UPDATE personas SET casa_amistad_id = NULL WHERE casa_amistad_id = ?", [existente.id]);
    exec("DELETE FROM casas_amistad WHERE id = ?", [existente.id]);
  }
}

app.post("/api/personas", (req, res) => {
  const d = parsePersona(req.body ?? {});
  const casa = parseCasaPropia(req.body ?? {}, d);
  let id = 0;
  transaction(() => {
    exec(
      `INSERT INTO personas (nombres, apellidos, telefono_casa, telefono_personal, direccion, zona, origen,
         invitado_por, fecha_llegada, casa_amistad_id, lider_id, estado, notas, creado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.nombres, d.apellidos, d.telefono_casa, d.telefono_personal, d.direccion, d.zona, d.origen,
       d.invitado_por, d.fecha_llegada ?? localISO(), d.casa_amistad_id, d.lider_id, d.estado, d.notas, me(res).id],
    );
    id = lastId();
    guardarCasaPropia(id, d, casa);
  });
  res.status(201).json({ id });
});

app.put("/api/personas/:id", (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id) throw new HttpError(404, "Persona no encontrada");
  personaAccesible(me(res), id);
  const d = parsePersona(req.body ?? {});
  const casa = parseCasaPropia(req.body ?? {}, d);
  transaction(() => {
    exec(
      `UPDATE personas SET nombres=?, apellidos=?, telefono_casa=?, telefono_personal=?, direccion=?, zona=?,
         origen=?, invitado_por=?, fecha_llegada=?, casa_amistad_id=?, lider_id=?, estado=?, notas=?,
         actualizado_en = datetime('now')
       WHERE id=?`,
      [d.nombres, d.apellidos, d.telefono_casa, d.telefono_personal, d.direccion, d.zona, d.origen,
       d.invitado_por, d.fecha_llegada, d.casa_amistad_id, d.lider_id, d.estado, d.notas, id],
    );
    guardarCasaPropia(id, d, casa);
  });
  res.json({ ok: true });
});

app.patch("/api/personas/:id/estado", (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id) throw new HttpError(404, "Persona no encontrada");
  personaAccesible(me(res), id);
  const estado = String(req.body?.estado);
  if (!ESTADOS.includes(estado)) throw new HttpError(400, "Estado no válido");
  run("UPDATE personas SET estado=?, actualizado_en=datetime('now') WHERE id=?", [estado, id]);
  res.json({ ok: true });
});

app.delete("/api/personas/:id", adminOnly, (req, res) => {
  const id = idOrNull(req.params.id);
  transaction(() => {
    exec("DELETE FROM seguimientos WHERE persona_id = ?", [id]);
    // Si su hogar era casa de amistad, la casa se elimina y sus miembros quedan sin casa
    exec(
      "UPDATE personas SET casa_amistad_id = NULL WHERE casa_amistad_id IN (SELECT id FROM casas_amistad WHERE anfitrion_id = ?)",
      [id],
    );
    exec("DELETE FROM casas_amistad WHERE anfitrion_id = ?", [id]);
    exec("DELETE FROM personas WHERE id = ?", [id]);
  });
  res.json({ ok: true });
});

/* ───────────────────────── seguimientos (contactos / visitas) ───────────────────────── */

const TIPOS = ["visita", "llamada", "whatsapp", "reunion", "otro"];

app.post("/api/personas/:id/seguimientos", (req, res) => {
  const id = idOrNull(req.params.id);
  if (!id) throw new HttpError(404, "Persona no encontrada");
  personaAccesible(me(res), id);
  const tipo = String(req.body?.tipo);
  if (!TIPOS.includes(tipo)) throw new HttpError(400, "Tipo de contacto no válido");
  const fecha = isDate(req.body?.fecha) ? req.body.fecha : localISO();
  transaction(() => {
    exec("INSERT INTO seguimientos (persona_id, tipo, fecha, observaciones, usuario_id) VALUES (?,?,?,?,?)", [
      id, tipo, fecha, txt(req.body?.observaciones, 3000), me(res).id,
    ]);
    // Al primer contacto, una persona "nueva" pasa a "en seguimiento".
    exec("UPDATE personas SET estado='en_seguimiento', actualizado_en=datetime('now') WHERE id=? AND estado='nuevo'", [id]);
  });
  res.status(201).json({ ok: true });
});

app.delete("/api/seguimientos/:id", (req, res) => {
  const id = idOrNull(req.params.id);
  const s = get<{ persona_id: number; usuario_id: number | null }>(
    "SELECT persona_id, usuario_id FROM seguimientos WHERE id = ?",
    [id],
  );
  if (!s) throw new HttpError(404, "Registro no encontrado");
  const u = me(res);
  if (!isAdmin(u) && s.usuario_id !== u.id) throw new HttpError(403, "Solo puedes borrar contactos que registraste tú");
  run("DELETE FROM seguimientos WHERE id = ?", [id]);
  res.json({ ok: true });
});

/* ───────────────────────── resumen / dashboard ───────────────────────── */

app.get("/api/resumen", (_req, res) => {
  const u = me(res);
  const s = scope(u);
  const inicioMes = localISO().slice(0, 8) + "01";
  const limite = daysAgoISO(DIAS_PENDIENTE);

  const base = `SELECT p.*,
      (SELECT MAX(x.fecha) FROM seguimientos x WHERE x.persona_id = p.id) AS ultimo_contacto
    FROM personas p WHERE ${s.sql}`;

  const totales = get<Record<string, number>>(
    `SELECT COUNT(*) AS total,
       SUM(origen = 'evangelismo') AS evangelismo,
       SUM(origen = 'visitante')   AS visitante,
       SUM(COALESCE(fecha_llegada, substr(creado_en,1,10)) >= ?) AS nuevos_mes,
       SUM(estado = 'nuevo') AS nuevo,
       SUM(estado = 'en_seguimiento') AS en_seguimiento,
       SUM(estado = 'integrado') AS integrado,
       SUM(estado = 'inactivo') AS inactivo,
       SUM(estado IN ('nuevo','en_seguimiento') AND (ultimo_contacto IS NULL OR ultimo_contacto < ?)) AS pendientes
     FROM (${base})`,
    [inicioMes, limite, ...s.params],
  );

  const contactosMes = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM seguimientos sg JOIN personas p ON p.id = sg.persona_id
     WHERE sg.fecha >= ? AND ${s.sql}`,
    [inicioMes, ...s.params],
  );

  const pendientes = all(
    `SELECT t.id, t.nombres, t.apellidos, t.telefono_personal, t.telefono_casa, t.ultimo_contacto, t.fecha_llegada, t.estado
     FROM (${base}) t
     WHERE t.estado IN ('nuevo','en_seguimiento') AND (t.ultimo_contacto IS NULL OR t.ultimo_contacto < ?)
     ORDER BY COALESCE(t.ultimo_contacto, '0000') ASC, t.creado_en ASC LIMIT 6`,
    [...s.params, limite],
  );

  const recientes = all(
    `SELECT p.id, p.nombres, p.apellidos, p.origen, p.fecha_llegada, p.creado_en, p.invitado_por
     FROM personas p WHERE ${s.sql} ORDER BY p.creado_en DESC, p.id DESC LIMIT 6`,
    s.params,
  );

  const actividad = all(
    `SELECT sg.id, sg.tipo, sg.fecha, sg.observaciones, p.id AS persona_id, p.nombres, p.apellidos,
       us.nombre AS usuario_nombre
     FROM seguimientos sg JOIN personas p ON p.id = sg.persona_id
     LEFT JOIN usuarios us ON us.id = sg.usuario_id
     WHERE ${s.sql} ORDER BY sg.fecha DESC, sg.id DESC LIMIT 8`,
    s.params,
  );

  // Normaliza los SUM nulos (tabla vacía) a 0
  const t = Object.fromEntries(Object.entries(totales ?? {}).map(([k, v]) => [k, Number(v ?? 0)]));
  res.json({ ...t, contactos_mes: contactosMes?.n ?? 0, dias_pendiente: DIAS_PENDIENTE, pendientes_lista: pendientes, recientes, actividad });
});

/* ───────────────────────── errores y frontend ───────────────────────── */

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

const DIST = path.resolve(process.cwd(), "dist");
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(DIST, "index.html"));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Ocurrió un error inesperado en el servidor" });
});

app.listen(PORT, () => {
  console.log(`  ✔ API de Renacer escuchando en http://localhost:${PORT}`);
});
