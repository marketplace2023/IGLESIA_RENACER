/**
 * Netlify Function: toda la API (/api/*) corre aquí.
 * No es un servidor encendido todo el tiempo: Netlify la ejecuta en cada petición.
 * Los datos se guardan en Neon (variable de entorno DATABASE_URL o NETLIFY_DATABASE_URL).
 */
import serverless from "serverless-http";
import { app } from "../../server/app.ts";

export const handler = serverless(app);
