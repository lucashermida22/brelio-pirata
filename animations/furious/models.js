// Modelos 3D de Fast & Furious: coche deportivo con carrocería curvada, ruedas con
// llanta de radios, moto con piloto y vegetación con forma orgánica.
// Las geometrías se crean una vez y se comparten entre todos los coches.

// ---------- utilidades ----------
function displace(T, g, amp, freq, seed = 1) {
  const n = new T.SimplexNoise({ random: (() => { let s = seed * 9301; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })() });
  const p = g.attributes.position, v = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const l = v.length() || 1;
    const k = 1 + amp * (n.noise3d(v.x * freq, v.y * freq, v.z * freq) + .5 * n.noise3d(v.x * freq * 2.3, v.y * freq * 2.3, v.z * freq * 2.3));
    v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z);
  }
  return smooth(T, g);
}
// une geometrías indexadas conservando sus normales suaves
const merge = (T, gs) => T.mergeGeometries(gs, false);
// geometría suave: suelda vértices (sin uv) y recalcula normales promediadas
const smooth = (T, g, tol = 1e-4) => { g.deleteAttribute('uv'); g.deleteAttribute('normal'); const m = T.mergeVertices(g, tol); m.computeVertexNormals(); return m; };

// ---------- coche ----------
// perfil lateral (z del coche hacia delante = -z, y arriba). Se extruye a lo ancho.
function sideShape(T, pts, arches) {
  const s = new T.Shape(); s.moveTo(-pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(-pts[i][0], pts[i][1]);
  // fondo con los pasos de rueda (arcos)
  const bot = .24, back = pts[pts.length - 1][0], front = pts[0][0];
  s.lineTo(-back, bot);
  arches.slice().sort((a, b) => b - a).forEach(z => { const r = .49; s.lineTo(-(z + r), bot); s.absarc(-z, .41, r, Math.PI, 0, true); s.lineTo(-(z - r), bot); });
  s.lineTo(-front, bot); s.closePath(); return s;
}
export function carKit(T) {
  const W = 1.94, bev = .09;
  // carrocería: morro bajo, capó largo, cintura musculosa y maletero corto
  const body = [[-2.3, .34], [-2.34, .58], [-2.26, .8], [-1.9, .96], [-1.1, 1.06], [-.82, 1.1], [.9, 1.12], [1.6, 1.14], [2.12, 1.16], [2.3, 1.06], [2.34, .78], [2.3, .4]];
  const bodyG = new T.ExtrudeGeometry(sideShape(T, body, [-1.48, 1.48]), { depth: W - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 18, steps: 1 });
  bodyG.rotateY(Math.PI / 2); bodyG.translate(-(W - bev * 2) / 2, 0, 0);
  // ligero estrechamiento arriba (tumblehome)
  { const p = bodyG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > .7) p.setX(i, p.getX(i) * (1 - (y - .7) * .16)); } }
  const bodyS = smooth(T, bodyG);
  // habitáculo: parabrisas inclinado, techo bajo, luneta tipo fastback
  const cabS = new T.Shape(); [[-.86, 1.1], [-.18, 1.56], [.62, 1.58], [1.62, 1.16]].forEach(([z, y], i) => i ? cabS.lineTo(-z, y) : cabS.moveTo(-z, y)); cabS.closePath();
  const cabW = 1.5, cb = .1;
  const cabG = new T.ExtrudeGeometry(cabS, { depth: cabW - cb * 2, bevelEnabled: true, bevelThickness: cb, bevelSize: cb, bevelSegments: 4, curveSegments: 8 });
  cabG.rotateY(Math.PI / 2); cabG.translate(-(cabW - cb * 2) / 2, 0, 0);
  { const p = cabG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - Math.max(0, y - 1.05) * .22)); } }
  const cabS2 = smooth(T, cabG);
  // techo pintado encima del cristal
  const roofG = new T.ExtrudeGeometry((() => { const s = new T.Shape(); [[-.2, 1.54], [.6, 1.56], [.58, 1.61], [-.16, 1.59]].forEach(([z, y], i) => i ? s.lineTo(-z, y) : s.moveTo(-z, y)); s.closePath(); return s; })(), { depth: 1.18, bevelEnabled: true, bevelThickness: .06, bevelSize: .04, bevelSegments: 3 });
  roofG.rotateY(Math.PI / 2); roofG.translate(-.59, 0, 0);
  const roofS = smooth(T, roofG);
  // rueda: neumático con perfil redondeado (lathe) + llanta de 5 radios + disco y pinza
  const tp = []; const R = .43, w = .3, rr = .07;
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; tp.push(new T.Vector2(R - rr + Math.cos(a) * rr, -w / 2 + rr + Math.sin(a) * rr)); }
  for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; tp.push(new T.Vector2(R - rr + Math.cos(a) * rr, w / 2 - rr + Math.sin(a) * rr)); }
  tp.push(new T.Vector2(.27, w / 2 - .02)); tp.unshift(new T.Vector2(.27, -w / 2 + .02));
  const tyreG = new T.LatheGeometry(tp, 36); tyreG.rotateZ(Math.PI / 2);
  const rimParts = [new T.CylinderGeometry(.275, .275, .2, 32, 1, true)];
  const lip = new T.TorusGeometry(.272, .022, 8, 36); lip.rotateY(Math.PI / 2); lip.translate(.12, 0, 0); rimParts.push(lip.rotateZ(0));
  rimParts[0].rotateZ(Math.PI / 2);
  for (let k = 0; k < 5; k++) { const s = new T.BoxGeometry(.05, .25, .07); s.translate(0, .135, 0); s.rotateX(k / 5 * Math.PI * 2); s.translate(.1, 0, 0); rimParts.push(s); }
  const hub = new T.CylinderGeometry(.06, .07, .08, 12); hub.rotateZ(Math.PI / 2); hub.translate(.11, 0, 0); rimParts.push(hub);
  const rimG = merge(T, rimParts);
  const discG = new T.CylinderGeometry(.2, .2, .03, 28); discG.rotateZ(Math.PI / 2); discG.translate(.02, 0, 0);
  const caliperG = new T.BoxGeometry(.06, .14, .1); caliperG.translate(.05, .12, -.08);
  // detalles
  const headG = new T.RoundedBoxGeometry(.46, .11, .08, 2, .03), tailG = new T.RoundedBoxGeometry(1.5, .09, .06, 2, .03);
  const grilleG = new T.RoundedBoxGeometry(1.1, .16, .06, 2, .03), mirrorG = new T.RoundedBoxGeometry(.18, .1, .12, 2, .03), exhG = new T.CylinderGeometry(.055, .055, .2, 14);
  exhG.rotateX(Math.PI / 2);
  const wingG = new T.RoundedBoxGeometry(1.8, .05, .34, 2, .02), strutG = new T.BoxGeometry(.05, .17, .1), splitG = new T.RoundedBoxGeometry(1.9, .04, .22, 2, .015), sillG = new T.RoundedBoxGeometry(.06, .08, 2.1, 2, .03);
  const mats = {
    tyre: new T.MeshStandardMaterial({ color: 0x141414, roughness: .82, metalness: 0 }),
    rim: new T.MeshStandardMaterial({ color: 0xd0d4da, metalness: 1, roughness: .2 }),
    disc: new T.MeshStandardMaterial({ color: 0x777777, metalness: .9, roughness: .45 }),
    caliper: new T.MeshStandardMaterial({ color: 0xc41a1a, metalness: .3, roughness: .4 }),
    glass: new T.MeshPhysicalMaterial({ color: 0x0c1016, metalness: .1, roughness: .04, transparent: true, opacity: .5, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false }),
    head: new T.MeshBasicMaterial({ color: new T.Color(0xfff2d6).multiplyScalar(6) }),
    tail: new T.MeshBasicMaterial({ color: new T.Color(0xff1a10).multiplyScalar(5) }),
    trim: new T.MeshStandardMaterial({ color: 0x0b0b0c, metalness: .4, roughness: .5 }),
    chrome: new T.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 1, roughness: .12 }),
  };
  return { bodyG: bodyS, cabG: cabS2, roofG: roofS, tyreG, rimG, discG, caliperG, headG, tailG, grilleG, mirrorG, exhG, wingG, strutG, splitG, sillG, mats };
}
export const carPaint = (T, color) => new T.MeshPhysicalMaterial({ color, metalness: .55, roughness: .3, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.25 });

export function buildCar(T, K, paint) {
  const g = new T.Group(), M = K.mats, add = (geo, m, x, y, z, sh = true) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = sh; o.receiveShadow = true; g.add(o); return o; };
  const body = add(K.bodyG, paint, 0, 0, 0);
  const cab = add(K.cabG, M.glass, 0, 0, 0); cab.castShadow = true; cab.renderOrder = 2;
  const roof = add(K.roofG, paint, 0, 0, 0);
  add(K.grilleG, M.trim, 0, .56, -2.33, false);
  add(K.splitG, M.trim, 0, .32, -2.26);
  [-1, 1].forEach(s => { add(K.mirrorG, paint, s * .86, 1.2, -.6); add(K.sillG, M.trim, s * .99, .3, 0, false); add(K.exhG, M.chrome, s * .42, .36, 2.36, false); add(K.headG, M.head, s * .66, .8, -2.3, false); });
  add(K.tailG, M.tail, 0, .98, 2.31, false);
  add(K.wingG, paint, 0, 1.46, 2.0); [-.6, .6].forEach(x => add(K.strutG, M.trim, x, 1.3, 2.0));
  const wheels = [[-1, 1.48], [1, 1.48], [-1, -1.48], [1, -1.48]].map(([s, z]) => {
    const wg = new T.Group(); wg.position.set(s * .92, .43, z); wg.scale.x = s; g.add(wg);
    const spin = new T.Group(); wg.add(spin);
    const ty = new T.Mesh(K.tyreG, M.tyre); ty.castShadow = true; spin.add(ty);
    const rim = new T.Mesh(K.rimG, M.rim); spin.add(rim);
    const disc = new T.Mesh(K.discG, M.disc); wg.add(disc); const cal = new T.Mesh(K.caliperG, M.caliper); wg.add(cal);
    return spin;
  });
  return { g, body, cab, roof, wheels };
}

// ---------- moto con piloto (piezas añadidas con `part`) ----------
// mats: { paint, frame, shirt, pant, chrome, tyre, head, skin }
export function buildBike(T, part, mats) {
  const wheel = z => {
    const wg = new T.Group(); wg.position.set(0, .46, z); wg.userData.wheel = true;
    const tyre = new T.Mesh(new T.TorusGeometry(.35, .11, 14, 36), mats.tyre); tyre.rotation.y = Math.PI / 2; tyre.castShadow = true; wg.add(tyre);
    const rim = new T.Mesh(new T.TorusGeometry(.26, .025, 8, 32), mats.chrome); rim.rotation.y = Math.PI / 2; wg.add(rim);
    for (let k = 0; k < 8; k++) { const s = new T.Mesh(new T.CylinderGeometry(.01, .01, .5, 4), mats.chrome); s.rotation.x = k / 8 * Math.PI; wg.add(s); }
    const hub = new T.Mesh(new T.CylinderGeometry(.06, .06, .16, 12), mats.frame); hub.rotation.z = Math.PI / 2; wg.add(hub);
    return part(wg);
  };
  const wheels = [wheel(-.8), wheel(.76)];
  const cap = (r, l, m, x, y, z, rx = 0, rz = 0) => { const o = new T.Mesh(new T.CapsuleGeometry(r, l, 6, 12), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.castShadow = true; return part(o); };
  // chasis y depósito
  cap(.05, .9, mats.frame, 0, .72, -.05, Math.PI / 2 - .25);
  const tank = new T.Mesh(new T.SphereGeometry(.3, 24, 16), mats.paint); tank.scale.set(.85, .62, 1.25); tank.position.set(0, 1.0, -.22); tank.castShadow = true; part(tank);
  const seat = new T.Mesh(new T.RoundedBoxGeometry(.34, .1, .7, 3, .05), mats.frame); seat.position.set(0, .98, .4); seat.castShadow = true; part(seat);
  const cowl = new T.Mesh(new T.RoundedBoxGeometry(.32, .22, .5, 3, .08), mats.paint); cowl.position.set(0, .86, .78); cowl.rotation.x = .3; cowl.castShadow = true; part(cowl);
  const eng = new T.Mesh(new T.RoundedBoxGeometry(.34, .3, .4, 2, .05), mats.chrome); eng.position.set(0, .62, -.08); eng.castShadow = true; part(eng);
  cap(.03, .72, mats.chrome, 0, .86, -.66, -.35);                           // horquilla
  cap(.025, .78, mats.frame, 0, 1.28, -.6, 0, Math.PI / 2);                 // manillar
  const lamp = new T.Mesh(new T.SphereGeometry(.11, 16, 12), mats.head); lamp.position.set(0, 1.06, -.86); part(lamp);
  cap(.05, .55, mats.chrome, .2, .55, .42, Math.PI / 2 - .2);               // escape
  // piloto
  const torso = new T.Mesh(new T.CapsuleGeometry(.2, .32, 6, 14), mats.shirt); torso.position.set(0, 1.5, .1); torso.rotation.x = -.6; torso.scale.set(1.25, 1, .85); torso.castShadow = true; part(torso);
  [-.18, .18].forEach(x => {
    cap(.085, .42, mats.pant, x, 1.08, .18, Math.PI / 2 - .1);              // muslo
    cap(.07, .34, mats.pant, x * 1.15, .78, -.06, .35);                     // pierna
    cap(.065, .4, mats.shirt, x * 1.55, 1.44, -.28, .95);                   // brazo
  });
  return wheels;
}

// ---------- vegetación ----------
export function treeGeos(T, mob) {
  const blob = displace(T, new T.IcosahedronGeometry(1, mob ? 2 : 3), .22, 1.4, 3);
  const cone = (() => { const g = new T.ConeGeometry(1, 1, 16, 8); g.translate(0, .5, 0); const p = g.attributes.position, n = new T.SimplexNoise();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + .18 * n.noise3d(x * 3, y * 6, z * 3); p.setXYZ(i, x * k, y, z * k); } g.computeVertexNormals(); return g; })();
  const trunk = (() => { const g = new T.CylinderGeometry(.14, .3, 1, 8, 4); g.translate(0, .5, 0); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 3.1) * .06); } g.computeVertexNormals(); return g; })();
  const bush = displace(T, new T.IcosahedronGeometry(1, mob ? 1 : 2), .3, 1.8, 7);
  return { blob, cone, trunk, bush };
}
// balanceo con el viento (vertex shader de las copas instanciadas)
export function windify(mat, uTime, amp = .12, y0 = 1) {
  mat.customProgramCacheKey = () => 'wind' + amp + y0;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz; float h = max(0., position.y + ${y0.toFixed(1)});
        float w = sin(uTime * 1.3 + ip.x * .05 + ip.z * .04) + .4 * sin(uTime * 2.7 + ip.z * .11);
        transformed.x += w * ${amp.toFixed(3)} * h; transformed.z += w * ${(amp * .6).toFixed(3)} * h;
      #endif`);
  };
  return mat;
}
