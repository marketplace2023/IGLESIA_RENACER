# Renacer · Registro y seguimiento

Aplicación para registrar a los visitantes y a las personas alcanzadas en evangelismo, y dar seguimiento
a sus contactos y visitas, sus casas de amistad y su líder asignado.

## Cómo usarla

```bash
npm install
npm run dev        # API (puerto 3001) + interfaz (http://localhost:5173)
```

La primera vez se crea el usuario **admin** con contraseña **admin123**. Cámbiala apenas entres
(menú de abajo a la izquierda → ícono de llave).

### Producción / uso en la red de la iglesia

```bash
npm run build
npm start          # sirve todo en http://localhost:3001 (o PORT=xxxx)
```

Variables opcionales: `PORT`, `DATA_DIR` (carpeta de la base de datos), `JWT_SECRET`,
`COOKIE_SECURE=true` (solo si se publica con HTTPS).

## Datos

- Todo se guarda en `data/renacer.db` (SQLite). **Haz copia de seguridad de la carpeta `data/`.**
- `data/jwt.secret` firma las sesiones; si se borra, todos deben volver a iniciar sesión.

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

## Tecnología

React 19 + Vite + Tailwind 4 · componentes inspirados en **Magic UI** (Border Beam, Shimmer Button,
Number Ticker, Dot Pattern, Animated Gradient Text, Blur Fade) y **Aceternity UI** (Spotlight, Meteors,
inputs y tarjetas con brillo que sigue al mouse) en `src/components/magicui` y `src/components/aceternity` ·
API Express + SQLite (sql.js, sin compilación nativa) · sesión con cookie httpOnly + JWT · contraseñas con bcrypt.
