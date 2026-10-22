# Worker de Brelio

API y servidor de recursos. JavaScript plano (módulos ES), sin framework.

```
index.js          router + login opcional
auth.js           Access (JWT) / clave de grupo / dev
http.js           JSON y errores
routes/           players.js, media.js (incluye GET /media/*), matches.js
test/             tests con @cloudflare/vitest-plugin (D1 y R2 locales)
```

## Autenticación

Se elige con la variable `AUTH_MODE` (`access` | `key` | `dev`). Si está vacía es automático:
`ACCESS_AUD` relleno → `access`; secreto `GROUP_KEY` definido → `key`; si no → `dev` (abierto, solo para local).

| Modo | Cómo entra | Usuario |
|---|---|---|
| `access` | Cabecera `Cf-Access-Jwt-Assertion` (RS256), validada contra `https://$ACCESS_TEAM/cdn-cgi/access/certs`; se comprueban `aud`, `iss` y `exp` | email del JWT |
| `key` | Cabecera `X-Group-Key` o cookie `brelio_key` igual a `GROUP_KEY` | `X-User-Name` o `grupo` |
| `dev` | Todo permitido | `dev` |

En modo `key`, `POST /api/login {key}` comprueba la clave y deja la cookie `brelio_key` (HttpOnly), que hace falta para que `<audio>` e `<img>` puedan pedir `/media/*`.
Sin credenciales: `401 {"error": "..."}`.

## Endpoints

Errores siempre como `{"error": "mensaje"}` (400 entrada mala, 401, 404, 405, 413, 415).

| Ruta | Qué hace |
|---|---|
| `GET /api/me` | `{user, mode}` |
| `GET /api/players` | lista ordenada por nombre |
| `POST /api/players` | `{name, photo_key?}` → 201 |
| `PATCH /api/players/:id` | `{name?, photo_key?}` (`photo_key: null` quita la foto) |
| `DELETE /api/players/:id` | borra |
| `GET /api/media?folder=x` | recursos, más nuevos primero, con `url: "/media/<clave>"` |
| `POST /api/media` | multipart: `file` (uno o varios), `folder`, `name?` (solo con un fichero). Solo `image/*`, `audio/*`, `video/*`, máx. 40 MB. Clave: `carpeta/nombre-abc12.ext`. Devuelve las filas creadas |
| `PUT /api/media/<clave>` | reemplaza el contenido bajo la misma clave (cuerpo crudo con su `Content-Type`, o multipart con `file`) |
| `DELETE /api/media/<clave>` | borra de R2 y D1 (y quita esa foto a los jugadores que la usaban) |
| `GET /media/<clave>` | sirve desde R2: `ETag`, `If-None-Match` → 304, `Range` → 206, caché de 1 año |
| `GET /api/matches?limit=50` | historial, más nuevo primero (`teams` ya parseado) |
| `POST /api/matches` | `{animation, teams}` → 201 |
| `PATCH /api/matches/:id` | `{winner}` entero (índice de equipo) o `null` |

Nota: como `/media/*` es `immutable`, si reemplazas un recurso (`PUT`) los navegadores que ya lo tengan en caché no lo verán cambiar hasta un año después; para forzarlo añade algo a la URL (`?v=...`) o sube con otra clave.

## Local

```sh
cd worker
npm install
npm test              # tests (modos dev y key, JWT de Access simulado)
npm run db:local      # aplica ../schema.sql a la D1 local (.wrangler/state)
npm run dev           # wrangler dev; necesita ../dist (build de la web) por los assets
```

Sin `GROUP_KEY` ni `ACCESS_AUD`, el modo es `dev` y no pide nada. Para probar el modo clave en local:
crea `worker/.dev.vars` con `GROUP_KEY=loquesea`.

## Alta en Cloudflare (una sola vez, la hace el dueño)

1. `npx wrangler r2 bucket create brelio-media`
2. `npx wrangler d1 create brelio` → pegar el `database_id` en `../wrangler.jsonc`, y
   `npx wrangler d1 execute brelio --remote --file ../schema.sql`
3. Conectar el repo en **Workers Builds** (`main` → producción, ramas → previews).
4. Dominio propio + aplicación de **Access** con los emails del grupo. Rellenar en `wrangler.jsonc`
   `ACCESS_TEAM` (`<equipo>.cloudflareaccess.com`) y `ACCESS_AUD` (AUD tag de la app).
   - Alternativa sin Access: `npx wrangler secret put GROUP_KEY` (y dejar `ACCESS_AUD` vacío).
5. `workers_dev` está en `false`: no hay acceso por `*.workers.dev`.
