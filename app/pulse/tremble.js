// Temblor de la interfaz. Cuando el frente de la onda alcanza un bloque, el bloque recibe un
// empujón hacia fuera (en la dirección del clic) y oscila como un muelle amortiguado: 2–3 rebotes
// que se apagan. Solo `transform` con Web Animations y composite:'add', así se suma a lo que ya
// tenga cada elemento (el hover de los botones, las entradas animadas de la agenda, otra onda…)
// sin tocar la maquetación.
//
// Rendimiento: una animación 'add' la mueve el hilo principal, y un bloque sin capa propia se
// vuelve a rasterizar en cada fotograma. Por eso cada bloque sube a su propia capa (will-change)
// justo antes de que le llegue el frente y baja al terminar: dos rasterizados por bloque, no uno
// por fotograma. Y nunca se mueve el escenario (.stage) ni la página entera: debajo está la pintura
// del escenario con su filtro SVG, carísima de volver a pintar; tiembla el cristal de encima.
import { arrival } from './wave.js';
import { clock } from './engine.js';

// Qué tiembla y cómo. Más masa → menos recorrido, más lento y más largo.
//   a: px de recorrido · r: grados de giro · s: escala · f: Hz · d: ms
const LEAVES = [
  'header .logo', 'header .links > *', 'header .nav-actions > *',
  '.hero .eyebrow', '.hero .lead', '.hero .cta > *',
  '.card-head .card-title', '.card-head .crumbs', '.card-head .icon-btn', '.card-head .btn-sm',
  '.chips > .chip', '.field-row > *', '.plist > .prow', '.seg', '.stepper', '.anim-row', '.lol-toggle', '#go', '.bulk',
  '.appt', '.members > li', '.team-foot',
  '.stories-link', 'footer .row > span',
  '.rlist > .rrow', '.upl > .urow',
].join(',');
// Los bloques van unos dentro de otros (cristal › tarjeta › sección › botón) y los temblores se
// suman: por eso los de fuera mueven poco; lo de dentro, con su propio retraso, remata la cascada.
const KINDS = [
  { sel: '.glass', a: 1.3, r: 0.04, s: 0.001, f: 3.0, d: 940 },
  { sel: '.card', a: 1.8, r: 0.1, s: 0.002, f: 3.6, d: 860 },
  { sel: '.section, .team, .placeholder, .drop', a: 2.0, r: 0.16, s: 0.003, f: 4.2, d: 780 },
  { sel: '.hero h1 .w', a: 4.4, r: 0.9, s: 0.012, f: 4.6, d: 760 },
  { sel: LEAVES, a: 4.0, r: 0.45, s: 0.009, f: 5.2, d: 680 },
];
// La sacudida del clic: los bloques grandes de la página, juntos (no la página entera; ver arriba)
const SHAKE = ['header', '.hero', '.stage .glass', '.stories', 'footer'];
const MAX_ELEMENTS = 72;
const SAMPLES = 30;
const LIFT_LEAD = 70;   // ms: la capa sube un poco antes de que le llegue el frente

const running = new Set();
let support = null;   // 'add' (composite) | 'props' (translate/rotate/scale sueltos) | ''

function detect() {
  if (support != null) return support;
  support = '';
  if (window.__lerelioPulseConfig?.trembleMode) return (support = window.__lerelioPulseConfig.trembleMode);   // depuración
  try {
    const a = document.createElement('div').animate([{ transform: 'translateX(0px)' }, { transform: 'translateX(1px)' }], { duration: 1, composite: 'add' });
    if (a.effect && a.effect.composite === 'add') support = 'add';
    a.cancel();
  } catch (e) { /* nada */ }
  // sin composite: las propiedades sueltas no chocan con el `transform` de cada elemento
  if (!support && window.CSS && CSS.supports('translate', '1px 1px') && CSS.supports('rotate', '1deg')) support = 'props';
  return support;
}

const f3 = (v) => Math.round(v * 1000) / 1000;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const frameOf = (x, y, r, s) => (support === 'add'
  ? { transform: `translate(${f3(x)}px, ${f3(y)}px) rotate(${f3(r)}deg) scale(${f3(1 + s)})` }
  : { translate: `${f3(x)}px ${f3(y)}px`, rotate: `${f3(r)}deg`, scale: `${f3(1 + s)}` });
// sin composite, dos temblores a la vez en el mismo bloque se pisarían (salto): uno basta
const busy = (el) => (el._pulseN || 0) >= (support === 'add' ? 2 : 1);

// ---- capas: suben justo a tiempo y bajan al terminar ----
const queue = [];     // subidas pendientes, por orden de hora
let pumpRaf = 0;
function raise(L) {
  if (L.up) return;
  L.up = true;
  if (!L.el._pulseUp) L.el.classList.add('pulse-lift');
  L.el._pulseUp = (L.el._pulseUp || 0) + 1;
}
function lower(L) {
  const i = queue.indexOf(L);
  if (i >= 0) queue.splice(i, 1);
  if (!L.up) return;
  L.up = false;
  L.el._pulseUp = Math.max(0, L.el._pulseUp - 1);
  if (!L.el._pulseUp) L.el.classList.remove('pulse-lift');
}
function pump() {
  pumpRaf = 0;
  const now = clock.now() + 17;
  while (queue.length && queue[0].at <= now) raise(queue.shift());
  if (queue.length) pumpRaf = requestAnimationFrame(pump);
}
function schedule(L) {
  if (clock.manual || L.at <= clock.now() + 17) { raise(L); return; }
  let i = queue.length;
  while (i > 0 && queue[i - 1].at > L.at) i--;
  queue.splice(i, 0, L);
  if (!pumpRaf) pumpRaf = requestAnimationFrame(pump);
}

function track(a, t0, el, delay = 0) {
  a._t0 = t0;
  running.add(a);
  const L = { el, at: t0 + delay - LIFT_LEAD, up: false };
  const off = () => { running.delete(a); el._pulseN = Math.max(0, (el._pulseN || 1) - 1); lower(L); };
  a.onfinish = off; a.oncancel = off;
  el._pulseN = (el._pulseN || 0) + 1;
  schedule(L);
  if (clock.manual) { a.pause(); a.currentTime = clock.t - t0; } else if (clock.scale !== 1) a.playbackRate = clock.scale;
  return a;
}

// Muelle amortiguado: empujón inicial hacia fuera y rebotes que se apagan. Empieza y acaba en reposo.
function springFrames(k, ux, uy, amp, rot, scl) {
  const tau = k.d / 4.3, w = 2 * Math.PI * k.f / 1000, wr = w * 1.18;
  const out = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i / (SAMPLES - 1)) * k.d;
    const e = Math.exp(-t / tau), x = e * Math.sin(w * t);
    const r = Math.exp(-t / (tau * 0.9)) * Math.sin(wr * t);
    out.push(i === SAMPLES - 1 ? frameOf(0, 0, 0, 0) : frameOf(ux * amp * x, uy * amp * x, rot * r, scl * x));
  }
  return out;
}

// El botón que se ha pulsado: se hunde un poco y rebota (sin desplazarse)
function bump(el, t0, damp) {
  if (busy(el)) return;
  const s = (v) => (support === 'add' ? { transform: `scale(${v})` } : { scale: `${v}` });
  const k = 1 - 0.06 * damp;
  const frames = [
    { ...s(1), easing: 'cubic-bezier(.3,.7,.4,1)' },
    { ...s(k), offset: 0.15, easing: 'cubic-bezier(.3,0,.3,1)' },
    { ...s(1 + 0.028 * damp), offset: 0.42, easing: 'ease-in-out' },
    { ...s(1 - 0.006 * damp), offset: 0.7, easing: 'ease-in-out' },
    s(1),
  ];
  track(el.animate(frames, { duration: 520, composite: support === 'add' ? 'add' : 'replace' }), t0, el);
}

// Sacudida mínima de la página en el instante del clic (la energía entra hacia el centro)
export function shake(x, y, damp = 1) {
  if (!detect()) return;
  const t0 = clock.now();
  let ux = innerWidth / 2 - x, uy = innerHeight / 2 - y;
  const l = Math.hypot(ux, uy);
  if (l < 40) { ux = 0; uy = 1; } else { ux /= l; uy /= l; }
  const k = { f: 13, d: 230 };
  const frames = springFrames(k, ux, uy, 1.8 * damp, 0, 0);
  for (const el of document.querySelectorAll(SHAKE.join(','))) {
    if (busy(el) || !el.getClientRects().length) continue;   // (las vistas ocultas, fuera)
    track(el.animate(frames, { duration: k.d, easing: 'linear', composite: support === 'add' ? 'add' : 'replace' }), t0, el);
  }
}

// Lanza el temblor de todos los bloques visibles para una onda nacida en (x, y) con geometría g
export function tremble(x, y, g, { source = null, damp = 1 } = {}) {
  if (!detect()) return;
  const t0 = clock.now();
  const vw = innerWidth, vh = innerHeight, M = 40;
  // 1) leer: todos los rectángulos de golpe (una sola maquetación)
  const seen = new Set(), items = [];
  for (const k of KINDS) {
    for (const el of document.querySelectorAll(k.sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      items.push({ el, k });
    }
  }
  const measured = [];
  for (const it of items) {
    const r = it.el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < -M || r.top > vh + M || r.right < -M || r.left > vw + M) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // el frente «llega» a un bloque cuando lo toca: su punto más cercano (de la parte visible; con
    // un poco de camino hacia el centro). En los grandes (cristal, tarjetas) cambia mucho.
    const L = Math.max(r.left, -M), T = Math.max(r.top, -M), Rr = Math.min(r.right, vw + M), B = Math.min(r.bottom, vh + M);
    const near = Math.hypot(clamp(x, L, Rr) - x, clamp(y, T, B) - y);
    const dc = Math.hypot(cx - x, cy - y);
    measured.push({ ...it, cx, cy, hit: near + 0.25 * (Math.min(dc, near + 400) - near) });
  }
  measured.sort((a, b) => a.hit - b.hit);
  // 2) escribir: una animación por bloque, con su retraso = cuando el frente lo alcanza
  const src = source && (source.closest('button, a, [role="button"], .chip') || source);
  if (src) bump(src, t0, damp);
  let n = 0;
  for (const m of measured) {
    if (n >= MAX_ELEMENTS) break;
    if (src && (m.el === src || src.contains(m.el))) continue;
    if (busy(m.el)) continue;                           // ya lleva bastantes temblores encima
    const { el, k } = m;
    let ux = m.cx - x, uy = m.cy - y;
    const l = Math.hypot(ux, uy);
    if (l < 1) { ux = 0; uy = 1; } else { ux /= l; uy /= l; }
    const prox = 0.5 + 0.5 * Math.exp(-m.hit / (0.45 * g.reach));   // cerca del clic, más fuerte
    const jitter = 0.85 + 0.3 * Math.random();
    const amp = k.a * prox * damp * jitter;
    const rot = k.r * prox * damp * (2 * ux * uy + 0.25 * (Math.random() - 0.5));
    const scl = k.s * prox * damp;
    const delay = Math.max(0, arrival(g, m.hit) + (Math.random() - 0.5) * 14);
    const a = el.animate(springFrames(k, ux, uy, amp, rot, scl), {
      duration: k.d, delay, easing: 'linear', composite: support === 'add' ? 'add' : 'replace',
    });
    track(a, t0, el, delay);
    n++;
  }
}

// Para todo (al abrirse la animación de equipos): las animaciones se cancelan y nada se queda movido
export function stopTrembles() {
  [...running].forEach((a) => a.cancel());
  running.clear();
}

// Depuración: lleva todos los temblores al instante t del reloj (modo manual)
export function seekTrembles(t) {
  running.forEach((a) => { try { a.pause(); a.currentTime = Math.max(0, t - a._t0); } catch (e) { /* nada */ } });
}

export const trembleCount = () => running.size;
