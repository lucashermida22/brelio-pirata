// Respaldo sin WebGL: el mismo dibujo a grandes rasgos con Canvas 2D a baja resolución (el CSS lo
// estira y queda suave). Por onda: un degradado cónico con la paleta (el remolino) recortado por un
// degradado radial con el perfil del frente (hueco central, relleno, borde suave y cresta).
import { SLOTS } from './wave.js';

const SCALE = 0.25;          // px de lienzo por px CSS: es todo difuso, no hace falta más
const MAX_A = 0.36;          // sin el control de luminancia por píxel del shader, más comedido

export function create2DRenderer(canvas) {
  let g;
  try { g = canvas.getContext('2d'); } catch (e) { g = null; }
  if (!g) return null;
  const off = document.createElement('canvas');
  const og = off.getContext('2d');
  const pals = new Array(SLOTS).fill(null);
  let W = 0, H = 0, px = SCALE, clean = true;

  return {
    kind: '2d',
    lost: () => false,
    resize(cssW, cssH) {
      const w = Math.max(1, Math.round(cssW * SCALE)), h = Math.max(1, Math.round(cssH * SCALE));
      if (w !== canvas.width || h !== canvas.height) { canvas.width = off.width = w; canvas.height = off.height = h; }
      W = w; H = h; px = w / cssW;
    },
    setPalette(slot, bytes, hexes) { pals[slot] = hexes && hexes.length ? hexes : ['#ff7aa6']; },
    draw(waves) {
      g.clearRect(0, 0, W, H);
      for (const w of waves) {
        const cols = pals[w.slot] || ['#ff7aa6'];
        const cx = w.x * px, cy = w.y * px, R = w.r * px, F = Math.max(1, w.f * px);
        const outer = R + F * 0.6;
        if (outer <= 0 || w.fill + w.rim < 0.002) continue;
        og.globalCompositeOperation = 'source-over';
        og.clearRect(0, 0, W, H);
        // remolino de color alrededor del clic
        let grad;
        if (og.createConicGradient) {
          grad = og.createConicGradient(w.twist * 1.4 + w.seed * 6.283, cx, cy);
          cols.forEach((c, i) => grad.addColorStop(i / cols.length, c));
          grad.addColorStop(1, cols[0]);
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
          [0, hol > 0 ? 0 : 0.55],
          [at(hol - F), hol > 0 ? 0 : 0.55],
          [at(hol + F * 0.6), 0.55],
          [at(R - F * 2.8), 0.55],
          [at(R - F * 0.25), 1],
          [at(R), 1 + w.rim * 0.5],
          [at(R + F * 0.25), 0.45],
          [1, 0],
        ];
        let last = 0;
        for (const [o, a] of stops) { last = Math.max(last, o); rg.addColorStop(last, `rgba(0,0,0,${Math.min(1, a / 1.5)})`); }
        og.fillStyle = rg;
        og.fillRect(0, 0, W, H);
        g.globalAlpha = Math.min(1, w.fill * MAX_A * 1.5 + w.rim * 0.08);
        g.drawImage(off, 0, 0);
      }
      g.globalAlpha = 1;
      clean = false;
    },
    clear() { if (!clean) { g.clearRect(0, 0, W, H); clean = true; } },
    warm() {},
    destroy() {},
  };
}
