import initSqlJs, { type Database, type SqlValue } from "sql.js";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
const DB_FILE = path.join(DATA_DIR, "renacer.db");

let db: Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  usuario       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  telefono      TEXT,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'lider' CHECK (rol IN ('admin','lider')),
  activo        INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS casas_amistad (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  direccion   TEXT,
  zona        TEXT,
  dia_reunion TEXT,
  hora        TEXT,
  lider_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS personas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nombres           TEXT NOT NULL,
  apellidos         TEXT NOT NULL,
  telefono_casa     TEXT,
  telefono_personal TEXT,
  direccion         TEXT,
  zona              TEXT,
  origen            TEXT NOT NULL CHECK (origen IN ('evangelismo','visitante')),
  invitado_por      TEXT,
  fecha_llegada     TEXT,
  casa_amistad_id   INTEGER REFERENCES casas_amistad(id) ON DELETE SET NULL,
  lider_id          INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  estado            TEXT NOT NULL DEFAULT 'nuevo'
                    CHECK (estado IN ('nuevo','en_seguimiento','integrado','inactivo')),
  notas             TEXT,
  creado_por        INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en         TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seguimientos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id    INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('visita','llamada','whatsapp','reunion','otro')),
  fecha         TEXT NOT NULL,
  observaciones TEXT,
  usuario_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_personas_lider  ON personas(lider_id);
CREATE INDEX IF NOT EXISTS idx_personas_casa   ON personas(casa_amistad_id);
CREATE INDEX IF NOT EXISTS idx_seg_persona     ON seguimientos(persona_id, fecha);
`;

export async function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrar();

  const admin = get("SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1");
  if (!admin) {
    run("INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?, ?, ?, 'admin')", [
      "Administrador",
      "admin",
      bcrypt.hashSync("admin123", 10),
    ]);
    console.log('\n  ✔ Usuario inicial creado → usuario: "admin"  contraseña: "admin123"');
    console.log("    Cámbiala apenas ingreses (menú → Cambiar contraseña).\n");
  }
  persist();
}

/** Cambios de esquema para bases creadas con versiones anteriores. */
function migrar() {
  const cols = all<{ name: string }>("PRAGMA table_info(casas_amistad)").map((c) => c.name);
  if (!cols.includes("anfitrion_id")) {
    // Persona cuyo hogar es la casa de amistad
    db.run("ALTER TABLE casas_amistad ADD COLUMN anfitrion_id INTEGER REFERENCES personas(id) ON DELETE SET NULL");
  }
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_casas_anfitrion ON casas_amistad(anfitrion_id) WHERE anfitrion_id IS NOT NULL");
}

/** Id de la última fila insertada (útil dentro de transaction). */
export function lastId() {
  return Number(db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] ?? 0);
}

/** Guarda la base en disco de forma atómica (archivo temporal + rename). */
function persist() {
  const data = db.export();
  // sql.js reabre la base al exportar y se pierden los PRAGMA; se vuelve a activar.
  db.run("PRAGMA foreign_keys = ON;");
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(data));
  fs.renameSync(tmp, DB_FILE);
}

type Params = SqlValue[];

export function all<T = Record<string, unknown>>(sql: string, params: Params = []): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

export function get<T = Record<string, unknown>>(sql: string, params: Params = []): T | undefined {
  return all<T>(sql, params)[0];
}

export function run(sql: string, params: Params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const id = lastId();
  persist();
  return { id, changes };
}

/** Ejecuta varias escrituras y guarda una sola vez. */
export function transaction(fn: () => void) {
  db.run("BEGIN");
  try {
    fn();
    db.run("COMMIT");
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
  persist();
}

/** Escritura sin persistir (para usar dentro de transaction). */
export function exec(sql: string, params: Params = []) {
  db.run(sql, params);
}
