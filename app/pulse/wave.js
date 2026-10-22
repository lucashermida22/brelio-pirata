// Física de la onda. La MISMA curva da el radio del frente al shader y el instante en que el
// frente pasa por el centro de cada bloque (para el temblor): así lo que se ve y lo que tiembla
// van clavados. Tiempos en ms, distancias en px CSS.

export const MAX_WAVES = 4;     // huecos en el shader: 3 ondas vivas + 1 que se está despidiendo
export const LIVE_WAVES = 3;
export const FRONT_MS = 1700;   // lo que tarda el frente en llegar a la esquina más lejana (la curva es muy
                                // rápida al principio: cruza la pantalla en ~0,5 s y luego se posa)
export const LIFE_MS = 2350;    // vida total de una onda (con la cola de fundido)
export const RETIRE_MS = 160;   // fundido rápido de la más vieja cuando llega una cuarta
export const FEATHER = [80, 320];   // ancho del borde del frente: estrecho al nacer, ancho al llegar lejos

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// cubic-bezier(x1, y1, x2, y2) como en CSS, con su inversa (la curva es monótona)
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {   // Newton…
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-7) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1; t = x;        // …y si no converge, bisección
    for (let i = 0; i < 40; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-7) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return t;
  };
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
  const inverse = (y) => {
    if (y <= 0) return 0;
    if (y >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 32; i++) { const m = (lo + hi) / 2; if (ease(m) < y) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  return { ease, inverse };
}

export const FRONT = bezier(0.2, 0.7, 0.2, 1);

// Geometría de una onda: desde dónde sale el frente (escondido bajo el clic) hasta dónde llega
// (más allá de la esquina más lejana de la ventana, para que el borde suave salga entero).
export function geometry(x, y, vw, vh) {
  const reach = Math.max(Math.hypot(x, y), Math.hypot(vw - x, y), Math.hypot(x, vh - y), Math.hypot(vw - x, vh - y));
  return { reach, start: -FEATHER[0] * 0.55, end: reach + FEATHER[1] * 0.5 };
}

export const featherAt = (r) => FEATHER[0] + (FEATHER[1] - FEATHER[0]) * smooth(0, 1000, r);
export const radiusAt = (g, age) => g.start + (g.end - g.start) * FRONT.ease(age / FRONT_MS);

// Cuándo (ms desde el clic) pasa el centro del frente por la distancia d
export const arrival = (g, d) => FRONT.inverse(clamp((d - g.start) / (g.end - g.start), 0, 1)) * FRONT_MS;

// Envolventes de una onda a su edad `age` (ms):
//   fill  opacidad del relleno de color detrás del frente (sube suave, aguanta, cola larga)
//   rim   fuerza de la cresta del frente (se apaga según el frente frena)
//   twist giro lento de los colores alrededor del clic (rad)
//   hollow radio del «hueco» interior que se va abriendo (la energía se marcha hacia fuera)
export function envelope(age, g, reduced) {
  if (reduced) {
    // movimiento reducido: solo un fundido de color, sin frente ni giro
    return { fill: 0.3 * smooth(0, 480, age) * (1 - smooth(700, 1750, age)), rim: 0, twist: 0, hollow: -1e5 };
  }
  const fill = 0.46 * smooth(0, 460, age) * Math.pow(1 - smooth(680, LIFE_MS, age), 1.2);
  const rim = smooth(0, 90, age) * (1 - smooth(260, FRONT_MS + 150, age));
  const twist = 0.75 * (1 - Math.exp(-age / 900));
  const hollow = age < 420 ? -1e5 : radiusAt(g, age - 420) * 0.55;
  return { fill, rim, twist, hollow };
}

export const lifeOf = (reduced) => (reduced ? 1800 : LIFE_MS);
