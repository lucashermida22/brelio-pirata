# Arquitectura: Lerelio entre amigos

> **Propuesta.** Nada de esto está montado todavía. Hoy Lerelio es un único `index.html` generado por los scripts de `build/` (animaciones en `src/`, canciones y fotos incrustadas en base64), y la lista de jugadores y las fotos asignadas viven en el `localStorage` de cada navegador.

Lerelio lo usamos y lo hacemos un grupo de amigos, así que el objetivo es **cero fricción**:

- el **código** está en GitHub y cualquiera del grupo lo cambia sin pedir permiso;
- los **recursos** (canciones, fotos, imágenes, gifs, vídeos) se suben desde la propia web a **R2**, sin pasar por git ni por revisiones;
- lo **compartido** (jugadores, fotos, historial de pachangas) vive en **D1**;
- todo se despliega solo con **Cloudflare Workers**.

```
 GitHub (código) ──push──▶ Workers Builds ──▶ Worker "brelio"
   main  = producción                          ├─ sirve la web (static assets)
   ramas = URL de preview                      ├─ /api/*    ──▶ D1  (jugadores, recursos, pachangas)
                                               └─ /media/*  ──▶ R2  (canciones, fotos, gifs, vídeo)
 Amigo en la web ──arrastra un fichero──▶ /api/media ──▶ R2 + apunta en D1

 Cloudflare Access delante de todo: solo entran los emails del grupo
```

## 1. Código en GitHub

- Los amigos son **colaboradores** del repo, con permiso de escritura.
- Cada uno trabaja en una rama; **Workers Builds** le da una URL de preview para enseñarla al grupo.
- Cuando le gusta, la mezcla él mismo en `main` y se despliega sola. Sin revisiones.

Para que nadie se pise, cada animación es una carpeta independiente:

```
app/                  # la web: generador de equipos, LOL, versus, botón «Ganador», página «Recursos»
animations/
  furious/index.js    # export default { label, song, play(ctx) }
  jojo/index.js
  …
worker/index.js       # API + servir R2
schema.sql            # tablas de D1
wrangler.jsonc
```

El selector de animaciones se genera solo con lo que haya en `animations/`. Añadir una animación es añadir una carpeta; no hay que tocar nada más.

### El contrato de una animación

```js
export default {
  label: 'Fast & Furious',
  song: 'furious/last_ride.mp3',   // clave en R2: se cambia desde «Recursos» sin tocar código
  async play(ctx) {
    // ctx.teams            equipos ya repartidos (nombre, miembros, roles LOL, capitán)
    // ctx.win              true si es la repetición solo con el ganador
    // ctx.stage            <div> a pantalla completa donde pintar
    // ctx.three()          Three.js listo para usar (escena, cámara, renderer)
    // ctx.media(clave)     imagen/vídeo de R2 ya cargado: await ctx.media('furious/paul.jpg')
    // ctx.song             el <audio> con la canción
    // ctx.later(fn, ms)    setTimeout que se cancela solo al cerrar
    // ctx.onType('mati', fn)  huevo de pascua: se dispara al teclear «mati»
    // ctx.done()           revelado terminado (habilita «Ganador»)
    // ctx.close()          cierra la animación
  },
};
```

La app se encarga de lo aburrido (limpiar al cerrar, música, tecla Esc, móvil). La animación solo cuenta su historia.

## 2. Recursos en R2 (sin revisión)

Página **«Recursos»** dentro de la web:

1. Arrastras un mp3, jpg, png, gif o webm (o varios a la vez).
2. Eliges carpeta (`furious`, `jugadores`, `comun`…) o creas una.
3. Se sube al momento y te da la clave (`furious/last_ride.mp3`) con botón de copiar y vista previa (se escucha o se ve).

Además, en la lista de jugadores, **tocar un avatar → «Subir foto»** sube la foto a R2 y la deja asignada para todo el grupo.

Las animaciones usan los recursos **por clave**. Si quieres otra canción, la subes y cambias la clave en `song`, o la reemplazas bajo la misma clave y no tocas el código.

Por debajo:

- `POST /api/media`: el Worker guarda el fichero en R2 (`carpeta/nombre-abc12.ext`) y apunta en D1 quién lo subió.
- `GET /media/<clave>`: sirve desde R2 con caché larga.
- `DELETE /api/media/<clave>`: cualquiera del grupo puede borrar o reemplazar.

Si estás dentro de la web, puedes subir. Nadie revisa nada.

## 3. Quién puede entrar

**Cloudflare Access**:

- Una aplicación de Access delante del dominio con los emails del grupo.
- Login con código de un solo uso por email: no hay contraseñas que repartir.
- El Worker verifica la cabecera `Cf-Access-Jwt-Assertion` y saca el email, así sabe quién subió cada cosa o creó cada pachanga.
- `workers_dev: false`, para que no se pueda entrar por la URL `*.workers.dev` saltándose Access.

> Alternativa más simple: una **clave del grupo** guardada como secreto del Worker (`wrangler secret put GROUP_KEY`) y pedida una vez en la web. Funciona igual de bien para mantener fuera a extraños, pero no sabes quién subió qué.

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
  type        TEXT,                -- audio/mpeg, image/jpeg, image/gif, video/webm…
  size        INTEGER,
  uploaded_by TEXT,
  created_at  INTEGER
);
CREATE TABLE matches (
  id         TEXT PRIMARY KEY,
  played_at  INTEGER,
  animation  TEXT,
  teams      TEXT,                 -- JSON: equipos, miembros, roles LOL, capitanes
  winner     INTEGER,              -- índice del equipo ganador (NULL si no se eligió)
  created_by TEXT
);
```

Qué ganamos: la lista de jugadores y sus fotos es la misma para todos (hoy cada uno tiene la suya en `localStorage`), y un **historial**: quién ganó cada pachanga, rachas, quién pierde más… y se puede repetir la animación del ganador otro día.

### API del Worker

| Ruta | Qué hace |
|---|---|
| `GET/POST/PATCH/DELETE /api/players` | jugadores y su foto |
| `GET /api/media` | listar recursos (por carpeta) |
| `POST /api/media` | subir un recurso a R2 |
| `DELETE /api/media/:clave` | borrar un recurso |
| `GET /media/*` | servir recursos desde R2 |
| `GET/POST /api/matches` | historial y guardar una pachanga |
| `PATCH /api/matches/:id` | marcar ganador |

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

Pasos, una sola vez (los hace el dueño):

1. `wrangler r2 bucket create brelio-media`
2. `wrangler d1 create brelio`, pegar el `database_id` en `wrangler.jsonc` y `wrangler d1 execute brelio --remote --file schema.sql`
3. Conectar el repo en **Workers Builds**: `main` → producción, el resto de ramas → previews.
4. Dominio propio + aplicación de **Access** con los emails del grupo.

## 6. Migración

1. Montar Worker + R2 + D1 con la web tal cual está hoy (el `index.html` pasa a ser `app/`, sin cambiar lo que hace).
2. Subir a R2 las canciones y fotos actuales (`assets/*.mp3`, `p1…p8.jpg`, `ff_*.jpg`, `mati_*.jpg`) y los jugadores a D1. Quitarlas del repo, que es público, y dejar de incrustarlas en base64: la página deja de pesar ~5 MB y cada recurso baja solo cuando se usa.
3. Una vez, al abrir la web, importar el `localStorage` actual (`brelio-assign`, `brelio-photos-extra`) a D1 para no perder las fotos ya asignadas.
4. Página «Recursos» y subir foto desde el avatar.
5. Pasar las animaciones a `animations/<id>/`, una a una, con el contrato de arriba.
6. Historial de pachangas.

Los pasos 4 a 6 se pueden hacer en cualquier orden, y por cualquiera del grupo.
