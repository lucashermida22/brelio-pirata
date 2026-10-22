// La onda de color: cada vez que alguien pulsa un botón o enlace que no hace nada (los marcados con
// `data-pulse`), el fondo de la página se llena de un pulso de color con los colores de las fotos de
// la gente y la interfaz tiembla al paso del frente.
//
//   pulse(x, y)            lanza una onda desde (x, y), en px CSS de la ventana
//   window.__lerelioPulse  { pulse, palette, debug } para probar desde la consola
//
// Piezas: palette.js (+ worker) saca la paleta · engine.js pinta (renderer-gl.js o renderer-2d.js)
// · tremble.js hace temblar · wave.js tiene la física que comparten el dibujo y el temblor.
import './pulse.css';
import * as engine from './engine.js';
import { MIN_GAP_MS } from './wave.js';
import { palettes } from './palette.js';
import { tremble, shake, stopTrembles, seekTrembles, trembleCount } from './tremble.js';

const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
const overlayOpen = () => !!document.getElementById('vsLayer')?.classList.contains('active');
let lastT0 = -1e9;

// Lanza una onda desde (x, y). Devuelve false si no toca (animación de equipos abierta, ráfaga…)
export function pulse(x, y, { source = null } = {}) {
  if (overlayOpen()) return false;
  const now = engine.clock.now();
  if (now - lastT0 < MIN_GAP_MS) return false;
  x = Number.isFinite(x) ? x : innerWidth / 2;
  y = Number.isFinite(y) ? y : innerHeight / 2;
  const reduced = reducedMQ.matches;
  palettes.check();   // ¿han cambiado las fotos? Se recalcula en segundo plano; esta onda usa la que hay
  const g = engine.addWave({ x, y, palette: palettes.current(), reduced });
  if (!g) return false;
  lastT0 = now;
  if (!reduced && engine.cfg.tremble) {
    // con varias ondas encima, cada temblor nuevo suma menos (nunca se desmadra)
    const damp = 1 / (1 + 0.45 * (engine.liveCount() - 1));
    shake(x, y, damp);
    tremble(x, y, g, { source, damp });
  }
  return true;
}

// Un solo oyente para todos los botones muertos
function onClick(e) {
  const el = e.target instanceof Element ? e.target.closest('[data-pulse]') : null;
  if (!el || el.matches('[disabled], [aria-disabled="true"]')) return;
  if (el.matches('a[href="#"], a[href=""]')) e.preventDefault();
  let x = e.clientX, y = e.clientY;
  // teclado (Enter/Espacio) o .click(): sin coordenadas → desde el centro del elemento
  if (e.detail === 0 || (!x && !y)) {
    const r = el.getBoundingClientRect();
    x = r.left + r.width / 2; y = r.top + r.height / 2;
  }
  pulse(x, y, { source: el });
}

// Los <button> ya convierten Enter/Espacio en click; los demás (role="button", enlaces) se ayudan aquí
function onKey(e) {
  if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat || e.altKey || e.ctrlKey || e.metaKey || overlayOpen()) return;
  const el = e.target instanceof Element ? e.target.closest('[data-pulse]') : null;
  if (!el || el !== e.target || el.matches('button, input, select, textarea, summary')) return;
  if (e.key === 'Enter' && el.matches('a[href]')) return;   // el Enter de un enlace ya hace click
  e.preventDefault();
  el.click();
}

const idle = (f, timeout) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout }) : setTimeout(f, 300));

export function initPulse() {
  Object.assign(engine.cfg, window.__lerelioPulseConfig || {});
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  palettes.init();

  // jugadores o fotos nuevos → paleta nueva (cuando el navegador esté libre)
  const people = document.getElementById('people');
  let t = 0;
  if (people) new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => palettes.check(), 450); }).observe(people, { childList: true });

  // se abre la animación de equipos: la onda se despide deprisa y nada se queda temblando
  const layer = document.getElementById('vsLayer');
  if (layer) new MutationObserver(() => { if (overlayOpen()) { engine.retireAll(); stopTrembles(); } }).observe(layer, { attributes: true, attributeFilter: ['class'] });

  // lienzo y shader listos antes del primer clic
  idle(() => engine.warm(), 4000);

  window.__lerelioPulse = {
    pulse: (x, y) => pulse(x, y),
    palette: () => palettes.ready().then((p) => ({ hex: p.hex.slice(), source: p.source, keys: p.keys.slice(), fallback: p.fallback })),
    debug: {
      cfg: engine.cfg,
      renderer: () => engine.warm() && engine.rendererKind(),
      timeScale: (s) => engine.clock.setScale(s),
      // tiempo a mano: hold() congela (también los temblores en marcha), seek(ms) va a ese instante
      // de la última onda (dibujo + temblor), release() vuelve al reloj de verdad
      hold: () => { engine.setManual(true); seekTrembles(engine.clock.t); },
      seek: (ms) => { const t = lastT0 + ms; engine.seek(t); seekTrembles(t); return { live: engine.isActive(), trembles: trembleCount() }; },
      release: () => { stopTrembles(); engine.setManual(false); },
      active: () => engine.isActive(),
      trembles: trembleCount,
    },
  };
}
