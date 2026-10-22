// Carga de recursos por clave (R2 vía /media/<clave>): imágenes y audio con caché.
import { mediaUrl } from './api.js';

const imgs = new Map();
const auds = new Map();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const urlOf = mediaUrl;

// <img> ya cargado (null si falla). Misma clave → misma promesa.
export function loadImage(keyOrUrl) {
  if (!keyOrUrl) return Promise.resolve(null);
  const src = /^(data:|blob:|\/|https?:)/.test(keyOrUrl) ? keyOrUrl : mediaUrl(keyOrUrl);
  if (imgs.has(src)) return imgs.get(src);
  const p = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  imgs.set(src, p);
  return p;
}

// <audio> con los metadatos cargados. Se reutiliza el mismo elemento por clave.
export function loadAudio(key, { loop = false } = {}) {
  if (!key) return Promise.resolve(null);
  let rec = auds.get(key);
  if (!rec) {
    const a = new Audio();
    a.preload = 'auto';
    a._key = key;
    const ready = new Promise((res) => {
      const ok = () => res(a);
      a.addEventListener('canplay', ok, { once: true });
      a.addEventListener('error', () => res(null), { once: true });
    });
    a.src = mediaUrl(key);
    a.load();
    rec = { a, ready };
    auds.set(key, rec);
  }
  rec.a.loop = loop;
  // no esperamos eternamente: tras 6 s seguimos con lo que haya
  return Promise.race([rec.ready, wait(6000).then(() => rec.a)]);
}

// Resuelve cualquier clave según su extensión
export function loadMedia(key) {
  if (/\.(mp3|wav|ogg|m4a)$/i.test(key)) return loadAudio(key);
  if (/\.(webm|mp4)$/i.test(key)) {
    return new Promise((res) => { const v = document.createElement('video'); v.preload = 'auto'; v.muted = true; v.onloadeddata = () => res(v); v.onerror = () => res(null); v.src = mediaUrl(key); });
  }
  return loadImage(key);
}
