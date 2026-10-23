// Paleta de la onda a partir de las fotos de la gente: primero las fotos asignadas a los jugadores;
// si nadie tiene foto, las subidas a «jugadores/» (la biblioteca del selector); si tampoco, las de
// ejemplo (media/jugadores/pN.jpg). Se calcula fuera del hilo principal (worker con OffscreenCanvas;
// sin él, a trocitos cuando el navegador está libre) y se guarda en memoria y en localStorage,
// por foto y por conjunto de fotos: cambiar un jugador solo analiza su foto nueva.
import { state } from '../state.js';
import { DEMO_PHOTOS, mediaUrl } from '../api.js';
import { photoLibrary } from '../picker.js';
import { ls } from '../util.js';
import { analyzePixels, buildPalette, bakeGradient, fallbackPalette } from './quantize.js';

const LS_KEY = 'brelio-pulse-v2';   // cambia si cambia el algoritmo (lo guardado deja de valer)
const SIZE = 56;            // las fotos se analizan reducidas a 56×56
const MAX_PHOTOS = 24;      // con más gente, una muestra repartida
const MAX_SWATCHES = 96;    // fotos recordadas en localStorage

const idle = (f, timeout = 2500) => (window.requestIdleCallback
  ? requestIdleCallback(f, { timeout })
  : setTimeout(() => f({ didTimeout: true, timeRemaining: () => 8 }), 50));
const idleTick = (timeout) => new Promise((r) => idle(r, timeout));

// ---- caché ----
const saved = ls.json(LS_KEY, null) || {};
const swatches = new Map(Object.entries(saved.sw || {}));   // clave de foto → colores de esa foto
let savedPal = saved.pal || null;                           // { sig, source, keys, colors }

function persist() {
  // las fotos más recientes al final; se quedan las últimas MAX_SWATCHES
  const entries = [...swatches.entries()].slice(-MAX_SWATCHES);
  ls.setJson(LS_KEY, { sw: Object.fromEntries(entries), pal: savedPal });
}

const make = (colors, meta, gradient) => ({
  sig: meta.sig, source: meta.source, keys: meta.keys, fallback: !!meta.fallback,
  colors, hex: colors.map((c) => c.hex), gradient: gradient || bakeGradient(colors, 256),
});

let fallback = null;
const fallbackPal = () => fallback || (fallback = make(fallbackPalette(), { sig: '', source: 'respaldo', keys: [], fallback: true }));

// ---- de dónde salen las fotos ----
function spread(keys) {
  if (keys.length <= MAX_PHOTOS) return keys;
  const step = keys.length / MAX_PHOTOS;
  return Array.from({ length: MAX_PHOTOS }, (_, i) => keys[Math.floor(i * step)]);
}
const uniq = (a) => [...new Set(a.filter(Boolean))].sort();

function candidates() {
  const out = [];
  const add = (source, keys) => {
    keys = spread(uniq(keys));
    const sig = keys.join('|');
    if (keys.length && !out.some((c) => c.sig === sig)) out.push({ source, keys, sig });
  };
  add('jugadores', state.players.map((p) => p.photo_key));
  add('biblioteca', photoLibrary().filter((k) => /^(jugadores\/|local\/)/.test(k)));
  add('ejemplo', DEMO_PHOTOS);
  return out;
}

// ---- análisis ----
let worker = null, workerBroken = typeof Worker === 'undefined', jobId = 0;

function runWorker(photos) {
  return new Promise((resolve, reject) => {
    try {
      worker = worker || new Worker(new URL('./palette.worker.js', import.meta.url), { type: 'module' });
    } catch (e) { reject(e); return; }
    const id = ++jobId, w = worker;
    // si se queda colgado (una foto que no acaba de llegar), no puede bloquear las paletas siguientes
    const timer = setTimeout(() => { done(); reject(new Error('Worker de la paleta: sin respuesta')); }, 20000);
    const done = () => { clearTimeout(timer); w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); };
    const onMsg = (e) => {
      if (e.data.id !== id) return;
      done();
      if (e.data.unsupported) reject(new Error('Worker sin OffscreenCanvas'));
      else resolve(e.data);
    };
    const onErr = (e) => { e.preventDefault?.(); done(); reject(new Error('Worker de la paleta: ' + (e.message || 'error'))); };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    w.postMessage({ id, size: SIZE, photos });
  });
}

function stopWorker() { if (worker) { worker.terminate(); worker = null; } }

function analyzeHere(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const end = (v) => { clearTimeout(timer); img.onload = img.onerror = null; resolve(v); };
    const timer = setTimeout(() => { end(null); img.src = ''; }, 8000);
    img.decoding = 'async';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = SIZE;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, SIZE, SIZE);
        end(analyzePixels(g.getImageData(0, 0, SIZE, SIZE).data, SIZE, SIZE));
      } catch (e) { end(null); }
    };
    img.onerror = () => end(null);
    img.src = url;
  });
}

// Sin worker: una foto por hueco libre del navegador
async function runHere(photos) {
  const out = {};
  for (const p of photos) {
    if (p.swatches) { out[p.key] = p.swatches; continue; }
    await idleTick(1500);
    out[p.key] = await analyzeHere(p.url);
  }
  await idleTick(1500);
  const lists = photos.map((p) => out[p.key]).filter((l) => l && l.length);
  const colors = lists.length ? buildPalette(lists) : null;
  return { swatches: out, colors: colors && colors.length ? colors : null, gradient: null };
}

async function compute(cand) {
  const photos = cand.keys.map((key) => ({ key, url: mediaUrl(key), swatches: swatches.get(key) || null })).filter((p) => p.url);
  if (!photos.length) return null;
  let res = null;
  if (!workerBroken) {
    try { res = await runWorker(photos); } catch (e) { workerBroken = true; stopWorker(); }
  }
  if (!res) res = await runHere(photos);
  Object.entries(res.swatches || {}).forEach(([k, v]) => {
    if (!v) return;                       // falló la descarga: no se recuerda (a la próxima se reintenta)
    swatches.delete(k); swatches.set(k, v);
  });
  return res.colors ? { colors: res.colors, gradient: res.gradient } : null;
}

// ---- estado ----
let current = null;
let job = null;          // { sig, promise }

async function resolveFor(cands) {
  for (const cand of cands) {
    if (savedPal && savedPal.sig === cand.sig && savedPal.colors?.length) return make(savedPal.colors, cand);
    const r = await compute(cand);
    if (r) {
      savedPal = { sig: cand.sig, source: cand.source, keys: cand.keys, colors: r.colors };
      persist();
      return make(r.colors, cand, r.gradient);
    }
  }
  persist();
  return null;
}

function schedule() {
  const cands = candidates();
  const sig = cands.length ? cands[0].sig : '';
  if (current && current.sig === sig) return Promise.resolve(current);
  if (job && job.sig === sig) return job.promise;
  const prev = job ? job.promise.catch(() => null) : Promise.resolve();
  const promise = prev.then(() => idleTick(2000)).then(() => resolveFor(cands)).then((p) => {
    // aunque haya caído a otra fuente (o a la de respaldo), esta firma ya está resuelta
    current = { ...(p || fallbackPal()), sig };
    stopWorker();
    return current;
  }).catch((e) => {
    console.warn('[pulse] paleta:', e);
    current = current || fallbackPal();
    return current;
  }).finally(() => {
    if (job && job.promise === promise) job = null;
  });
  job = { sig, promise };
  return promise;
}

export const palettes = {
  // la que hay ahora mismo (nunca espera: si aún no está, la de respaldo)
  current: () => current || fallbackPal(),
  // al arrancar: la de la caché si coincide con las fotos de ahora; si no, se calcula al estar libre
  init() {
    const cands = candidates();
    if (savedPal && cands.length && savedPal.sig === cands[0].sig && savedPal.colors?.length) current = make(savedPal.colors, cands[0]);
    else schedule();
  },
  // ¿han cambiado jugadores o fotos? Recalcula en segundo plano (la onda en curso sigue con la suya)
  check: () => schedule(),
  // la paleta de las fotos actuales, ya calculada
  ready: () => schedule(),
};
