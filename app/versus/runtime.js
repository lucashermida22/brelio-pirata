// Runtime del overlay «versus»: carga las animaciones de /animations, prepara el
// escenario, la música, la limpieza al cerrar, Esc y los huevos de pascua.
// Cada animación solo cuenta su historia a través del `ctx` (ver docs/ARQUITECTURA.md).
import { $, rand, toast, webglOK } from '../util.js';
import { loadAudio, loadImage, loadMedia, urlOf } from '../media.js';
import { vs } from './state.js';
import * as kit from './kit.js';
import { dom } from './dom.js';

const loaders = import.meta.glob('/animations/*/index.js');   // un módulo por carpeta, carga perezosa
export const registry = {};    // id → módulo
let order = [];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Carga el índice de animaciones (solo sus index.js; las escenas pesadas se importan al reproducir)
export async function loadAnimations() {
  const mods = await Promise.all(Object.entries(loaders).map(async ([path, load]) => {
    const id = path.split('/')[2];
    const m = (await load()).default;
    return [id, m];
  }));
  mods.sort((a, b) => (a[1].order ?? 100) - (b[1].order ?? 100) || a[0].localeCompare(b[0]));
  mods.forEach(([id, m]) => { registry[id] = m; });
  order = mods.map(([id]) => id);
  return order;
}
export const animIds = () => order;
export const animLabel = (id) => registry[id]?.label || id;
export const winMessage = (id, info) => registry[id]?.winMessage?.(info);

export function pickAnim(pref, last) {
  const ok = (id) => !(registry[id].needsWebGL && !webglOK());
  if (registry[pref] && ok(pref)) return pref;
  const ks = order.filter((k) => k !== last && ok(k));
  return ks[rand(ks.length)];
}

// Calienta canción e imágenes de una animación para que arranque sin esperas
export function prefetch(id) {
  const m = registry[id]; if (!m) return;
  if (m.song) loadAudio(m.song, { loop: !!m.songLoop });
  loadImage(m.hero || 'comun/hero.jpg');
  (m.media || []).forEach((k) => loadMedia(k));
  if (m.warm && !m._warm && webglOK()) m._warm = Promise.resolve(m.warm()).catch(() => { m._warm = null; });
}

// ¿Conexión limitada (ahorro de datos o 2G)? Entonces no se calienta nada por adelantado
export const saveData = () => { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))); };

// Tras el primer pintado y con el navegador libre: trae los chunks de three/postprocessing/n8ao y calienta primero la
// animación elegida (`first`) y después las demás, de una en una.
export function warmAll(first) {
  if (saveData()) return;
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 800));
  const start = () => {
    if (first) prefetch(first);
    const m = first && registry[first];
    if (webglOK() && (!first || m?.needsWebGL || m?.gl) && !kit.quality().mob) kit.loadThree().catch(() => {});
  };
  requestAnimationFrame(() => idle(start, { timeout: 4000 }));
}

// ---- sonido ----------------------------------------------------------------
function stopSounds(fade) {
  [vs.song, ...vs.sounds].forEach((a) => {
    if (!a || a.paused) return;
    if (a._key) vs.songPos[a._key] = a.currentTime;
    a.playbackRate = 1;
    if (!fade) { a.pause(); a.currentTime = 0; return; }
    const v0 = a.volume, t0 = performance.now();
    const iv = setInterval(() => {
      const k = (performance.now() - t0) / 450;
      if (k >= 1) { clearInterval(iv); a.pause(); a.currentTime = 0; a.volume = 1; } else a.volume = v0 * (1 - k);
    }, 30);
  });
}

function clearTimers() { vs.timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); vs.timers = []; }
function runTeardown() { const fns = vs.teardown; vs.teardown = []; vs.types = []; vs.holdClosing = null; fns.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }

let runId = 0;
let closing = null;   // { timer, finish } mientras dura el fundido de cierre
function flushClosing() { if (!closing) return; const c = closing; closing = null; clearTimeout(c.timer); c.finish(); }

// ---- reproducir -------------------------------------------------------------
export async function play(teams, onDone, opts = {}) {
  const layer = $('#vsLayer'), arena = $('#vsArena'), fx = $('#vsFx');
  flushClosing();   // si aún se estaba cerrando la anterior, la terminamos ya (su `finish` no debe pisar esta)
  clearTimers(); runTeardown();
  stopSounds(false);
  if (vs.fxStop) { vs.fxStop(); vs.fxStop = null; }
  layer.querySelectorAll('.vs-pop').forEach((e) => e.remove());

  const id = registry[opts.anim] ? opts.anim : pickAnim('random', null);
  const A = registry[id], win = !!opts.win;
  const key = A.key || id, variant = A.variant || '';
  const run = ++runId;
  vs.onReady = null;
  vs.open = true; vs.pending = onDone; vs.anim = id; vs.hold = false; vs.keyBuf = ''; vs.done = false; vs.run = run;

  layer.className = ''; layer.dataset.anim = key; layer.dataset.variant = variant;
  layer.querySelectorAll('.alert').forEach((e) => e.remove());
  arena.innerHTML = ''; arena.className = ''; fx.innerHTML = '';
  $('#vsTitle').textContent = win ? A.winTitle : A.title;
  $('#vsSub').textContent = win ? '' : (A.sub || '');
  $('#vsSkip').textContent = A.btn;
  layer.style.setProperty('--beat', (A.beat || 600) + 'ms');
  $('#vsHero').src = urlOf(A.hero || 'comun/hero.jpg');
  if (reduced) { closeVersus(); return; }

  void layer.offsetWidth;
  layer.classList.add('active', 'intro');
  if (win) layer.classList.add('win');
  if (A.gl) layer.classList.add('gl');
  const is3D = (A.gl || A.needsWebGL) && webglOK();
  // pantalla de carga de las 3D: el chico original girando; la música espera al primer fotograma
  let ready = !is3D, startSong = null;
  const goReady = () => { if (ready) return; ready = true; layer.classList.remove('loading'); vs.onReady = null; startSong && startSong(); };
  if (is3D) {
    let ld = $('#vsLoad');
    if (!ld) { ld = document.createElement('div'); ld.id = 'vsLoad'; ld.innerHTML = '<img alt=""><b>Cargando Brelio Pirata<i>.</i><i>.</i><i>.</i></b>'; layer.appendChild(ld); }
    ld.querySelector('img').src = urlOf('comun/hero.jpg');
    layer.classList.add('loading'); vs.onReady = goReady;
    vs.timers.push(setTimeout(goReady, 20000));   // red de seguridad
  }
  document.body.classList.add('party-mode');
  if (is3D && A.warm) Promise.resolve(A.warm()).catch(() => {});   // escena + three en paralelo con la canción

  // el módulo de la animación + su canción, sin pasarse esperando
  const song = A.song ? await loadAudio(A.song, { loop: !!A.songLoop, timeout: 1200 }) : null;
  if (!vs.open || vs.run !== run) return;
  vs.song = song;

  if (song) {
    let at = A.soundAt || 0;
    const pos = vs.songPos[A.song];
    if (win && pos != null && pos < (song.duration || Infinity) - 3) {   // el ganador sigue la canción, cuadrando el compás
      at = pos;
      if (A.beat) { const b = A.beat / 1000; at = (A.soundAt || 0) + Math.ceil((at - (A.soundAt || 0)) / b) * b; }
    }
    song.volume = 1; song.playbackRate = 1;
    try { song.currentTime = at; } catch (e) { /* aún sin metadatos */ }
    if (song.readyState < 1) song.addEventListener('loadedmetadata', () => { try { song.currentTime = at; } catch (e) { /* nada */ } }, { once: true });
    startSong = () => { if (vs.open && vs.run === run) { try { song.currentTime = at; } catch (e) { /* nada */ } song.play().catch(() => {}); } };
    if (ready) startSong();
  }

  if (!win && A.rename) A.rename(teams);

  const ctx = {
    id, A, key, variant, teams, win, matchWin: !!opts.matchWin, opts,
    stage: layer, fx, arena, song, kit: { ...kit, dom },
    isOpen: () => vs.open && vs.run === run,
    later: (fn, ms) => { const t = setTimeout(fn, ms); vs.timers.push(t); return t; },
    every: (fn, ms) => { const t = setInterval(fn, ms); vs.timers.push(t); return t; },
    onType: (seq, fn) => { vs.types.push({ seq: seq.toLowerCase(), fn }); },
    onClose: (fn) => { vs.teardown.push(fn); },
    onClosing: (fn) => { vs.onClosing = fn; },
    done: () => { layer.classList.add('done'); vs.done = true; },
    close: () => closeVersus(),
    hold: (on) => { vs.hold = !!on; },
    getStop: () => vs.fxStop,
    setStop: (fn) => { vs.fxStop = fn; },
    url: urlOf,
    media: (k) => loadMedia(k),
    audio: async (k, o) => { const a = await loadAudio(k, o); if (a) vs.sounds.add(a); return a; },
    three: async (o) => { await kit.loadThree(); return kit.glInit(o); },
    fallback: (to) => {                       // p. ej. sin WebGL → otra animación
      vs.open = false; clearTimers(); runTeardown(); layer.className = '';
      if (vs.fxStop) { vs.fxStop(); vs.fxStop = null; }
      return play(teams, vs.pending, { ...opts, anim: to });
    },
  };
  vs.onClosing = null;
  try { await A.play(ctx); }
  catch (e) { console.error('Animación «' + id + '» falló:', e); toast('Esa animación ha fallado. Prueba otra.'); closeVersus(); }
}

export function closeVersus() {
  if (!vs.open) return;
  if (vs.hold) { setTimeout(closeVersus, 500); return; }
  vs.open = false;
  clearTimers();
  const layer = $('#vsLayer');
  stopSounds(true);
  const finish = () => {
    closing = null;
    if (vs.fxStop) { vs.fxStop(); vs.fxStop = null; }
    runTeardown();
    layer.className = ''; $('#vsArena').innerHTML = ''; $('#vsFx').innerHTML = '';
    document.body.classList.remove('party-mode');
    const cb = vs.pending; vs.pending = null; cb && cb();
  };
  if (reduced || !layer.classList.contains('active')) return finish();
  if (vs.onClosing) vs.onClosing();
  layer.classList.add('closing');
  closing = { finish, timer: setTimeout(finish, 430) };
}

export const isOpen = () => vs.open;

export function initRuntime() {
  $('#vsLayer').addEventListener('click', closeVersus);
  addEventListener('keydown', (e) => {
    if (!vs.open) return;
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeVersus(); return; }
    if (e.key.length !== 1) return;
    vs.keyBuf = (vs.keyBuf + e.key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).slice(-16);   // «álvaro» = «alvaro»
    vs.types.forEach((h) => { if (vs.keyBuf.endsWith(h.seq)) h.fn(); });
  });
}
