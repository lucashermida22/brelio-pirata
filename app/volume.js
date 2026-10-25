// Volumen general de Lerelio (Ajustes). Se aplica a todo <audio>/<video> y al sonido sintetizado,
// sin tocar las animaciones: cada `el.volume = x` pasa a sonar a x · volumen general.
import { ls } from './util.js';

const KEY = 'lerelio-volume';
let G = Math.min(1, Math.max(0, +ls.get(KEY, '1')));
if (!Number.isFinite(G)) G = 1;
const live = new Set();                       // WeakRef de los medios que han sonado
const ctxs = new Set();                       // ganancias maestras de Web Audio (synth)
const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');

Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
  configurable: true,
  get() { return this._rv ?? desc.get.call(this); },
  set(v) { this._rv = v; if (!this._vreg) { this._vreg = 1; live.add(new WeakRef(this)); } desc.set.call(this, Math.min(1, Math.max(0, v * G))); },
});
// los medios creados antes de que nadie toque su volumen también respetan el ajuste
document.addEventListener('play', (e) => { const el = e.target; if (el instanceof HTMLMediaElement && el._rv === undefined) el.volume = 1; }, true);

export const getVolume = () => G;
export function setVolume(v) {
  G = Math.min(1, Math.max(0, v)); ls.set(KEY, String(G));
  for (const r of live) { const el = r.deref(); if (!el) { live.delete(r); continue; } desc.set.call(el, Math.min(1, Math.max(0, (el._rv ?? 1) * G))); }
  ctxs.forEach((g) => { try { g.gain.value = g._base * G; } catch (e) { ctxs.delete(g); } });
}
// para el sonido sintetizado: registra su ganancia maestra
export function trackGain(g, base) { g._base = base; g.gain.value = base * G; ctxs.add(g); return g; }
