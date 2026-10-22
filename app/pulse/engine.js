// Motor de la onda: un único lienzo fijo detrás del contenido, los huecos de las ondas, el reloj y
// el bucle de pintado. Solo pinta mientras hay alguna onda viva; después limpia, oculta el lienzo y
// se duerme. Elige WebGL y, si no hay (o solo hay WebGL por software), el respaldo 2D.
import { SLOTS, LIVE, RETIRE_MS, geometry, radiusAt, featherAt, envelope, lifeOf, smooth } from './wave.js';
import { createGLRenderer } from './renderer-gl.js';
import { create2DRenderer } from './renderer-2d.js';

// Reloj de la onda (ms). Normalmente es performance.now(); para depurar se puede ralentizar
// (scale < 1) o fijar a mano (manual + seek) y así capturar fotogramas exactos.
export const clock = {
  scale: 1, manual: false, t: 0, base: 0, real0: 0,
  now() { return this.manual ? this.t : this.base + (performance.now() - this.real0) * this.scale; },
  setScale(s) { const n = this.now(); this.base = n; this.real0 = performance.now(); this.scale = s; },
};
clock.base = clock.real0 = performance.now();

export const cfg = {
  allowSoftwareGL: false,   // depuración/pruebas: aceptar WebGL por software (SwiftShader)
  yMin: 0.72,               // luminancia del fondo a intensidad máxima (nunca más oscuro: el texto se lee siempre)
  maxA: 0.72,               // tope de opacidad (solo cuenta en colores muy claros, que casi no oscurecen)
  scaleCap: 1.25,           // tope de resolución del lienzo (px de lienzo por px CSS)
  pixelBudget: 2.6e6,       // y de píxeles totales
  adaptive: true,           // baja la resolución si los fotogramas van lentos
};

let canvas = null, renderer = null, broken = false;
let raf = 0, visible = false;
let cssW = 0, cssH = 0, sized = false;
let quality = 1, frames = [], lastFrame = 0;
let seedN = 0;
const waves = [];   // { slot, t0, docX, docY, g, palette, reduced, seed, retireAt }

const rafFn = (f) => requestAnimationFrame(f);

function makeCanvas() {
  const c = document.createElement('canvas');
  c.className = 'pulse-cv';
  c.setAttribute('aria-hidden', 'true');
  c.addEventListener('webglcontextlost', () => { if (renderer && renderer.kind === 'webgl') broken = true; });
  document.body.prepend(c);
  return c;
}

function ensureRenderer() {
  if (renderer && !broken && !renderer.lost()) return renderer;
  // contexto perdido (el navegador expulsa el más viejo si hay demasiados): lienzo nuevo
  if (renderer) { renderer.destroy(); renderer = null; }
  if (canvas) { canvas.remove(); canvas = null; }
  broken = false;
  canvas = makeCanvas();
  renderer = createGLRenderer(canvas, { allowSoftware: cfg.allowSoftwareGL });
  if (!renderer) {
    // un lienzo que ya pidió contexto webgl no puede dar uno 2D: otro lienzo
    canvas.remove();
    canvas = makeCanvas();
    renderer = create2DRenderer(canvas);
  }
  sized = false;
  waves.forEach((w) => { w.uploaded = false; });
  return renderer;
}

function resize() {
  if (!canvas || !renderer) return;
  const r = canvas.getBoundingClientRect();
  cssW = Math.max(1, r.width || innerWidth); cssH = Math.max(1, r.height || innerHeight);
  let s = Math.min(devicePixelRatio || 1, cfg.scaleCap) * quality;
  s = Math.min(s, Math.sqrt(cfg.pixelBudget / (cssW * cssH)));
  renderer.resize(cssW, cssH, s);
  sized = true;
}
addEventListener('resize', () => { sized = false; if (waves.length) resize(); });

// Prepara lienzo y shader cuando el navegador está libre (la primera onda no espera a compilar)
export function warm() {
  const r = ensureRenderer();
  if (!r) return null;
  if (!sized) resize();
  try { r.warm(); r.clear(); } catch (e) { /* nada */ }
  return r.kind;
}

export const rendererKind = () => (renderer ? renderer.kind : null);
export const isActive = () => waves.length > 0;
export const liveCount = () => waves.filter((w) => w.retireAt == null).length;

// Nueva onda desde (x, y) en px CSS de la ventana. Devuelve su geometría (para el temblor).
export function addWave({ x, y, palette, reduced = false, seed }) {
  const r = ensureRenderer();
  if (!r) return null;
  if (!sized) resize();
  const now = clock.now();
  // más de LIVE vivas: la más vieja se despide deprisa
  const live = waves.filter((w) => w.retireAt == null).sort((a, b) => a.t0 - b.t0);
  for (let i = 0; i <= live.length - LIVE; i++) live[i].retireAt = now;
  // hueco: uno libre o, si no, el de la que más avanzada vaya despidiéndose
  const used = new Set(waves.map((w) => w.slot));
  let slot = [...Array(SLOTS).keys()].find((s) => !used.has(s));
  if (slot == null) {
    const victim = waves.slice().sort((a, b) => (a.retireAt ?? Infinity) - (b.retireAt ?? Infinity) || a.t0 - b.t0)[0];
    waves.splice(waves.indexOf(victim), 1);
    slot = victim.slot;
  }
  const g = geometry(x, y, cssW || innerWidth, cssH || innerHeight);
  const w = {
    slot, t0: now, docX: x + scrollX, docY: y + scrollY, g, palette, reduced,
    seed: seed ?? (clock.manual ? (seedN++ * 0.37) % 1 : Math.random()), retireAt: null, uploaded: false,
  };
  waves.push(w);
  upload(w);
  if (!visible) { canvas.classList.add('on'); visible = true; }
  if (!raf && !clock.manual) { frames = []; lastFrame = 0; raf = rafFn(frame); }
  if (clock.manual) render();
  return g;
}

function upload(w) {
  if (w.uploaded || !renderer) return;
  renderer.setPalette(w.slot, w.palette.gradient, w.palette.hex);
  w.uploaded = true;
}

// Todas fuera, con un fundido rápido (p. ej. al abrirse la animación de equipos)
export function retireAll() {
  const now = clock.now();
  waves.forEach((w) => { if (w.retireAt == null) w.retireAt = now; });
  if (!raf && waves.length && !clock.manual) raf = rafFn(frame);
}

// Pinta el estado actual. Devuelve si sigue habiendo ondas.
export function render() {
  if (!renderer) return false;
  if (renderer.lost()) { broken = true; waves.length = 0; }
  const now = clock.now();
  const list = [];
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i], age = now - w.t0;
    const k = w.retireAt == null ? 1 : 1 - smooth(w.retireAt, w.retireAt + RETIRE_MS, now);
    if (age >= lifeOf(w.reduced) || k <= 0) { waves.splice(i, 1); continue; }
    upload(w);
    const env = envelope(age, w.g, w.reduced);
    let r, f;
    if (w.reduced) { r = w.g.reach * 3; f = w.g.reach; } else { r = radiusAt(w.g, age); f = featherAt(Math.max(0, r)); }
    list.push({
      slot: w.slot, x: w.docX - scrollX, y: w.docY - scrollY, r, f, reduced: w.reduced,
      fill: env.fill * k, rim: env.rim * k, hollow: env.hollow, twist: env.twist, zoom: env.zoom, seed: w.seed, reach: w.g.reach,
    });
  }
  if (!list.length) {
    renderer.clear();
    if (visible && canvas) { canvas.classList.remove('on'); visible = false; }
    return false;
  }
  renderer.draw(list, { time: now / 1000, flow: list.every((w) => !w.reduced) ? 1 : 0, yMin: cfg.yMin, maxA: cfg.maxA });
  return true;
}

function frame(ts) {
  raf = 0;
  if (!sized) resize();
  const alive = render();
  if (!alive) return;
  // resolución adaptativa: si los fotogramas tardan, el lienzo baja un escalón (el efecto es difuso)
  if (cfg.adaptive && lastFrame) {
    frames.push(ts - lastFrame);
    if (frames.length >= 12) {
      const avg = frames.reduce((s, v) => s + v, 0) / frames.length;
      frames = [];
      if (avg > 24 && quality > 0.5) { quality = Math.max(0.5, quality * 0.8); resize(); }
    }
  }
  lastFrame = ts;
  raf = rafFn(frame);
}

// ---- depuración: tiempo a mano ----
export function setManual(on) {
  if (on && !clock.manual) { clock.t = clock.now(); clock.manual = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  else if (!on && clock.manual) { clock.base = clock.t; clock.real0 = performance.now(); clock.manual = false; if (waves.length && !raf) raf = rafFn(frame); }
}
export function seek(t) { clock.t = t; return render(); }
