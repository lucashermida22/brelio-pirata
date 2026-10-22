# Arquitectura propuesta: Brelio con animaciones de la comunidad

> Estado: **propuesta**. Hoy Brelio es un único `index.html` (~5,5 MB) generado por los scripts de `build/`.
> Este documento describe a dónde queremos llegar para que cualquiera pueda aportar animaciones o ideas,
> con **GitHub como única fuente de verdad** y **Cloudflare Workers** para el despliegue.

## Principios

1. **Todo vive en GitHub**: código, canciones, imágenes, ideas (issues), revisiones (PR) y CI (Actions).
   Cloudflare solo despliega lo que hay en el repo; nada se edita a mano fuera de él.
2. **Una animación = una carpeta.** Quien contribuye solo toca `animations/<id>/`; el núcleo no sabe nada de ninguna animación concreta.
3. **Carga bajo demanda.** Al abrir la web solo baja el núcleo; Three.js, canciones e imágenes de una animación bajan cuando se usa.
4. **Cada PR se puede ver antes de mezclarse**, con su propia URL de preview.

## Por qué cambiar

| Hoy | Problema con más contribuidores |
|---|---|
| Un HTML con todo en base64 | 5,5 MB aunque solo uses una animación; diffs ilegibles |
| `ANIMS` y la cadena de `if` que elige la escena, compartidos | Cada animación nueva toca los mismos ficheros → conflictos constantes |
| Scripts de Python que parchean texto | Frágiles y difíciles de entender para gente nueva |

## Estructura del repo

```
brelio-pirata/
├─ app/                      # núcleo: UI de Brelio, generador de equipos, LOL, picker de fotos,
│                            # overlay del versus, selector de animación, botón «Ganador»
├─ sdk/                      # lo que el núcleo ofrece a las animaciones
│   ├─ three.js              # glInit, bloom, faceCanvas, textCanvas, glowCanvas, heartGeo…
│   ├─ audio.js              # synth(), canciones, retomar la canción en la repetición del ganador
│   └─ types.d.ts            # el contrato (ver abajo)
├─ animations/
│   ├─ furious/
│   │   ├─ manifest.json
│   │   ├─ index.js          # export default { play(ctx) }
│   │   ├─ assets/           # canción recortada, imágenes
│   │   └─ preview.webp      # miniatura para el selector
│   ├─ jojo/ mati/ tinder/ feria/ ggez/ cine/ kawaii/ bruh/ perreo/ singularidad/
│   └─ _template/            # punto de partida para animaciones nuevas
├─ lab/                      # página de desarrollo (equipos falsos, velocidad, saltar a un segundo)
├─ worker/                   # Cloudflare Worker: assets estáticos + /api
├─ docs/                     # este documento
├─ .github/                  # plantillas de issues/PR, CODEOWNERS, workflows
└─ wrangler.jsonc
```

## El contrato de una animación

```js
// animations/furious/index.js
export default {
  // opcional: renombrar equipos (Team Toretto / Team Paul…)
  teamNames: (teams) => teams.map((t, i) => ['Team Toretto', 'Team Paul'][i] ?? t.name),

  async play(ctx) {
    // ctx.teams      equipos: nombre, color, miembros {name, photo, role}, capitán…
    // ctx.win        true si es la repetición del equipo ganador
    // ctx.stage      <div> donde dibujar (el núcleo pone el contenedor y el botón de saltar)
    // ctx.three()    carga Three.js bajo demanda y devuelve el kit (glInit, texturas, bloom)
    // ctx.song       <audio> de la canción del manifest, ya posicionada (continúa en la del ganador)
    // ctx.later(fn, ms) / ctx.onType('mati', fn)   timers y easter eggs que se limpian solos
    // ctx.done()     muestra el botón final;  ctx.close() termina la animación
    return () => { /* limpieza opcional */ };
  },
};
```

```json
// animations/furious/manifest.json
{
  "id": "furious",
  "label": "Fast & Furious",
  "author": "lucashermida22",
  "song": "assets/last_ride.mp3",
  "songLoop": true,
  "three": true,
  "hold": 6000,
  "tags": ["cine", "3d", "easter-egg"]
}
```

El núcleo construye el selector a partir de todos los `manifest.json` (en build) y carga cada animación con `import()` dinámico.

## Build y desarrollo

- **Vite**, con un trozo por animación; Three.js como dependencia npm (módulos ES) en un trozo compartido.
- Assets como ficheros normales con hash en el nombre (caché larga), no base64.
- `npm run new-anim <id>` → copia `animations/_template/` y la registra.
- `npm run dev` → abre `lab/`: elegir animación, nº de equipos/personas, modo ganador, velocidad ×1/×5, saltar a un segundo.
- Canciones y fotos se quedan **en el repo**. Si el peso crece, se pasan a **Git LFS**, que sigue en GitHub.

## Despliegue: Cloudflare Workers

| Pieza | Para qué |
|---|---|
| **Worker con Static Assets** (`assets.directory: "dist"`) | Sirve la web compilada; el código del Worker solo atiende `/api/*`. |
| **Workers Builds conectado a este repo de GitHub** | Push a `main` → producción. Cada PR/rama → **URL de preview** para enseñar la animación antes de aprobarla. |
| **Cloudflare Access** (opcional) | Limitar la web a los emails del grupo (hay fotos de personas reales). |
| **D1** (opcional, fase 2) | Grupos, jugadores, asignación de fotos e historial de pachangas/ganadores compartidos (hoy en `localStorage`). |

```jsonc
// wrangler.jsonc
{
  "name": "brelio",
  "main": "worker/index.js",
  "compatibility_date": "2026-10-01",
  "assets": { "directory": "./dist", "not_found_handling": "single-page-application", "run_worker_first": ["/api/*"] }
}
```

### `/api/ideas` → GitHub Issues

Un botón «Proponer animación» dentro de la propia web manda el formulario al Worker, que crea un issue en este repo con la etiqueta `idea`, usando un token guardado como secreto de Cloudflare (`GITHUB_TOKEN`). Así quien no programa también aporta, y todas las ideas acaban en GitHub.

## Cómo se contribuye

1. **Idea** → issue con la plantilla «Idea de animación» (o desde la web).
2. **Código** → `npm run new-anim` → desarrollar en el lab → PR que solo toca `animations/<id>/`.
3. **CI (GitHub Actions)** en cada PR:
   - el `manifest.json` cumple el esquema;
   - límite de tamaño por animación (p. ej. ≤ 3 MB);
   - Playwright reproduce la animación (normal y ganador) y falla si hay errores en consola;
   - capturas automáticas comentadas en el PR.
4. **Preview** → Workers Builds comenta la URL de preview en el PR.
5. **Revisión** → `CODEOWNERS`: `app/` y `sdk/` requieren aprobación del mantenedor; `animations/*` es más abierto.

## Cuidado con lo que se sube

El repo es **público**: fotos de amigos, canciones con copyright y fotogramas de películas quedan a la vista de cualquiera.
- Solo fotos de personas que hayan dado permiso.
- Recortes cortos de canciones (como ahora) y créditos en el `manifest.json`.
- Valorar hacer el repo privado si el grupo crece; Workers Builds funciona igual con repos privados.

## Migración por fases

1. **Vite + Worker** con lo que hay hoy, sin cambiar comportamiento → producción y previews funcionando.
2. **Extraer `sdk/`** (glkit, synth, timers, retomar canción) y el contrato `play(ctx)`.
3. **Pasar las animaciones a plugins de una en una**: kawaii → bruh → perreo → cine → ggez → singularidad → jojo/mati → feria → tinder → furious.
4. **Lab, plantilla, CI, `CONTRIBUTING.md` final.**
5. Opcional: D1 (grupos e historial), `/api/ideas`, Access.
