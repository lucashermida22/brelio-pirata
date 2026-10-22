// Temblor de la interfaz. Cuando el frente de la onda pasa por el centro de un bloque, el bloque
// recibe un empujón hacia fuera (en la dirección del clic) y oscila como un muelle amortiguado:
// 2–3 rebotes que se apagan. Solo `transform` con Web Animations y composite:'add', así se suma a
// lo que ya tenga cada elemento (el translateX(-50%) del escenario, el hover de los botones, las
// entradas animadas de la agenda…) y lo mueve el compositor, sin tocar la maquetación.
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
// Los bloques van unos dentro de otros (escenario › tarjeta › sección › botón) y los temblores se
// suman: por eso los de fuera mueven poco; lo de dentro, con su propio retraso, remata la cascada.
const KINDS = [
  { sel: '.stage', a: 1.0, r: 0.035, s: 0.001, f: 3.0, d: 940 },
  { sel: '.card', a: 1.4, r: 0.09, s: 0.002, f: 3.6, d: 860 },
  { sel: '.section, .team, .placeholder, .drop', a: 1.5, r: 0.14, s: 0.0026, f: 4.2, d: 780 },
  { sel: '.hero h1 .w', a: 3.4, r: 0.75, s: 0.011, f: 4.6, d: 760 },
  { sel: LEAVES, a: 3.0, r: 0.4, s: 0.008, f: 5.2, d: 680 },
];
const MAX_ELEMENTS = 72;
const SAMPLES = 30;

const running = new Set();
let support = null;   // 'add' (composite) | 'props' (translate/rotate/scale sueltos) | ''

function detect() {
  if (support != null) return support;
  support = '';
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

function track(a, t0, el) {
  a._t0 = t0;
  running.add(a);
  const off = () => { running.delete(a); el._pulseN = Math.max(0, (el._pulseN || 1) - 1); };
  a.onfinish = off; a.oncancel = off;
  el._pulseN = (el._pulseN || 0) + 1;
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

// Sacudida mínima de toda la página en el instante del clic (la energía entra hacia el centro)
export function shake(x, y, damp = 1) {
  if (!detect()) return;
  const t0 = clock.now();
  let ux = innerWidth / 2 - x, uy = innerHeight / 2 - y;
  const l = Math.hypot(ux, uy);
  if (l < 40) { ux = 0; uy = 1; } else { ux /= l; uy /= l; }
  const k = { f: 13, d: 230 };
  ['header', '.shell'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el || el._pulseN > 1) return;
    track(el.animate(springFrames(k, ux, uy, 1.8 * damp, 0, 0), { duration: k.d, easing: 'linear', composite: support === 'add' ? 'add' : 'replace' }), t0, el);
  });
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
    // un poco de camino hacia el centro). En los grandes (escenario, tarjetas) cambia mucho.
    const L = Math.max(r.left, -M), T = Math.max(r.top, -M), Rr = Math.min(r.right, vw + M), B = Math.min(r.bottom, vh + M);
    const near = Math.hypot(clamp(x, L, Rr) - x, clamp(y, T, B) - y);
    const dc = Math.hypot(cx - x, cy - y);
    measured.push({ ...it, cx, cy, d: dc, hit: near + 0.25 * (Math.min(dc, near + 400) - near) });
  }
  measured.sort((a, b) => a.hit - b.hit);
  // 2) escribir: una animación por bloque, con su retraso = cuando el frente lo alcanza
  const src = source && (source.closest('button, a, [role="button"], .chip') || source);
  if (src) bump(src, t0, damp);
  let n = 0;
  for (const m of measured) {
    if (n >= MAX_ELEMENTS) break;
    if (src && (m.el === src || src.contains(m.el))) continue;
    if (m.el._pulseN > 1) continue;                     // ya lleva dos temblores encima: basta
    const { el, k } = m;
    let ux = m.cx - x, uy = m.cy - y;
    const l = Math.hypot(ux, uy);
    if (l < 1) { ux = 0; uy = 1; } else { ux /= l; uy /= l; }
    const prox = 0.5 + 0.5 * Math.exp(-m.hit / (0.45 * g.reach));   // cerca del clic, más fuerte
    const jitter = 0.85 + 0.3 * Math.random();
    const amp = k.a * prox * damp * jitter;
    const rot = k.r * prox * damp * (2 * ux * uy + 0.25 * (Math.random() - 0.5));
    const scl = k.s * prox * damp;
    const delay = arrival(g, m.hit) + (Math.random() - 0.5) * 14;
    const a = el.animate(springFrames(k, ux, uy, amp, rot, scl), {
      duration: k.d, delay: Math.max(0, delay), easing: 'linear', composite: support === 'add' ? 'add' : 'replace',
    });
    track(a, t0, el);
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
