// Núcleo de la paleta de la onda: color en OKLab/OKLCH, k-means++ ponderado y elección
// de 5–6 colores vivos y bien separados. Sin DOM ni red: lo usan el worker
// (palette.worker.js) y la vía de respaldo del hilo principal (palette.js).

// ---------- color ----------
const LIN = new Float32Array(256);   // sRGB 8 bits → lineal
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

export function linToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

export function oklabToLin(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

export const hexToOklab = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return linToOklab(LIN[(n >> 16) & 255], LIN[(n >> 8) & 255], LIN[n & 255]);
};

const inGamut = ([r, g, b]) => r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001;
const lchToLab = (L, C, h) => [L, C * Math.cos(h), C * Math.sin(h)];

// Mapeo a sRGB: baja el croma (mismo tono y luz) hasta que el color cabe
export function fitChroma(L, C, h) {
  if (inGamut(oklabToLin(...lchToLab(L, C, h)))) return C;
  let lo = 0, hi = C;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (inGamut(oklabToLin(...lchToLab(L, m, h)))) lo = m; else hi = m; }
  return lo;
}

export function labToSrgb8(L, a, b) {
  return oklabToLin(L, a, b).map((v) => Math.round(gam(clamp(v, 0, 1)) * 255));
}
export const labToHex = (L, a, b) => '#' + labToSrgb8(L, a, b).map((v) => v.toString(16).padStart(2, '0')).join('');

// ---------- muestreo de una foto ----------
// PRNG con semilla: la misma foto da siempre la misma paleta (y la caché tiene sentido)
function prng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// distancia de agrupado: la luz pesa menos que el tono/croma (luego la normalizamos igualmente)
const KL = 0.55;
const d2 = (L1, a1, b1, L2, a2, b2) => { const dl = (L1 - L2) * KL, da = a1 - a2, db = b1 - b2; return dl * dl + da * da + db * db; };

// k-means++ ponderado sobre puntos OKLab (pts: Float32Array n*3, w: pesos)
function kmeans(pts, w, n, k, rnd, iters = 12) {
  k = Math.min(k, n);
  const cen = new Float32Array(k * 3), dist = new Float32Array(n).fill(Infinity), asg = new Int32Array(n);
  let tw = 0; for (let i = 0; i < n; i++) tw += w[i];
  // primer centro: proporcional al peso; los siguientes: proporcional a peso × D²
  let r = rnd() * tw, first = 0;
  for (let i = 0; i < n; i++) { r -= w[i]; if (r <= 0) { first = i; break; } }
  cen.set(pts.subarray(first * 3, first * 3 + 3), 0);
  for (let c = 1; c < k; c++) {
    let sum = 0;
    const p = (c - 1) * 3;
    for (let i = 0; i < n; i++) {
      const dd = d2(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], cen[p], cen[p + 1], cen[p + 2]);
      if (dd < dist[i]) dist[i] = dd;
      sum += dist[i] * w[i];
    }
    let pick = n - 1; r = rnd() * sum;
    for (let i = 0; i < n; i++) { r -= dist[i] * w[i]; if (r <= 0) { pick = i; break; } }
    cen.set(pts.subarray(pick * 3, pick * 3 + 3), c * 3);
  }
  const acc = new Float64Array(k * 4);
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dd = d2(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], cen[c * 3], cen[c * 3 + 1], cen[c * 3 + 2]);
        if (dd < bd) { bd = dd; best = c; }
      }
      if (asg[i] !== best || it === 0) { asg[i] = best; moved++; }
    }
    acc.fill(0);
    for (let i = 0; i < n; i++) { const c = asg[i] * 4; acc[c] += pts[i * 3] * w[i]; acc[c + 1] += pts[i * 3 + 1] * w[i]; acc[c + 2] += pts[i * 3 + 2] * w[i]; acc[c + 3] += w[i]; }
    for (let c = 0; c < k; c++) if (acc[c * 4 + 3] > 0) { const s = acc[c * 4 + 3]; cen[c * 3] = acc[c * 4] / s; cen[c * 3 + 1] = acc[c * 4 + 1] / s; cen[c * 3 + 2] = acc[c * 4 + 2] / s; }
    if (!moved) break;
  }
  return { cen, asg, k };
}

// Analiza una foto ya reducida (RGBA de ~56×56). Devuelve sus colores representativos:
// [{ L, a, b, w (peso relativo), n (fracción de píxeles de la foto) }], ya sin grises, blancos ni negros.
export function analyzePixels(data, width, height, { k = 8, seed = 0x5eed } = {}) {
  const total = width * height;
  const pts = new Float32Array(total * 3), w = new Float32Array(total);
  let n = 0, seen = 0;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    seen++;
    const [L, a, b] = linToOklab(LIN[data[o]], LIN[data[o + 1]], LIN[data[o + 2]]);
    const C = Math.hypot(a, b);
    // fuera: casi negro (tono poco fiable), casi blanco y casi gris
    if (L < 0.2 || L > 0.965 || C < 0.032 || (L > 0.9 && C < 0.07)) continue;
    // el croma manda (lo vivo pesa más que la piel o el fondo); luz extrema algo menos
    const wv = Math.pow(C - 0.02, 1.5) * (1 - 0.7 * Math.abs(L - 0.62));
    pts[n * 3] = L; pts[n * 3 + 1] = a; pts[n * 3 + 2] = b; w[n] = wv; n++;
  }
  if (n < 12) return [];
  const { cen, asg, k: kk } = kmeans(pts, w, n, k, prng(seed ^ (n * 2654435761)));
  const out = [];
  const cw = new Float64Array(kk), cn = new Float64Array(kk);
  for (let i = 0; i < n; i++) { cw[asg[i]] += w[i]; cn[asg[i]]++; }
  const tw = cw.reduce((s, v) => s + v, 0) || 1;
  for (let c = 0; c < kk; c++) {
    if (cn[c] < 3) continue;
    out.push({ L: +cen[c * 3].toFixed(4), a: +cen[c * 3 + 1].toFixed(4), b: +cen[c * 3 + 2].toFixed(4), w: +(cw[c] / tw).toFixed(4), n: +(cn[c] / Math.max(1, seen)).toFixed(4) });
  }
  return out.sort((x, y) => y.w - x.w);
}

// ---------- de muchas fotos a una paleta ----------
const hueDist = (h1, h2) => { const d = Math.abs(h1 - h2) % TAU; return d > Math.PI ? TAU - d : d; };
// piel: tonos anaranjados de croma moderado, ≈26°–76° (los naranjas vivos de verdad no cuentan, y
// los beiges y dorados de una pared, más amarillos, tampoco)
const isSkin = (L, C, h) => h > 0.45 && h < 1.33 && C < 0.135 && L > 0.38 && L < 0.9;

// Paleta de respaldo (sin fotos): los acentos de la propia web, ya «vivos»
export const FALLBACK_HEX = ['#ff6fae', '#ff9a5c', '#f5c542', '#3fcf9a', '#3aa7ff', '#8b7bff'];

// Junta los colores de todas las fotos y elige 5–6: vivos, distintos entre sí y con
// presencia. Devuelve [{ L, C, h, hex, w, skin }] en orden de tono (un ciclo agradable).
export function buildPalette(lists, { max = 6, min = 5 } = {}) {
  const valid = lists.filter((l) => l && l.length);
  let cand = [];
  // cada foto cuenta parecido (las más coloridas, un poco más)
  const totals = valid.map((l) => l.reduce((s, c) => s + c.w * c.n, 0));
  const meanT = totals.reduce((s, v) => s + v, 0) / (totals.length || 1) || 1;
  valid.forEach((list, img) => {
    const f = clamp(Math.sqrt(totals[img] / meanT), 0.6, 1.5);
    list.forEach((c) => cand.push({ L: c.L, a: c.a, b: c.b, w: c.w * f, imgs: 1 << (img % 30) }));
  });
  // fusión aglomerativa de los casi iguales (media ponderada)
  for (;;) {
    let bi = -1, bj = -1, bd = 0.05 * 0.05;
    for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) {
      const dd = d2(cand[i].L, cand[i].a, cand[i].b, cand[j].L, cand[j].a, cand[j].b);
      if (dd < bd) { bd = dd; bi = i; bj = j; }
    }
    if (bi < 0) break;
    const A = cand[bi], B = cand[bj], s = A.w + B.w;
    A.L = (A.L * A.w + B.L * B.w) / s; A.a = (A.a * A.w + B.a * B.w) / s; A.b = (A.b * A.w + B.b * B.w) / s;
    A.w = s; A.imgs |= B.imgs; cand.splice(bj, 1);
  }
  const bits = (x) => { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; };
  const tw = cand.reduce((s, c) => s + c.w, 0) || 1;
  cand.forEach((c) => {
    c.C = Math.hypot(c.a, c.b); c.h = Math.atan2(c.b, c.a);
    c.skin = isSkin(c.L, c.C, c.h);
    const vivid = smooth(0.045, 0.16, c.C);
    // presencia (con rendimientos decrecientes) × viveza × (en varias fotos, un pelín más) × (lo muy
    // oscuro, menos: su versión clara sería más invento que foto)
    c.score = Math.sqrt(c.w / tw) * Math.pow(0.05 + vivid, 1.2) * (1 + 0.1 * (bits(c.imgs) - 1)) * (0.55 + 0.45 * smooth(0.26, 0.5, c.L));
  });
  cand.sort((x, y) => y.score - x.score);

  // Elección voraz: en cada vuelta gana el que más vale × lo lejos que queda de lo ya elegido.
  // Dos tonos nunca a menos de SEP_MIN (en la onda solo cuentan tono y croma: la luz la iguala el
  // shader), y la separación «sobrada» (SEP_OK) se premia: así no salen cuatro rosas seguidos y
  // un color apagado pero distinto (el beige de una pared → dorado) gana a otro rosa.
  // La piel entra una vez como mucho y con algo de castigo (un naranja de verdad gana a una cara).
  const SEP_MIN = 0.45, SEP_OK = 0.95;   // ≈26° y ≈54°
  // (siempre por tono: todo lo elegido sale con croma, aunque en la foto fuera un beige apagado)
  const sep = (p, c) => hueDist(p.h, c.h);
  const pick = [];
  while (pick.length < max) {
    let best = null, bestV = 0;
    for (const c of cand) {
      if (c.C < 0.04 || pick.includes(c) || (c.skin && pick.some((p) => p.skin))) continue;
      const s = pick.length ? Math.min(...pick.map((p) => sep(p, c))) : Math.PI;
      if (s < SEP_MIN) continue;
      const v = c.score * (0.2 + 0.8 * smooth(SEP_MIN, SEP_OK, s)) * (c.skin ? 0.7 : 1);
      if (v > bestV) { bestV = v; best = c; }
    }
    // el sexto solo si merece la pena (con cinco ya hay paleta)
    if (!best || (pick.length >= min && bestV < 0.22 * pick[0].score)) break;
    pick.push(best);
  }
  // Sin nada aprovechable (fotos grises o ninguna): vacía, y quien llama decide (otra fuente o la de respaldo)
  if (!pick.length) return [];
  // Con pocas fotos (o una sola, toda rosa) se completa con vecinos análogos de lo que sí hay, no
  // con colores ajenos: a ±36° de uno elegido y, si ya no cabe, a ±72°. Primero los que quedan ENTRE
  // dos colores de verdad (interpolan) y los vecinos de los que más pesan.
  const real = pick.slice();
  const between = (h) => {   // ¿cae en un hueco «interior» (< 140°) entre dos elegidos?
    const hs = real.map((p) => p.h);
    if (hs.length < 2) return false;
    let lo = Infinity, hi = Infinity;
    hs.forEach((x) => { const d = ((x - h) % TAU + TAU) % TAU; if (d < hi) hi = d; const e = ((h - x) % TAU + TAU) % TAU; if (e < lo) lo = e; });
    return lo + hi < 2.45;
  };
  while (pick.length < min) {
    let best = null, bestV = -Infinity;
    for (const ring of [0.63, 1.26]) {
      real.forEach((src, rank) => [1, -1].forEach((sg) => {
        const h = src.h + sg * ring;
        if (Math.min(...pick.map((p) => hueDist(p.h, h))) < 0.5) return;
        const v = (between(h) ? 1 : 0) - 0.15 * rank - (sg < 0 ? 0.05 : 0);
        if (v > bestV) { bestV = v; best = { src, h }; }
      }));
      if (best) break;
    }
    if (!best) break;
    const { src, h } = best, C = Math.max(src.C, 0.1);
    pick.push({ L: src.L, a: C * Math.cos(h), b: C * Math.sin(h), C, h, w: 0, skin: false, derived: true });
  }
  return order(pick.map(vivify));
}

// Luz «bonita» de cada tono (OKLab): los naranjas oscuros son marrones y los amarillos a media luz,
// mostaza u oliva; los azules y violetas aguantan más oscuros. Tabla cada 30°, interpolada.
const NICE_L = [0.72, 0.7, 0.77, 0.85, 0.86, 0.8, 0.79, 0.76, 0.68, 0.65, 0.68, 0.71];
function niceL(h) {
  const x = (((h / TAU) % 1) + 1) % 1 * 12, i = Math.floor(x) % 12, f = x - Math.floor(x);
  const e = f * f * (3 - 2 * f);
  return NICE_L[i] + (NICE_L[(i + 1) % 12] - NICE_L[i]) * e;
}

// Paleta lista para la web: la luz de cada tono en su franja bonita (con un poco del carácter de
// la foto) y algo más de croma, con gusto: nunca chillón; la piel, más comedida.
function vivify(c) {
  const L = clamp(niceL(c.h) + 0.22 * (c.L - 0.62), 0.6, 0.9);
  let C = clamp(c.C * 1.25 + 0.03, c.skin ? 0.09 : 0.11, c.skin ? 0.125 : 0.22);
  C = fitChroma(L, C, c.h);
  const [, a, b] = lchToLab(L, C, c.h);
  return { L: +L.toFixed(4), C: +C.toFixed(4), h: +c.h.toFixed(4), a: +a.toFixed(4), b: +b.toFixed(4), hex: labToHex(L, a, b), w: +(c.w || 0).toFixed(4), skin: !!c.skin, derived: !!c.derived };
}

// Orden de tono en círculo, empezando justo después del mayor hueco (la costura queda donde menos se nota)
function order(cols) {
  const s = cols.slice().sort((x, y) => x.h - y.h);
  if (s.length < 3) return s;
  let gap = -1, at = 0;
  s.forEach((c, i) => { const nx = s[(i + 1) % s.length]; const g = ((nx.h - c.h) + TAU) % TAU; if (g > gap) { gap = g; at = (i + 1) % s.length; } });
  return s.slice(at).concat(s.slice(0, at));
}

export function fallbackPalette() {
  return order(FALLBACK_HEX.map((hex) => { const [L, a, b] = hexToOklab(hex); return vivify({ L, a, b, C: Math.hypot(a, b), h: Math.atan2(b, a), w: 0, skin: false }); }));
}

// ¿La rueda de tonos tiene un hueco enorme (p. ej. fotos sin verdes ni amarillos)? Entonces el
// degradado va de ida y vuelta (espejo) en vez de cerrar el círculo inventándose colores.
export function seamGap(cols) {
  if (cols.length < 2) return 0;
  return ((cols[0].h - cols[cols.length - 1].h) + TAU) % TAU;   // ya vienen ordenados con el hueco en la costura
}

// Degradado cíclico de la paleta (RGBA 8 bits, `size` texeles): cada color se queda un
// rato «quieto» y pasa al siguiente por OKLab con el croma compensado (sin grises de barro).
export function bakeGradient(palette, size = 128) {
  const cols = seamGap(palette) > 2.45 && palette.length > 2 ? palette.concat(palette.slice(1, -1).reverse()) : palette;
  const out = new Uint8Array(size * 4), n = cols.length;
  for (let x = 0; x < size; x++) {
    const pos = (x / size) * n, i = Math.floor(pos) % n, j = (i + 1) % n;
    const f = pos - Math.floor(pos), e = f * f * (3 - 2 * f), t = f + (e - f) * 0.4;
    const A = cols[i], B = cols[j];
    const L = A.L + (B.L - A.L) * t;
    let a = A.a + (B.a - A.a) * t, b = A.b + (B.b - A.b) * t;
    const C = Math.hypot(a, b), Ct = A.C + (B.C - A.C) * t;
    // tonos muy separados: compensa menos (si no, nos inventaríamos colores que no están en las fotos)
    const comp = hueDist(A.h, B.h) > 1.9 ? 0.55 : 1;
    if (C > 1e-4) { const k = (C + (Ct - C) * comp) / C; a *= k; b *= k; }
    const h = Math.atan2(b, a), Cf = fitChroma(L, Math.hypot(a, b), h);
    const [r, g, bb] = labToSrgb8(L, Cf * Math.cos(h), Cf * Math.sin(h));
    out[x * 4] = r; out[x * 4 + 1] = g; out[x * 4 + 2] = bb; out[x * 4 + 3] = 255;
  }
  return out;
}
