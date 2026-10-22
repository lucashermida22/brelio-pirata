# Arquitectura: Brelio entre amigos

> Estado: **propuesta**. Hoy Brelio es un único `index.html` generado por los scripts de `build/`.

Brelio lo usamos y lo hacemos un grupo de amigos, así que el objetivo es **cero fricción**:
- el **código** está en GitHub y cualquiera del grupo lo cambia sin pedir permiso;
- los **recursos** (canciones, fotos, imágenes) se suben desde la propia web a **R2**, sin pasar por git ni por revisiones;
- lo **compartido** (jugadores, fotos asignadas, historial de pachangas) vive en **D1**;
- todo se despliega con **Cloudflare Workers**.

```
 GitHub (código) ──push──▶ Workers Builds ──▶ Worker "brelio"
                                               ├─ sirve la web (static assets)
 Amigo en la web ──subir──▶ /api/media ───────▶ R2  (canciones, fotos, imágenes)
                  ──jugar──▶ /api/*  ──────────▶ D1  (jugadores, pachangas, ganadores)
 Cloudflare Access delante de todo: solo entran los emails del grupo
```

## 1. Código en GitHub

- Todos los amigos como **colaboradores** del repo, con permiso de escritura.
- Cada uno trabaja en una rama; **Workers Builds** le da una URL de preview para enseñarlo al grupo.
- Cuando le guste, lo mezcla él mismo en `main` → se despliega solo. Sin revisiones obligatorias.

Para que no haya conflictos, cada animación es una carpeta independiente:

```
app/                 # la web: generador de equipos, LOL, fotos, versus, botón «Ganador», página «Recursos»
animations/
  furious/index.js   # export default { label, song, play(ctx) }
  jojo/index.js
  …
worker/index.js      # API + servir R2
schema.sql           # tablas de D1
wrangler.jsonc
```

Una animación solo necesita exportar esto:

```js
export default {
  label: 'Fast & Furious',
  song: 'furious/last_ride.mp3',      // clave en R2: se cambia desde la web sin tocar código
  async play(ctx) {
    // ctx.teams, ctx.win, ctx.stage (<div>), ctx.three(), ctx.media('furious/paul.jpg'),
    // ctx.song, ctx.later(fn, ms), ctx.onType('mati', fn), ctx.done(), ctx.close()
  },
};
```

El selector de animaciones se genera solo con lo que haya en `animations/`.

## 2. Recursos en R2 (sin revisión)

Página **«Recursos»** dentro de la web:
1. Arrastras un mp3, jpg, png, gif o webm.
2. Eliges la carpeta (`furious`, `jugadores`, `comun`…), o la creas.
3. Se sube al momento y te da la clave (`furious/last_ride.mp3`) con un botón de copiar, y una vista previa (se escucha o se ve).

Además, en la lista de jugadores, **tocar un avatar → «Subir foto»** sube la foto a R2 y la deja asignada para todo el grupo.

Cómo funciona por debajo:
- `POST /api/media`: el Worker recibe el fichero, lo guarda en R2 con la clave `carpeta/nombre-abc12.ext` y apunta en D1 quién lo subió.
- `GET /media/<clave>`: el Worker lo sirve desde R2, con caché larga.
- `DELETE /api/media/<clave>`: cualquiera del grupo puede borrar o reemplazar.

Nadie tiene que revisar nada: si alguien está dentro de la web, puede subir.

## 3. Quién puede entrar: Cloudflare Access

- Una aplicación de Access delante del dominio, con la lista de emails del grupo.
- Login con código de un solo uso al email: nada de contraseñas que repartir.
- El Worker lee el email del usuario de la cabecera que añade Access, verificando el token `Cf-Access-Jwt-Assertion`. Así sabemos quién subió cada cosa o creó cada pachanga.
- Desactivar la URL `*.workers.dev` para que no se pueda entrar sin pasar por Access.

> Alternativa aún más simple: una **clave del grupo** guardada como secreto del Worker y pedida una vez en la web.
> Funciona, pero no sabes quién subió qué.

## 4. Datos compartidos en D1

```sql
-- schema.sql
CREATE TABLE players (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  photo_key  TEXT,                 -- clave en R2
  created_by TEXT,
  created_at INTEGER
);
CREATE TABLE media (
  key         TEXT PRIMARY KEY,    -- carpeta/nombre-abc12.ext
  folder      TEXT,
  type        TEXT,                -- audio/mpeg, image/jpeg…
  size        INTEGER,
  uploaded_by TEXT,
  created_at  INTEGER
);
CREATE TABLE matches (
  id         TEXT PRIMARY KEY,
  played_at  INTEGER,
  animation  TEXT,
  teams      TEXT,                 -- JSON con equipos, miembros, roles LOL y capitanes
  winner     INTEGER,              -- índice del equipo ganador (NULL si no se eligió)
  created_by TEXT
);
```

Qué ganamos:
- la lista de jugadores y sus fotos es la misma para todos (hoy está en el `localStorage` de cada uno);
- **historial**: quién ganó cada pachanga, rachas, quién es el que más pierde…;
- la repetición del ganador se puede ver otro día desde el historial.

API mínima del Worker:

| Ruta | Qué hace |
|---|---|
| `GET/POST/PATCH/DELETE /api/players` | jugadores y su foto |
| `GET/POST/DELETE /api/media` | subir, listar y borrar recursos de R2 |
| `GET /media/*` | servir recursos desde R2 |
| `GET/POST /api/matches`, `PATCH /api/matches/:id` | guardar pachangas y marcar ganador |

## 5. Configuración de Cloudflare

```jsonc
// wrangler.jsonc
{
  "name": "brelio",
  "main": "worker/index.js",
  "compatibility_date": "2026-10-01",
  "workers_dev": false,
  "assets": { "directory": "./dist", "run_worker_first": ["/api/*", "/media/*"] },
  "r2_buckets":   [{ "binding": "MEDIA", "bucket_name": "brelio-media" }],
  "d1_databases": [{ "binding": "DB", "database_name": "brelio", "database_id": "<id>" }],
  "vars": { "ACCESS_TEAM": "<equipo>.cloudflareaccess.com", "ACCESS_AUD": "<aud de la app de Access>" }
}
```

Pasos una sola vez:
1. `wrangler r2 bucket create brelio-media`
2. `wrangler d1 create brelio` → `wrangler d1 execute brelio --remote --file schema.sql`
3. Conectar el repo en **Workers Builds**: `main` → producción y ramas → previews.
4. Dominio propio + aplicación de **Access** con los emails del grupo.

## 6. Migración

1. Montar Vite + Worker + R2 + D1 con la web tal cual está hoy.
2. Subir las canciones y fotos actuales a R2 y los jugadores a D1. Quitarlas del repo, que es público.
3. Página «Recursos» y subir foto desde el avatar.
4. Pasar las animaciones a carpetas `animations/<id>/`, una a una.
5. Historial de pachangas.
