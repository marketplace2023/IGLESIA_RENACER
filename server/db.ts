/**
 * Acceso a la base de datos (PostgreSQL).
 *
 * - Producción (Netlify): Neon, usando DATABASE_URL (o NETLIFY_DATABASE_URL si usas la integración Netlify DB).
 *   Las consultas normales van por HTTP (sin conexiones abiertas) y las transacciones por WebSocket.
 * - Desarrollo local sin DATABASE_URL: PGlite, un PostgreSQL embebido que guarda en ./data/pglite.
 *
 * El SQL se escribe con `?` como marcador y se traduce a `$1, $2…`.
 */
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type Param = string | number | boolean | null;
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: Param[]): Promise<T[]>;
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || "";

/** Convierte `?` en `$1, $2, …` (el SQL de la app no usa `?` dentro de textos). */
function pg(sql: string) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/* ───────────────────────── drivers ───────────────────────── */

type Driver = {
  query<T>(sql: string, params: Param[]): Promise<T[]>;
  transaction<R>(fn: (db: Db) => Promise<R>): Promise<R>;
};

function neonDriver(url: string): Driver {
  neonConfig.webSocketConstructor = ws;
  const http = neon(url);
  return {
    query: async <T>(sql: string, params: Param[]) => (await http.query(pg(sql), params)) as T[],
    async transaction(fn) {
      // Pool de vida corta: se abre y se cierra dentro de la misma petición (recomendado en serverless)
      const pool = new Pool({ connectionString: url });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const r = await fn({ query: async (sql, params = []) => (await client.query(pg(sql), params)).rows });
        await client.query("COMMIT");
        return r;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
        await pool.end();
      }
    },
  };
}

type PGliteLike = {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<R>(fn: (tx: { query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> }) => Promise<R>): Promise<R>;
};

async function pgliteDriver(): Promise<Driver> {
  // Import con nombre variable: así el empaquetador de Netlify no incluye PGlite en la función.
  const mod = "@electric-sql/pglite";
  const { PGlite } = (await import(/* @vite-ignore */ mod)) as { PGlite: { create(dir: string): Promise<PGliteLike> } };
  const dir = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "pglite");
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const db = await PGlite.create(dir);
  return {
    query: async <T>(sql: string, params: Param[]) => (await db.query<T>(pg(sql), params)).rows,
    transaction: (fn) =>
      db.transaction((tx) => fn({ query: async <T>(sql: string, params: Param[] = []) => (await tx.query<T>(pg(sql), params)).rows })),
  };
}

/* ───────────────────────── esquema ───────────────────────── */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS app_config (
     clave TEXT PRIMARY KEY,
     valor TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS usuarios (
     id            SERIAL PRIMARY KEY,
     nombre        TEXT NOT NULL,
     usuario       TEXT NOT NULL,
     telefono      TEXT,
     password_hash TEXT NOT NULL,
     rol           TEXT NOT NULL DEFAULT 'lider' CHECK (rol IN ('admin','lider')),
     activo        INTEGER NOT NULL DEFAULT 1,
     creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios (lower(usuario))`,
  `CREATE TABLE IF NOT EXISTS casas_amistad (
     id          SERIAL PRIMARY KEY,
     nombre      TEXT NOT NULL,
     direccion   TEXT,
     zona        TEXT,
     dia_reunion TEXT,
     hora        TEXT,
     lider_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
     creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS personas (
     id                SERIAL PRIMARY KEY,
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
     creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
     actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  // Persona cuyo hogar es la casa de amistad (se agrega después por la referencia circular)
  `ALTER TABLE casas_amistad ADD COLUMN IF NOT EXISTS anfitrion_id INTEGER REFERENCES personas(id) ON DELETE SET NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_casas_anfitrion ON casas_amistad (anfitrion_id) WHERE anfitrion_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS seguimientos (
     id            SERIAL PRIMARY KEY,
     persona_id    INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
     tipo          TEXT NOT NULL CHECK (tipo IN ('visita','llamada','whatsapp','reunion','otro')),
     fecha         TEXT NOT NULL,
     observaciones TEXT,
     usuario_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
     creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_personas_lider ON personas (lider_id)`,
  `CREATE INDEX IF NOT EXISTS idx_personas_casa  ON personas (casa_amistad_id)`,
  `CREATE INDEX IF NOT EXISTS idx_seg_persona    ON seguimientos (persona_id, fecha)`,
];

let driver: Driver | null = null;
let ready: Promise<void> | null = null;
let jwtSecret = "";

async function init() {
  if (!DATABASE_URL && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error(
      "Falta la conexión a Neon: define DATABASE_URL en Netlify (Site configuration → Environment variables) y vuelve a desplegar.",
    );
  }
  driver =DATABASE_URL ? neonDriver(DATABASE_URL) : await pgliteDriver();
  for (const stmt of SCHEMA) await driver.query(stmt, []);

  // Usuario administrador inicial
  const admin = await driver.query("SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1", []);
  if (!admin.length) {
    await driver.query(
      "INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?, ?, ?, 'admin') ON CONFLICT DO NOTHING",
      ["Administrador", "admin", bcrypt.hashSync("admin123", 10)],
    );
    console.log('  ✔ Usuario inicial creado → usuario: "admin"  contraseña: "admin123" (cámbiala al ingresar)');
  }

  // Clave para firmar sesiones: variable JWT_SECRET o, si no existe, una generada y guardada en la base
  if (process.env.JWT_SECRET) jwtSecret = process.env.JWT_SECRET;
  else {
    await driver.query("INSERT INTO app_config (clave, valor) VALUES ('jwt_secret', ?) ON CONFLICT (clave) DO NOTHING", [
      crypto.randomBytes(48).toString("hex"),
    ]);
    const [row] = await driver.query<{ valor: string }>("SELECT valor FROM app_config WHERE clave = 'jwt_secret'", []);
    jwtSecret = row.valor;
  }
  console.log(`  ✔ Base de datos lista (${DATABASE_URL ? "Neon" : "PGlite local en ./data/pglite"})`);
}

/** Prepara la base (una vez por proceso / arranque en frío de la función). */
export function ensureDb() {
  ready ??= init().catch((e) => {
    ready = null; // reintentar en la próxima petición
    throw e;
  });
  return ready;
}

export const getJwtSecret = () => jwtSecret;

const d = () => {
  if (!driver) throw new Error("Base de datos no inicializada");
  return driver;
};

/* ───────────────────────── API de consultas ───────────────────────── */

export const all = <T = Record<string, unknown>>(sql: string, params: Param[] = []) => d().query<T>(sql, params);

export const get = async <T = Record<string, unknown>>(sql: string, params: Param[] = []) =>
  (await d().query<T>(sql, params))[0] as T | undefined;

/** Ejecuta varias operaciones de forma atómica. */
export const transaction = <R>(fn: (db: Db) => Promise<R>) => d().transaction(fn);
