// Respaldo sin WebGL (o con WebGL por software): el mismo dibujo a grandes rasgos con Canvas 2D a
// baja resolución (el CSS lo estira y queda suave). Por onda: un degradado cónico con la paleta (el
// remolino) recortado por un degradado radial con el perfil del frente (hueco central, relleno,
// cresta y borde suave). Los colores van ya «fundidos» sobre blanco hasta la misma luminancia
// mínima que usa el shader: el texto se lee igual de bien.
import { SLOTS } from './wave.js';

const SCALE = 0.25;          // px de lienzo por px CSS: es todo difuso, no hace falta más

// Color de la paleta fundido sobre blanco con la opacidad que deja la luminancia justo en yMin
// (la misma cuenta que el shader: Y(a) ≈ Σ w·(1 − a·e)²)
function tint(hex, yMin, maxA) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const e = rgb.map((v) => 1 - v), W = [0.2126, 0.7152, 0.0722];
  const s1 = W.reduce((s, w, i) => s + w * e[i], 0), s2 = W.reduce((s, w, i) => s + w * e[i] * e[i], 0);
  const disc = s1 * s1 - s2 * (1 - yMin);
  const cap = Math.min(maxA, disc >= 0 && s2 > 1e-5 ? (s1 - Math.sqrt(disc)) / s2 : 1);
  return `rgb(${rgb.map((v) => Math.round(255 * (1 - cap + v * cap))).join(',')})`;
}

export function create2DRenderer(canvas) {
  let g;
  try { g = canvas.getContext('2d'); } catch (e) { g = null; }
  if (!g) return null;
  const off = document.createElement('canvas');
  const og = off.getContext('2d');
  const pals = new Array(SLOTS).fill(null);    // { hex, key, tints }
  let W = 0, H = 0, px = SCALE, clean = true;

  return {
    kind: '2d',
    lost: () => false,
    resize(cssW, cssH) {
      const w = Math.max(1, Math.round(cssW * SCALE)), h = Math.max(1, Math.round(cssH * SCALE));
      if (w !== canvas.width || h !== canvas.height) { canvas.width = off.width = w; canvas.height = off.height = h; }
      W = w; H = h; px = w / cssW;
    },
    setPalette(slot, bytes, hexes) { pals[slot] = { hex: hexes && hexes.length ? hexes : ['#ff7aa6'], key: '', tints: null }; },
    draw(waves, { yMin, maxA }) {
      g.clearRect(0, 0, W, H);
      for (const w of waves) {
        const pal = pals[w.slot] || (pals[w.slot] = { hex: ['#ff7aa6'], key: '', tints: null });
        const key = yMin + '|' + maxA;
        if (pal.key !== key) { pal.tints = pal.hex.map((h) => tint(h, yMin, maxA)); pal.key = key; }
        const cols = pal.tints;
        const cx = w.x * px, cy = w.y * px, R = w.r * px, F = Math.max(1, w.f * px);
        const outer = R + F * 0.6;
        if (outer <= 0 || w.fill + w.rim < 0.002) continue;
        og.globalCompositeOperation = 'source-over';
        og.clearRect(0, 0, W, H);
        // remolino de color alrededor del clic (ida y vuelta: sin costura)
        let grad;
        const ring = cols.length > 2 ? cols.concat(cols.slice(1, -1).reverse()) : cols;
        if (og.createConicGradient) {
          grad = og.createConicGradient(w.twist * 1.4 + w.seed * 6.283, cx, cy);
          ring.forEach((c, i) => grad.addColorStop(i / ring.length, c));
          grad.addColorStop(1, ring[0]);
        } else {
          grad = og.createLinearGradient(cx - outer, cy - outer, cx + outer, cy + outer);
          cols.forEach((c, i) => grad.addColorStop(i / Math.max(1, cols.length - 1), c));
        }
        og.fillStyle = grad;
        og.fillRect(0, 0, W, H);
        // perfil radial: hueco → relleno (más junto al frente) → cresta → borde suave
        og.globalCompositeOperation = 'destination-in';
        const rg = og.createRadialGradient(cx, cy, 0, cx, cy, outer);
        const at = (r) => Math.min(1, Math.max(0, r / outer));
        const hol = w.hollow * px;
        const stops = [
          [0, hol > 0 ? 0 : 0.8],
          [at(hol - F), hol > 0 ? 0 : 0.8],
          [at(hol + F * 0.6), 0.8],
          [at(R - F * 2.6), 0.82],
          [at(R - F * 0.3), 1],
          [at(R + F * 0.05), 0.9],
          [at(R + F * 0.3), 0.4],
          [1, 0],
        ];
        let last = 0;
        for (const [o, a] of stops) { last = Math.max(last, o); rg.addColorStop(last, `rgba(0,0,0,${Math.min(1, a)})`); }
        og.fillStyle = rg;
        og.fillRect(0, 0, W, H);
        g.globalAlpha = Math.min(1, w.fill * 0.92 + w.rim * 0.08);
        g.drawImage(off, 0, 0);
      }
      g.globalAlpha = 1;
      clean = false;
    },
    clear() { if (!clean) { g.clearRect(0, 0, W, H); clean = true; } },
    sleep() { if (canvas.width !== 1) { canvas.width = canvas.height = off.width = off.height = 1; W = H = 1; clean = true; } },
    warm() {},
    destroy() {},
  };
}
