// Utilidades de rendimiento compartidas por las escenas 3D (solo escena; no toca el motor).
//  - rnd / rnd2: azar barato (sin crypto.getRandomValues, que en bucles de píxeles pesa mucho)
//  - memo: caché por sesión (módulo) para generación procedural cara (texturas, terreno, ruido)
//  - pre: precompila un objeto oculto si el motor lo ofrece (g.precompile) y no falla si aún no existe
//  - anchor: mantiene vivo un material de un tipo concreto para que su programa no se destruya
//    (three libera el programa cuando el último material que lo usa se desecha, y el siguiente
//    efecto con ese material vuelve a compilarlo: tirón en mitad de la animación).

export const rnd = (n) => Math.floor(Math.random() * n);

const MEMO = new Map();
export function memo(key, make) {
  if (MEMO.has(key)) return MEMO.get(key);
  const v = make();
  MEMO.set(key, v);
  return v;
}

export function pre(g, obj) {
  try { if (g && g.precompile) g.precompile(obj); } catch (e) { /* sin precompilación */ }
}

// Crea un objeto oculto con `mat` y lo deja en la escena: el motor lo precompila con el resto
// y su programa queda referenciado durante toda la escena aunque los efectos desechen sus materiales.
export function anchor(g, geo, mat, ctor) {
  const { T, scene } = g;
  const o = ctor ? new ctor(geo, mat) : new T.Mesh(geo, mat);
  o.visible = false; o.frustumCulled = false; scene.add(o);
  return o;
}
