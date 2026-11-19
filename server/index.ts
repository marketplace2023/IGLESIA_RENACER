/**
 * Servidor para tu computadora (`npm run dev` / `npm start`).
 * En Netlify no se usa: allí la API corre como función (netlify/functions/api.ts).
 */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { app } from "./app.ts";
import { ensureDb } from "./db.ts";

const PORT = Number(process.env.PORT ?? 3001);

// Si existe el build, también sirve la página (npm run build && npm start)
const DIST = path.resolve(process.cwd(), "dist");
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(DIST, "index.html"));
  });
}

await ensureDb();
app.listen(PORT, () => {
  console.log(`  ✔ API de Renacer escuchando en http://localhost:${PORT}`);
});
