# Lerelio · Pachangas

Generador de equipos aleatorios para pachangas, en clave de parodia de software de gestión.

> Antes se llamaba «Brelio». El repositorio sigue siendo `brelio-pirata`, y los identificadores internos (claves de `localStorage` `brelio-*`, Worker, D1 y R2 `brelio`/`brelio-media`) se mantienen para no romper datos ni despliegues.

- Lista de jugadores con foto (toca el avatar: elige una existente o sube una nueva).
- Reparto en N equipos o por tamaño, con nombres de equipo aleatorios.
- Botón LOL: asigna TOP / JUNGLA / MID / ADC / SUPPORT.
- Animaciones de revelado: Kawaii, Estudio de cine (Tierra 3D y clásico), GG EZ, Bruh, Reggaetón, JoJo, Mati JoJo, Singularidad 3D, Feria (coches de choque), Tinder y Fast & Furious (escribe «mati» durante la animación 😉).
- Botón «Ganador»: repite la animación solo con el equipo ganador, siguiendo la canción donde iba.
- Página «Recursos»: arrastra canciones, fotos, gifs o vídeos, elige carpeta, y copia su clave.

La arquitectura (Worker + R2 + D1) está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Empezar

Hace falta Node 18 o superior.

```sh
npm install
npm run dev       # http://localhost:5173 con recarga en caliente
npm run build     # genera dist/ (lo que sirve el Worker)
npm run preview   # sirve dist/ en local para probarlo
```

En local no hace falta Worker:

- `/media/<clave>` se sirve desde la carpeta [`media/`](media) del repo.
- «Recursos» funciona contra esa misma carpeta (lo que subas se guarda en `media/`).
- Jugadores y pachangas se guardan en el `localStorage` del navegador.

Con Worker, si la base de datos está vacía, la primera persona que abre la web la siembra una sola vez con los jugadores de su navegador (los de la versión antigua, con sus fotos `jugadores/pN.jpg`) o, si no hay, con los 8 de siempre. Si dos abren a la vez no se duplican.

Para probar con la API de verdad, arranca el Worker (`cd worker && npm run dev`) y apunta Vite a él:

```sh
API_PROXY=http://localhost:8787 npm run dev
```

## Estructura

```
index.html              entrada de Vite (la página y el overlay de las animaciones)
app/                    la web
  main.js               arranque y rutas (#recursos)
  ui.js                 jugadores, reparto, agenda, botón «Ganador»
  teams.js  data.js     reparto, roles LOL, diagnósticos y nombres de equipo
  picker.js             selector de foto del avatar
  recursos.js           página «Recursos»
  api.js                /api/players, /api/media, /api/matches (con vuelta a localStorage)
  media.js  photos.js   carga de recursos por clave, fotos y emojis de los jugadores
  versus/runtime.js     lo aburrido: cargar animaciones, música, limpiar al cerrar, Esc, huevos de pascua
  versus/dom.js         flujo común de las animaciones «de DOM» (kawaii, cine, bruh…)
  versus/kit.js         utilidades compartidas: lienzos, sonido sintetizado, base Three.js
  pulse/                el pulso de color de los botones que no hacen nada (ver abajo)
  styles/               CSS de la página
animations/<id>/        una carpeta por animación (index.js + style.css + lo que necesite)
media/                  canciones e imágenes (NO van en dist/; se suben a R2)
public/                 estáticos que se copian tal cual a dist/
scripts/upload-media.mjs  sube media/ a R2
worker/  schema.sql  wrangler.jsonc   backend (API + R2 + D1)
```

## Añadir una animación

Crea una carpeta `animations/<id>/` con un `index.js`. El selector la recoge sola (`import.meta.glob`); no hay que tocar nada más.

```js
// animations/mi-animacion/index.js
import './style.css';            // opcional: tus estilos

export default {
  label: 'Mi animación',         // lo que sale en el selector
  song: 'mi-animacion/cancion.mp3',   // clave en R2 (o null)
  async play(ctx) {
    // ctx.teams            equipos ya repartidos: [{ name, bar, members: [{ name, dx, role }] }]
    // ctx.win              true si es la repetición solo con el ganador (entonces teams tiene 1 equipo)
    // ctx.stage            <div> a pantalla completa donde pintar (#vsLayer)
    // ctx.fx               contenedor de fondo dentro del stage (#vsFx)
    // ctx.three(opts)      Three.js listo: { T, scene, cam, renderer, tex, start(fn) } (null sin WebGL)
    // await ctx.media(clave)   imagen/vídeo ya cargado: await ctx.media('furious/paul.jpg')
    // ctx.url(clave)       URL de un recurso (/media/<clave>)
    // await ctx.audio(clave)   otro <audio> (se para solo al cerrar)
    // ctx.song             el <audio> de la canción (ya sonando)
    // ctx.later(fn, ms)    setTimeout que se cancela solo al cerrar (ctx.every para setInterval)
    // ctx.onType('mati', fn)   huevo de pascua: se dispara al teclear «mati»
    // ctx.onClose(fn)      limpieza propia al cerrar
    // ctx.done()           revelado terminado
    // ctx.close()          cierra la animación
    // ctx.isOpen()         sigue abierta? (compruébalo después de cada await)
    // ctx.fallback('id')   pasar a otra animación (p. ej. sin WebGL)
    // ctx.kit              utilidades: textCanvas, faceCanvas, synth, glInit, photoFor, emojiFor, dom…
  },
};
```

Campos opcionales que lee el runtime:

| Campo | Para qué |
|---|---|
| `order` | posición en el selector (si no, alfabético) |
| `title`, `winTitle`, `sub`, `btn` | textos del overlay (título, título del ganador, subtítulo, botón de cerrar) |
| `beat`, `soundAt` | compás (ms) y segundo de la canción donde empieza; el ganador cuadra su entrada con el compás |
| `songLoop` | la canción se repite |
| `hero` | clave de la imagen grande (por defecto `comun/hero.jpg`) |
| `media` | claves que conviene precargar |
| `needsWebGL` | no sale en «Aleatoria» si el navegador no tiene WebGL |
| `gl` | pone la clase `gl` al stage (escenas Three.js) |
| `key`, `variant` | `data-anim` / `data-variant` del stage (para los CSS; p. ej. Mati es una variante de JoJo) |
| `rename(teams)` | cambia nombres de equipo al repartir (Feria: Gitanos/Payos…) |
| `winMessage({ team, matchWin })` | texto del aviso cuando eliges ganador |
| `warm()` | calienta en segundo plano lo pesado (Three.js, la escena…) al elegir la animación y cuando el navegador está libre, para que `play()` arranque sin esperas. Ej.: `warm: () => Promise.all([loadThree(), import('./scene.js')])` |

Las animaciones «de DOM» (cartas que giran y se colocan a los lados del VS) no tienen que escribir el flujo: llaman a `ctx.kit.dom.play(ctx, { reveal, shape, … })`; mira `animations/kawaii/index.js` (5 líneas). Las de Three.js usan `await ctx.three({...})` y `start((t, dt) => …)`; mira `animations/feria/`.

Los helpers de `ctx.kit` también se pueden importar con `import { textCanvas, rrect } from '@kit'` para funciones fuera de `play`.

## Recursos (canciones, fotos, gifs, vídeos)

Cada recurso tiene una **clave** (`carpeta/nombre.ext`, p. ej. `furious/last_ride.mp3`) y se sirve en `/media/<clave>`. Las animaciones usan la clave, nunca la ruta: si quieres otra canción, súbela desde «Recursos» y cambia la clave en `song`, o reemplázala bajo la misma clave.

- En producción salen de R2 (vía el Worker).
- En local salen de `media/`, que tiene la misma organización:

```
media/
  comun/hero.jpg            foto principal
  jugadores/p1.jpg … p8.jpg fotos de ejemplo
  kawaii/ cine/ ggez/ bruh/ perreo/ jojo/ mati/ feria/ tinder/ furious/
```

Para subir lo que haya en `media/` a R2 (una vez, o cuando añadas algo):

```sh
npx wrangler login
npm run upload-media -- --dry-run   # ver qué subiría
npm run upload-media                # subir (R2 + apunta en D1 para que salga en «Recursos»)
npm run upload-media -- furious     # solo claves que empiecen por «furious»
```

## El pulso de color

Los botones de mentira (Productos, Soluciones, Clientes, Precios, Iniciar sesión, Reservar demo, las chips de «Foco de trabajo», las migas «Sesiones» y «Recursos», las filas de la agenda e «Historias reales…») lanzan una onda desde el punto del clic (con Enter o Espacio, desde el centro del botón): el fondo de la página se llena con los colores de las fotos de la gente y la interfaz tiembla al paso del frente. Los controles de verdad no la lanzan nunca.

- **Marcar otro botón muerto**: ponle `data-pulse` (si no es un `<button>`, también `role="button" tabindex="0"`). Hay un solo oyente para todos; no hace falta tocar nada más.
- **Paleta**: sale de las fotos de los jugadores (si nadie tiene, de las subidas a `jugadores/`, y si tampoco, de las de ejemplo). Se calcula fuera del hilo principal (worker, OKLab y k-means), elige 5–6 colores vivos y separados, se guarda en `localStorage` por conjunto de fotos y se recalcula cuando cambian.
- **Piezas** (`app/pulse/`): `index.js` (entrada y oyente) · `palette.js`, `palette.worker.js`, `quantize.js` (paleta) · `engine.js`, `renderer-gl.js`, `renderer-2d.js` (dibujo: shader WebGL detrás del contenido, o respaldo 2D) · `wave.js` (la física que comparten el dibujo y el temblor) · `tremble.js` (temblor) · `pulse.css`.
- Con `prefers-reduced-motion` solo hay un fundido de color; con la animación de equipos abierta no se lanza; sin GPU (WebGL por software) usa el respaldo 2D.
- **Probar**: `window.__lerelioPulse.pulse(x, y)` y `await window.__lerelioPulse.palette()`. Para capturar fotogramas exactos: `debug.hold()`, clic, `debug.seek(ms)` y `debug.release()`; con `window.__lerelioPulseConfig = { allowSoftwareGL: true }` antes de cargar, el shader funciona también con SwiftShader (Playwright).

## Contribuir

Cualquiera del grupo puede meter animaciones: mira [`CONTRIBUTING.md`](CONTRIBUTING.md).

