# Renacer · Registro y seguimiento

Aplicación para registrar a los visitantes y a las personas alcanzadas en evangelismo, y dar seguimiento
a sus contactos y visitas, sus casas de amistad y su líder asignado.

## Cómo funciona en internet

```
Navegador ──► Netlify (página + API como Netlify Function) ──► Neon (PostgreSQL)
```

- **No hay un servidor encendido todo el tiempo** (no se usa Render). La API es una *Netlify Function*:
  Netlify la ejecuta en cada petición y no hay nada que "se duerma".
- **El navegador nunca habla directo con la base de datos.** La contraseña de Neon vive solo en Netlify;
  si estuviera en la página, cualquiera podría leer o borrar todos los datos.
- La primera vez que se usa, la app **crea sola las tablas** y el usuario `admin` / `admin123`.

## Publicar en Netlify con Neon (una sola vez)

1. **Neon**: crea un proyecto en <https://neon.tech> → *Connection string* → copia la cadena
   (empieza con `postgresql://…`). Usa la que dice **Pooled connection**.
2. **Netlify**: <https://app.netlify.com> → *Add new site* → *Import an existing project* → GitHub →
   elige el repositorio `IGLESIA_RENACER`. Netlify lee `netlify.toml`, no hay que cambiar nada.
3. En Netlify → *Site configuration* → *Environment variables* → agrega:
   - `DATABASE_URL` = la cadena de Neon.
   - (Opcional) `JWT_SECRET` = un texto largo y aleatorio. Si no lo pones, la app genera uno y lo guarda en la base.
4. *Deploys* → *Trigger deploy*. Abre el sitio, entra con `admin` / `admin123` y **cambia la contraseña**.

> Alternativa: en Netlify → *Extensions* → **Neon** (Netlify DB) crea la base y la variable
> `NETLIFY_DATABASE_URL` automáticamente; la app también la reconoce.

Cada `git push` a `main` vuelve a publicar el sitio automáticamente.

## Trabajar en tu computadora

```bash
npm install
npm run dev        # API (puerto 3001) + interfaz (http://localhost:5173)
```

Sin `DATABASE_URL`, los datos se guardan en un PostgreSQL local (PGlite) dentro de `data/pglite`,
así no necesitas cuenta para probar. Para conectarte a Neon también desde tu computadora:

```bash
DATABASE_URL="postgresql://..." npm run dev
```

## Roles

| Rol | Puede |
|---|---|
| Administrador | Ver y editar todo, ajustar o eliminar casas de amistad, crear líderes/usuarios, eliminar personas |
| Líder | Registrar personas y contactos; ve las personas asignadas a él, las que registró y las de su casa de amistad |

## Flujo

1. **Registrar persona**: nombres, apellidos, teléfono de casa y personal, dirección y zona,
   cómo llegó (evangelismo o visitante), quién la invitó o contactó, líder y estado.
   - **¿Su hogar será casa de amistad?** Si se activa, su casa queda registrada como casa de amistad
     (con su dirección y zona, día y hora de reunión) y la persona es el anfitrión. Las casas no se crean aparte.
   - Si no, se elige la casa de amistad a la que asiste.
2. **Registrar contactos y visitas** desde la ficha de la persona: tipo (visita, llamada, WhatsApp,
   reunión, otro), fecha y observaciones. El primer contacto pasa a la persona de *Nuevo* a *En seguimiento*.
3. El **Inicio** muestra quién lleva más de 15 días sin contacto, los registros recientes y la actividad.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `src/` | Interfaz (React) |
| `server/app.ts` | La API (rutas, permisos, validaciones) |
| `server/db.ts` | Conexión a Neon / PGlite y creación de tablas |
| `netlify/functions/api.ts` | Envoltorio para que la API corra como Netlify Function |
| `server/index.ts` | Servidor local para `npm run dev` |

## Tecnología

React 19 + Vite + Tailwind 4 · componentes inspirados en **Magic UI** (Border Beam, Shimmer Button,
Number Ticker, Dot Pattern, Animated Gradient Text, Blur Fade) y **Aceternity UI** (Spotlight, Meteors,
inputs y tarjetas con brillo que sigue al mouse) · API Express en Netlify Functions · PostgreSQL en Neon
(driver `@neondatabase/serverless`) · sesión con cookie httpOnly + JWT · contraseñas con bcrypt.
