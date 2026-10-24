import { carKit, carPaint, buildCar, buildBike, treeGeos, windify } from './models.js';
import { $, esc, faceCanvas, flareCanvas, glowCanvas, loadImg, loadThree, noiseFactory, photoFor, rand, rrect, synth, textCanvas } from '@kit';


// =====================================================================
//  FAST & FURIOUS 3D — "el último viaje". Montaje calcado del final de
//  Furious 7 (desde 1:52): aéreo trasero, miradas entre conductores,
//  cenital, bifurcación, aéreo amplio, atardecer y fundido a blanco.
// =====================================================================
// ---- personajes de la saga (sin fotos: emoji + nombre) ----
const FF_CHAR = { Toretto: '👨🏻‍🦲', Paul: '👱🏼‍♂️', Letty: '👩🏻', Roman: '😎', Tej: '🧑🏾‍🔧', Han: '🧑🏻', Mia: '👩🏼', Hobbs: '👨🏾‍🦲', Shaw: '🧔🏻', Gisele: '👩🏽' };
const FF_PHOTO = { Toretto: 'furious/toretto.jpg', Paul: 'furious/paul.jpg' }, ffImgs = {};
function ffCharCanvas(name, color){
  const c = document.createElement('canvas'); c.width = 256; c.height = 300; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 100, 10, 128, 128, 120); gr.addColorStop(0, '#5a4a3c'); gr.addColorStop(1, '#16120f');
  g.beginPath(); g.arc(128, 128, 112, 0, 7); g.fillStyle = gr; g.fill();
  g.font = '150px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; if (ffImgs[name]){ g.save(); g.beginPath(); g.arc(128, 128, 112, 0, 7); g.clip(); g.drawImage(ffImgs[name], 16, 16, 224, 224); g.restore(); } else g.fillText(FF_CHAR[name] || '🏎️', 128, 142);
  g.lineWidth = 12; g.strokeStyle = color; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
  g.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif'; const w = Math.min(250, g.measureText(name).width + 26); rrect(g, 128 - w / 2, 252, w, 44, 14); g.fillStyle = '#120612'; g.fill(); g.fillStyle = '#fff'; g.fillText(name, 128, 275, 230);
  return c;
}
export async function playFurious(X){
  const { teams, win, A, later, opts } = X;
  const _vs = { get fxStop(){ return X.getStop(); }, set fxStop(f){ X.setStop(f); } };
  const T0 = await loadThree(); if (!X.isOpen()) return;
  const layer = $('#vsLayer'), fx = $('#vsFx');
  const imgs = await Promise.all([loadImg($('#vsHero').src), ...teams.flatMap(t => t.members.map(m => loadImg(photoFor(m.name))))]);
  if (!X.isOpen()) return;
  const heroImg = imgs.shift();
  const [matiImg, crocImg, torImg, paulImg, alvImg] = await Promise.all([X.media('mati/hero.jpg'), X.media('mati/croc.jpg'), X.media(FF_PHOTO.Toretto), X.media(FF_PHOTO.Paul), X.media('alvaro/alvaro.jpg')]);
  ffImgs.Toretto = torImg; ffImgs.Paul = paulImg;
  if (!X.isOpen()) return;
  // sol: malla HDR lejana que sirve de fuente a los rayos crepusculares y al bloom
  const sunDir = new T0.Vector3(-.3, .075, -1).normalize();
  const sunMesh = new T0.Mesh(new T0.SphereGeometry(1, 16, 8), new T0.MeshBasicMaterial({ color: new T0.Color(1, .86, .62).multiplyScalar(6), transparent: true, depthWrite: false, fog: false }));
  sunMesh.scale.setScalar(95); sunMesh.frustumCulled = false;
  const ctx = await X.three({ clear: 0xe9b07a, fov: 38, near: .3, far: 4000, env: false, tone: 'aces_filmic',
    bloom: { intensity: .5, threshold: 1.3, radius: .8, smoothing: .4 },
    ao: { radius: 2.4, intensity: 2.6, falloff: 1.6, color: 0x1c0d06 },
    godrays: { sun: sunMesh, o: { density: .92, decay: .94, weight: .3, exposure: .3 } },
    vignette: { offset: .3, darkness: .42 }, ca: .0005, grain: .035 });
  if (!ctx) return;
  const { T, scene, cam, tex, renderer, q } = ctx, W = ctx.W, H = ctx.H, narrow = W / H < .8, mob = q.mob;
  scene.add(sunMesh);
  const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };

  // ---- bandas de cine + rótulos ----
  const ov = document.createElement('div'); ov.className = 'ff-ov';
  ov.innerHTML = '<div class="ff-vig"></div><div class="ff-leak"></div><div class="ff-grain"></div><div class="ff-bar t"></div><div class="ff-bar b"></div><div class="ff-cap ff-title"></div><div class="ff-cap ff-mid"></div><div class="ff-cap ff-end"></div><div class="ff-fade"></div><div class="ff-for"></div>';
  fx.appendChild(ov);
  { const gc = document.createElement('canvas'); gc.width = gc.height = 160; const g = gc.getContext('2d'), id = g.createImageData(160, 160);
    for (let i = 0; i < id.data.length; i += 4){ const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 34; }
    g.putImageData(id, 0, 0); ov.querySelector('.ff-grain').style.backgroundImage = `url(${gc.toDataURL()})`; }
  const capT = ov.querySelector('.ff-title'), capM = ov.querySelector('.ff-mid'), capE = ov.querySelector('.ff-end'), fade = ov.querySelector('.ff-fade'), forP = ov.querySelector('.ff-for');
  capT.innerHTML = `<b>${win ? A.winTitle : A.title}</b><small>${win ? esc(teams[0].name) : A.sub}</small>`;
  capM.innerHTML = '';
  capE.innerHTML = win ? `<b>Para los campeones</b><small>${esc(teams[0].name)}</small>` : '<b>Cada equipo, su camino</b><small>nos vemos en la próxima pachanga</small>';
  forP.textContent = win ? 'PARA PAUL' : 'PARA LA PACHANGA';

  // ---- trazado ----
  const n = teams.length, LANE = 3.4, V = 23, Z0 = 430;
  const tFork = win ? 999 : 19.4, zF = Z0 - V * tFork;
  const xm = z => 14 * Math.sin(z * .0105) + 7 * Math.sin(z * .0037 + 1);
  const spread = i => n === 1 ? 0 : (i - (n - 1) / 2) * 2 / (n - 1);
  const xb = (i, z) => xm(z) + spread(i) * 13 * Math.pow(Math.max(0, zF - z) / 55, 1.3);
  const ry = z => 2.4 * Math.sin(z * .009) + 1.1 * Math.sin(z * .021);

  // ---- relieve: crestas + valle de la carretera ----
  const nz = noiseFactory(17), nz2 = noiseFactory(71), nz3 = noiseFactory(5);
  const fbm = (x, z, o) => { let a = 0, f = 1, amp = .5; for (let i = 0; i < o; i++){ a += amp * nz(x * f, 0, z * f); f *= 2.03; amp *= .5; } return a; };
  const ridge = (x, z, o) => { let a = 0, f = 1, amp = .5, w = 1; for (let i = 0; i < o; i++){ let v = 1 - Math.abs(nz2(x * f, 3, z * f)); v *= v; a += v * amp * w; w = Math.min(1, v * 1.6); f *= 2.1; amp *= .5; } return a; };
  const roadDist = (x, z) => { let d = Math.abs(x - (z > zF ? xm(z) : xb(0, z))); if (z <= zF) for (let b = 1; b < n; b++) d = Math.min(d, Math.abs(x - xb(b, z))); return d; };
  function Hgt(x, z){
    const d = roadDist(x, z), w = Math.min(1, Math.max(0, (d - 15) / 30)), far = Math.min(1, Math.max(0, (d - 22) / 150));
    const big = Math.pow(ridge(x * .0042, z * .0042, 5), 1.35) * 230 * far;
    const hills = (fbm(x * .011, z * .011, 4) * .5 + .5) * 34 * w;
    const bumps = fbm(x * .05, z * .05, 2) * 4 * w;
    return ry(z) - .35 + big + hills + bumps;
  }

  // ---- cielo del atardecer (Preetham) + entorno PMREM para los reflejos ----
  const skyUp = (sk, sc) => { const u = sk.material.uniforms; u.turbidity.value = 7.5; u.rayleigh.value = 2.4; u.mieCoefficient.value = .006; u.mieDirectionalG.value = .88; u.sunPosition.value.copy(sunDir); u.showSunDisc.value = 0; u.cloudCoverage.value = .32; u.cloudDensity.value = .5; u.cloudElevation.value = .45; sk.scale.setScalar(sc); sk.frustumCulled = false; return sk; };
  const sky = skyUp(new T.Sky(), 3500); scene.add(sky);
  const skyBase = { mie: .006, ray: 2.4, tur: 7.5 };
  let envTex = null;
  { const pm = new T.PMREMGenerator(renderer), es = new T.Scene(); es.add(skyUp(new T.Sky(), 600));
    const gr = new T.Mesh(new T.CircleGeometry(900, 24).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x5a3a24 })); gr.position.y = -2; es.add(gr);
    const rt = pm.fromScene(es, 0, 1, 3000); envTex = rt.texture; scene.environment = envTex; scene.environmentIntensity = .1; pm.dispose(); }
  // el «brillo» del cielo (antes un uniform propio) ahora engorda la dispersión de Mie y el halo
  const setGlow = v => { const u = sky.material.uniforms; u.mieCoefficient.value = skyBase.mie * v; u.turbidity.value = skyBase.tur + (v - 1) * 2.5; u.rayleigh.value = skyBase.ray + (v - 1) * .3; };
  const envify = (m, k) => { m.envMap = envTex; m.envMapIntensity = k; return m; };
  scene.fog = new T.Fog(0xe0a070, 260, 2200);
  // luz física: el sol rasante (algo más alto que el disco para que el relieve reciba luz), relleno cálido y contraluz frío
  const lightDir = new T.Vector3(-.3, .19, -1).normalize();
  scene.add(new T.HemisphereLight(0xffd0a0, 0x3a2a20, .75));
  const sunL = new T.DirectionalLight(0xffcc9a, 3.4);
  ctx.sun(sunL, { size: 72, res: q.shadow, radius: 3.5, near: 10, far: 1400, bias: -.0006, normalBias: .05 });
  scene.add(sunL, sunL.target);
  const fillL = new T.DirectionalLight(0xa9b4d8, 1.2); fillL.position.set(.4, .5, 1); scene.add(fillL);
  const uTime = { value: 0 };

  // ---- terreno: albedo sin hornear (la luz y las sombras son reales) ----
  const TS = 2600, TN = mob ? 300 : 440;
  const tg = new T.PlaneGeometry(TS, TS, TN, TN); tg.rotateX(-Math.PI / 2); tg.translate(0, 0, -450);
  const P = tg.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, Hgt(P.getX(i), P.getZ(i)));
  tg.computeVertexNormals();
  const N = tg.attributes.normal, cols = new Float32Array(P.count * 3), col = new T.Color();
  const cGrass = new T.Color('#a8924f'), cScrub = new T.Color('#5c5f26'), cDark = new T.Color('#3a4019'), cRock = new T.Color('#9a7552'), cSand = new T.Color('#c9a46a');
  for (let i = 0; i < P.count; i++){
    const x = P.getX(i), z = P.getZ(i);
    const k = fbm(x * .018 + 9, z * .018, 3) * .5 + .5, k2 = nz3(x * .07, 2, z * .07) * .5 + .5, k3 = nz3(x * .4, 5, z * .4) * .5 + .5;
    col.copy(cGrass).lerp(cScrub, Math.min(1, k * 1.25)).lerp(cDark, Math.max(0, k2 - .45) * 1.4);
    const slope = 1 - N.getY(i); if (slope > .35) col.lerp(cRock, Math.min(1, (slope - .35) * 2.2));
    if (roadDist(x, z) < 8) col.lerp(cSand, .55);
    col.multiplyScalar(.82 + .3 * k3);   // moteado fino de la hierba seca
    cols.set([col.r, col.g, col.b], i * 3);
  }
  tg.setAttribute('color', new T.BufferAttribute(cols, 3));
  const terrain = new T.Mesh(tg, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })); terrain.receiveShadow = true; scene.add(terrain);

  // monte bajo (chaparral) junto a la carretera
  const G = treeGeos(T, mob);
  const BN = mob ? 3500 : 8000;
  const bushes = new T.InstancedMesh(G.bush, windify(new T.MeshStandardMaterial({ color: 0xffffff, roughness: .95, metalness: 0 }), uTime, .05), BN);
  { const d = new T.Object3D(), c = new T.Color(); let nb = 0;
    for (let i = 0; i < BN; i++){
      const z = 650 - Math.random() * 1750, side = Math.random() < .5 ? -1 : 1, off = 9 + Math.pow(Math.random(), 1.6) * 170;
      const base = z > zF ? xm(z) : xb(rand(n), z), x = base + side * off;
      if (roadDist(x, z) < 8.5) continue;
      const s = .45 + Math.pow(Math.random(), 2) * 1.5;
      d.position.set(x, Hgt(x, z) - s * .12, z); d.scale.set(s, s * (.42 + Math.random() * .25), s); d.rotation.set(0, Math.random() * 6, 0); d.updateMatrix(); bushes.setMatrixAt(nb, d.matrix);
      c.setHSL(.15 + Math.random() * .07, .35 + Math.random() * .2, .1 + Math.random() * .09, T.SRGBColorSpace); bushes.setColorAt(nb++, c);
    } bushes.count = nb; bushes.instanceColor.needsUpdate = true; }
  bushes.castShadow = true; bushes.receiveShadow = true; scene.add(bushes);

  // árboles: pinos piñoneros, cipreses y encinas a lo largo de los caminos
  const TN2 = mob ? 900 : 2200, TB = TN2 * 2, treeRec = []; let curBase = null;
  const leafM = windify(new T.MeshStandardMaterial({ color: 0xffffff, roughness: .92, metalness: 0 }), uTime, .14), coneM = windify(new T.MeshStandardMaterial({ color: 0xffffff, roughness: .92, metalness: 0 }), uTime, .1, 0);
  const trunks = new T.InstancedMesh(G.trunk, new T.MeshStandardMaterial({ color: 0x4a3426, roughness: .95 }), TN2);
  const blobs = new T.InstancedMesh(G.blob, leafM, TB), cones = new T.InstancedMesh(G.cone, coneM, TN2);
  { const d = new T.Object3D(), cc = new T.Color(); let nt = 0, nb = 0, nc = 0;
    const put = (im, i, x, y, z, sx, sy, sz, ry0) => { d.position.set(x, y, z); d.scale.set(sx, sy, sz); d.rotation.set(0, ry0, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); treeRec.push({ im, i, x, y, z, sx, sy, sz, r0: ry0, b: curBase }); };
    for (let tries = 0; tries < TN2 * 3 && nt < TN2 && nb < TB - 2; tries++){
      const z = 640 - Math.random() * 1900, side = Math.random() < .5 ? -1 : 1;
      // arboledas: se agrupan en bosquecillos, alguno muy pegado al arcén
      const grove = nz3(z * .02, 9, side * 3) > -.1, off = 10.5 + Math.pow(Math.random(), grove ? 1.1 : 2.2) * (grove ? 90 : 220);
      const base = z > zF ? xm(z) : xb(rand(n), z), x = base + side * off + (Math.random() - .5) * 6;
      if (roadDist(x, z) < 10.5) continue;
      const y = Hgt(x, z) - .2; curBase = [x, y, z]; const s = .6 + Math.random() * .55, r0 = Math.random() * 6.28, kind = Math.random();
      if (kind < .38){ // pino piñonero: tronco alto, copa en paraguas
        const h = 5.5 * s; put(trunks, nt++, x, y, z, s, h, s, r0);
        cc.setHSL(.24 + Math.random() * .06, .32, .14 + Math.random() * .07, T.SRGBColorSpace); put(blobs, nb, x, y + h, z, 2.5 * s, .85 * s, 2.3 * s, r0); blobs.setColorAt(nb++, cc);
        cc.offsetHSL(0, 0, .03); put(blobs, nb, x + .9 * s, y + h + .35 * s, z - .6 * s, 1.6 * s, .7 * s, 1.5 * s, r0 + 1); blobs.setColorAt(nb++, cc);
      } else if (kind < .7){ // ciprés: llama verde oscura
        put(trunks, nt++, x, y, z, s * .8, 1.2 * s, s * .8, r0);
        cc.setHSL(.29 + Math.random() * .05, .38, .1 + Math.random() * .05, T.SRGBColorSpace); put(cones, nc, x, y + .8 * s, z, 1.05 * s, (7 + Math.random() * 4) * s, 1.05 * s, r0); cones.setColorAt(nc++, cc);
      } else { // encina: dos copas redondas
        const h = 2.6 * s; put(trunks, nt++, x, y, z, s * 1.2, h, s * 1.2, r0);
        cc.setHSL(.17 + Math.random() * .08, .36, .17 + Math.random() * .08, T.SRGBColorSpace);
        put(blobs, nb, x, y + h + 1.3 * s, z, 2.5 * s, 2 * s, 2.5 * s, r0); blobs.setColorAt(nb++, cc);
        cc.offsetHSL(0, 0, .04); put(blobs, nb, x + 1.1 * s, y + h + .6 * s, z + .8 * s, 1.7 * s, 1.5 * s, 1.7 * s, r0); blobs.setColorAt(nb++, cc);
      }
    }
    trunks.count = nt; blobs.count = nb; cones.count = nc;
    [trunks, blobs, cones].forEach(m => { m.castShadow = true; m.receiveShadow = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); }); }

  // cordilleras lejanas en capas (bruma de atardecer)
  [[2050, 300, '#a8735a', .0014], [2600, 380, '#c48e6c', .001], [3150, 460, '#dca57e', .0007]].forEach(([dist, amp, c, f], j) => {
    const pts = [], seg = 160, Wd = 7000;
    for (let s = 0; s <= seg; s++){ const x = -Wd / 2 + Wd * s / seg; const h = Math.pow(ridge(x * f + j * 7, j * 3.3, 4), 1.3) * amp + 40; pts.push(x, h); }
    const pos = [], idx = []; for (let s = 0; s <= seg; s++){ pos.push(pts[s * 2], -60, 0, pts[s * 2], pts[s * 2 + 1], 0); if (s < seg){ const a = s * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, side: T.DoubleSide }));
    m.position.copy(sunDir.clone().setY(0).normalize().multiplyScalar(dist)); m.position.y = -20; m.lookAt(0, -20, 0); m.renderOrder = -1; scene.add(m);
  });

  // ---- carreteras: tramo común, cruce limpio y un ramal por equipo ----
  const aniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  const mkRoadTex = lines => { const S2 = 512, c = document.createElement('canvas'); c.width = S2; c.height = S2; const g = c.getContext('2d');
    g.fillStyle = '#35302d'; g.fillRect(0, 0, S2, S2);
    for (let i = 0; i < 9000; i++){ const v = 90 + rand(110); g.fillStyle = `rgba(${v + 20},${v + 10},${v},${.05 + Math.random() * .07})`; g.fillRect(rand(S2), rand(S2), 1 + rand(3), 1 + rand(3)); }
    // rodadas oscuras y pulidas por donde pasan las ruedas
    [[.2, .33], [.67, .8]].forEach(([a, b]) => { const gr = g.createLinearGradient(a * S2, 0, b * S2, 0); gr.addColorStop(0, 'rgba(15,12,12,0)'); gr.addColorStop(.5, 'rgba(15,12,12,.28)'); gr.addColorStop(1, 'rgba(15,12,12,0)'); g.fillStyle = gr; g.fillRect(a * S2, 0, (b - a) * S2, S2); });
    // parches de asfalto nuevo y grietas
    for (let i = 0; i < 4; i++){ g.fillStyle = `rgba(20,18,18,${.18 + Math.random() * .15})`; g.fillRect(40 + rand(400), rand(S2), 40 + rand(70), 30 + rand(80)); }
    g.strokeStyle = 'rgba(12,10,10,.55)'; g.lineWidth = 1.2;
    for (let i = 0; i < 16; i++){ let x = 30 + rand(450), y = rand(S2); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++){ x += (Math.random() - .5) * 22; y += 6 + Math.random() * 16; g.lineTo(x, y); } g.stroke(); }
    if (lines){
      const worn = (x, w, col) => { for (let y = 0; y < S2; y += 4){ g.fillStyle = col.replace('A', (.7 + Math.random() * .3).toFixed(2)); g.fillRect(x, y, w, 4); } };
      worn(14, 9, 'rgba(232,226,208,A)'); worn(S2 - 23, 9, 'rgba(232,226,208,A)');
      worn(S2 / 2 - 10, 7, 'rgba(242,196,69,A)'); worn(S2 / 2 + 3, 7, 'rgba(242,196,69,A)');
    }
    const t = tex(c); t.wrapT = T.RepeatWrapping; t.anisotropy = aniso; return t; };
  const roadT = mkRoadTex(true), plainT = mkRoadTex(false);
  const gravelT = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, '#7c6248'); gr.addColorStop(.18, '#a88a62'); gr.addColorStop(.5, '#b39468'); gr.addColorStop(.82, '#a88a62'); gr.addColorStop(1, '#7c6248'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 3000; i++){ const v = 70 + rand(120); g.fillStyle = `rgba(${v + 30},${v + 15},${v},.35)`; g.fillRect(rand(128), rand(256), 1 + rand(2), 1 + rand(2)); }
    const t = tex(c); t.wrapT = T.RepeatWrapping; t.anisotropy = aniso; return t; })();
  function strip(cx, z1, z2, wf, segs, map, lift){
    const pos = [], uv = [], idx = [];
    for (let s = 0; s <= segs; s++){
      const z = z1 + (z2 - z1) * s / segs, x = cx(z), w = typeof wf === 'function' ? wf(z) : wf, dz = (z2 - z1) / segs, dx = cx(z + dz) - x, L = Math.hypot(dx, dz), nx = -dz / L, nzv = dx / L;
      pos.push(x - nx * w / 2, ry(z) + lift, z - nzv * w / 2, x + nx * w / 2, ry(z) + lift, z + nzv * w / 2);
      uv.push(0, s * Math.abs(dz) / 16, 1, s * Math.abs(dz) / 16);
      if (s < segs){ const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ map, roughness: map === gravelT ? .96 : .58, metalness: 0 }));
    m.receiveShadow = true; scene.add(m);
  }
  const mainW = Math.max(8.5, n * LANE + 2.6);
  let JL = 6; if (n > 1) while (JL < 120 && xb(1, zF - JL) - xb(0, zF - JL) < 7.6) JL += 1; JL += 4;
  strip(xm, Z0 + 320, win ? -1300 : zF, mainW + 4, 700, gravelT, .04);
  strip(xm, Z0 + 320, win ? -1300 : zF, mainW, 700, roadT, .1);
  if (!win) for (let i = 0; i < n; i++) strip(z => xb(i, z), zF - JL + 2, -1600, 10.4, 560, gravelT, .08);
  // balizas blancas con reflectante en los dos lados de cada camino
  { const paths = [[xm, Z0 + 300, win ? -1300 : zF, mainW / 2 + 1.3]]; if (!win) for (let i = 0; i < n; i++) paths.push([z => xb(i, z), zF - JL - 4, -1600, 4.9]);
    const posts = [], d = new T.Object3D();
    paths.forEach(([cx, z1, z2, half]) => { for (let z = z1; z > z2; z -= 22){ const x = cx(z), dx = cx(z - 1) - x, L = Math.hypot(dx, 1), nx = 1 / L, nzv = dx / L; [-1, 1].forEach(sd => posts.push([x + sd * nx * half, ry(z), z + sd * nzv * half])); } });
    const pm = new T.InstancedMesh(new T.BoxGeometry(.13, 1.05, .13).translate(0, .52, 0), new T.MeshStandardMaterial({ color: 0xe9e4da, roughness: .7 }), posts.length);
    const rm = new T.InstancedMesh(new T.BoxGeometry(.15, .16, .15).translate(0, .88, 0), new T.MeshBasicMaterial({ color: new T.Color(0xff8a2a).multiplyScalar(2.6) }), posts.length);
    posts.forEach(([x, y, z], i) => { d.position.set(x, y, z); d.updateMatrix(); pm.setMatrixAt(i, d.matrix); rm.setMatrixAt(i, d.matrix); });
    pm.castShadow = true; pm.receiveShadow = true; scene.add(pm, rm); }
  // postes de teléfono con sus cables combados: el viaje de siempre
  { const pz = [], d = new T.Object3D(); for (let z = Z0 + 280; z > (win ? -1250 : -1500); z -= 42) pz.push(z);
    const cxP = z => win || z > zF ? xm(z) : xb(0, z), off = (z) => (z > zF || win ? mainW / 2 : 3.6) + 5.5;
    const poleM = new T.MeshStandardMaterial({ color: 0x5a4636, roughness: .9 });
    const poles = new T.InstancedMesh(new T.CylinderGeometry(.14, .2, 9.5, 6).translate(0, 4.75, 0), poleM, pz.length), bars = new T.InstancedMesh(new T.BoxGeometry(2.6, .16, .16), poleM, pz.length);
    const tops = pz.map((z, i) => { const x = cxP(z) - off(z), y = Hgt(x, z) - .1; d.position.set(x, y, z); d.rotation.set(0, Math.atan2(cxP(z - 1) - cxP(z), 1), 0); d.updateMatrix(); poles.setMatrixAt(i, d.matrix);
      d.position.y = y + 8.9; d.updateMatrix(); bars.setMatrixAt(i, d.matrix); return [x, y + 8.9, z]; });
    poles.castShadow = bars.castShadow = true; poles.receiveShadow = bars.receiveShadow = true; scene.add(poles, bars);
    const wp = []; for (let i = 0; i + 1 < tops.length; i++){ const [ax, ay, az] = tops[i], [bx, by, bz] = tops[i + 1];
      [-1.15, 0, 1.15].forEach(o => { let px = ax + o, py = ay + .06, pzz = az; for (let s = 1; s <= 10; s++){ const k = s / 10, sag = Math.sin(k * Math.PI) * 1.1;
        const qx = ax + (bx - ax) * k + o, qy = ay + (by - ay) * k + .06 - sag, qz = az + (bz - az) * k; wp.push(px, py, pzz, qx, qy, qz); px = qx; py = qy; pzz = qz; } }); }
    const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3));
    scene.add(new T.LineSegments(wg, new T.LineBasicMaterial({ color: 0x1d1512, transparent: true, opacity: .75 }))); }
  if (!win){
    // cruce: un único asfalto liso que se ensancha hasta separar los ramales
    strip(z => { let a = 0; for (let i = 0; i < n; i++) a += xb(i, z); return a / n; }, zF + 1, zF - JL, z => Math.max(mainW, Math.abs(xb(n - 1, z) - xb(0, z)) + 7.2), 40, plainT, .12);
    for (let i = 0; i < n; i++) strip(z => xb(i, z), zF - JL + 2, -1600, 7.2, 560, roadT, .14);
  }

  // ---- valla con la foto del chico ----
  if (!win && heroImg){
    const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 512; const g = bc.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, '#16161c'); gr.addColorStop(1, '#3a2a22'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
    const s = Math.min(heroImg.width / 300, heroImg.height / 460); g.drawImage(heroImg, (heroImg.width - 300 * s) / 2, (heroImg.height - 460 * s) / 2, 300 * s, 460 * s, 40, 26, 300, 460);
    g.fillStyle = '#f2e6cf'; g.font = '800 86px "Plus Jakarta Sans", system-ui, sans-serif'; g.fillText('LERELIO', 380, 190); g.font = '500 40px Geist, system-ui, sans-serif'; g.fillStyle = '#e8a35a'; g.fillText('presenta: el último viaje', 384, 260);
    const zB = Z0 - 70, xB = xm(zB) + mainW / 2 + 8;
    const board = new T.Group(); board.position.set(xB, ry(zB), zB); board.rotation.y = -.45; scene.add(board);
    const bt = tex(bc), steel = new T.MeshStandardMaterial({ color: 0x55504a, roughness: .5, metalness: .7 });
    // la valla se ilumina por dentro (emisiva) para que se lea a contraluz
    const panel = new T.Mesh(new T.BoxGeometry(12, 6, .3), [steel, steel, steel, steel, new T.MeshStandardMaterial({ map: bt, emissiveMap: bt, emissive: 0xffd6a8, emissiveIntensity: .55, roughness: .6 }), steel]);
    panel.position.y = 7.5; panel.castShadow = true; panel.receiveShadow = true; board.add(panel);
    const fr = new T.Mesh(new T.BoxGeometry(12.5, 6.5, .2), steel); fr.position.set(0, 7.5, -.12); fr.castShadow = true; board.add(fr);
    [-4, 4].forEach(x => { const p = new T.Mesh(new T.CylinderGeometry(.18, .2, 7.5, 10), steel); p.position.set(x, 3.75, -.3); p.castShadow = true; board.add(p);
      const lamp = new T.Mesh(new T.BoxGeometry(.9, .14, .3), new T.MeshBasicMaterial({ color: new T.Color(0xfff0cc).multiplyScalar(5) })); lamp.position.set(x * .9, 11, .4); board.add(lamp); });
  }

  // ---- coches ----
  const K = carKit(T); Object.values(K.mats).forEach(m => { if (m.isMeshStandardMaterial) envify(m, m === K.mats.glass ? 1.6 : 1); });
  const tailGlowT = tex(glowCanvas([[0, 'rgba(255,60,40,1)'], [.3, 'rgba(255,40,20,.5)'], [1, 'rgba(255,20,0,0)']]));
  const PAINT = [0xf2f2f4, 0x2a2c31, 0x8a1a1a, 0x1a3a7a];
  let ii = 0;
  const per = Math.max(...teams.map(t => t.members.length));
  const caps = teams.map(t => rand(t.members.length));
  const cars = teams.flatMap((t, ti) => t.members.map((m, k) => {
    const paint = envify(carPaint(T, win ? PAINT[ti % 4] : 0x9a9ca4), 1.3);
    const car = buildCar(T, K, paint), g = car.g, cab = car.cab;
    [-.62, .62].forEach(x => { const gl = new T.Sprite(new T.SpriteMaterial({ map: tailGlowT, ...AB, opacity: .55, color: new T.Color(1.5, .7, .7), fog: false })); gl.scale.set(.55, .3, 1); gl.position.set(x, .98, 2.45); g.add(gl); });
    const glowM = new T.MeshBasicMaterial({ color: new T.Color(t.bar).multiplyScalar(1.6), ...AB, opacity: 0 });
    const under = new T.Mesh(new T.PlaneGeometry(2.7, 5.4), glowM); under.rotation.x = -Math.PI / 2; under.position.y = .06; g.add(under);
    const isCap = k === caps[ti], faceT = tex(faceCanvas(m.name, isCap ? '#ffcc33' : t.bar, imgs[ii++], isCap ? '★ ' + m.name : m.name));
    const face = new T.Sprite(new T.SpriteMaterial({ map: faceT, transparent: true })); const fs0 = isCap ? 2.05 : 1.45; face.scale.set(fs0, fs0 * 300 / 256, 1); face.position.y = isCap ? 3.1 : 2.8; g.add(face);
    const driver = new T.Sprite(new T.SpriteMaterial({ map: faceT, transparent: true })); driver.scale.set(.82, .82 * 300 / 256, 1); driver.position.set(-.4, 1.3, .2); g.add(driver);
    // copiloto del capitán: Toretto, Paul o el personaje de su equipo
    let pass = null, pb = null, passName = '';
    if (isCap){
      const nm = (t.name || '').replace(/^Team\s+/i, ''); passName = FF_CHAR[nm] ? nm : 'Toretto'; if (win && passName === 'Paul') passName = 'Toretto';
      const pT = tex(ffCharCanvas(passName, t.bar));
      pass = new T.Sprite(new T.SpriteMaterial({ map: pT, transparent: true })); pass.scale.set(.78, .78 * 300 / 256, 1); pass.position.set(.42, 1.24, 1.15); g.add(pass);
      pb = new T.Sprite(new T.SpriteMaterial({ map: pT, transparent: true })); pb.scale.set(1.3, 1.3 * 300 / 256, 1); pb.position.set(1.05, 2.95, 0); g.add(pb); face.position.x = -.7;
    }
    scene.add(g);
    return { g, paint, roof: car.roof, wheels: car.wheels, glowM, face, driver, cab, ti, k, m, team: t, fs0, pass, pb, passName, ph: Math.random() * 6.28 };
  }));
  cars.forEach(c => { const cp = caps[c.ti]; c.slot = c.k === cp ? 0 : c.k < cp ? c.k + 1 : c.k; c.captain = c.k === cp; });
  const haloT = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'); g.strokeStyle = '#ffd24a'; g.shadowColor = '#ffb020'; g.shadowBlur = 18; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 100, 0, Math.PI * 2); g.stroke(); g.lineWidth = 4; g.setLineDash([14, 12]); g.beginPath(); g.arc(128, 128, 82, 0, Math.PI * 2); g.stroke(); return tex(cv); })();
  const dustT = tex(glowCanvas([[0, 'rgba(235,200,150,.9)'], [.5, 'rgba(210,170,120,.35)'], [1, 'rgba(200,160,110,0)']]));
  cars.forEach(c => {
    if (c.captain){ const h = new T.Mesh(new T.PlaneGeometry(6.4, 6.4), new T.MeshBasicMaterial({ map: haloT, ...AB, opacity: 0, depthWrite: false })); h.rotation.x = -Math.PI / 2; h.position.y = .12; c.g.add(h); c.halo = h; }
    const DN = 40, dp = new Float32Array(DN * 3).fill(-9999); c.dustA = Float32Array.from({ length: DN }, () => Math.random());
    const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3));
    c.dust = new T.Points(dg, new T.PointsMaterial({ map: dustT, size: 2.6, transparent: true, opacity: 0, depthWrite: false })); c.dust.frustumCulled = false; scene.add(c.dust);
  });
  const order = []; for (let r = 0; r < per; r++) teams.forEach((t, ti) => { const c = cars.find(x => x.ti === ti && x.slot === r); if (c) order.push(c); });
  const tA0 = win ? -1 : 1.2, tAstep = win ? 0 : Math.min(.5, 4 / cars.length);
  order.forEach((c, i) => { c.single = i; c.tA = tA0 + i * tAstep; });

  // interior: marco de ventanilla y salpicadero pegados a la cámara
  const interior = new T.Group(); cam.add(interior); scene.add(cam); interior.visible = false;
  { const dark = new T.MeshBasicMaterial({ color: 0x0b0a09, fog: false }), seat = new T.MeshBasicMaterial({ color: 0x2a211b, fog: false });
    const vh = Math.tan(T.MathUtils.degToRad(19)) * 2, vw = vh * W / H;
    const mk = (w, h, x, y, m) => { const p = new T.Mesh(new T.PlaneGeometry(w, h), m || dark); p.position.set(x, y, -2); interior.add(p); };
    mk(vw * 2.2, vh * .55, 0, -vh * .82);          // puerta / salpicadero
    mk(vw * .32, vh * 2.4, -vw * .9, 0);           // pilar A
    mk(vw * 2.2, vh * .32, 0, vh * .94);           // techo
    mk(vw * .12, vh * 2.4, vw * .62, 0, seat);     // reposacabezas
  }

  // nombres sobre cada carretera y sol
  const tagS = teams.map(t => { const s = new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas(t.name, { size: 110, w: 1024, h: 190, glow: t.bar, grad: ['#ffffff', '#ffe9c4', t.bar] })), transparent: true, opacity: 0, depthTest: false, fog: false })); scene.add(s); return s; });
  const sunGlow = new T.Sprite(new T.SpriteMaterial({ map: tex(glowCanvas([[0, 'rgba(255,250,235,1)'], [.1, 'rgba(255,224,170,.85)'], [.35, 'rgba(255,170,90,.25)'], [1, 'rgba(0,0,0,0)']])), ...AB, depthTest: false, fog: false }));
  sunGlow.position.copy(sunDir).multiplyScalar(3000); sunGlow.scale.setScalar(520); scene.add(sunGlow);
  const ghosts = [[.3, 'hex', '255,200,140', 60], [.55, 'ring', '255,170,110', 120], [.8, 'hex', '200,220,255', 40], [1.2, 'ring', '255,210,160', 180]].map(([f, k, rgb, s]) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: tex(flareCanvas(k, rgb)), ...AB, depthTest: false, fog: false, opacity: 0 })); sp.userData = { f, s }; cam.add(sp); return sp; });

  // motas de polen dorado flotando alrededor de la cámara
  const MN = narrow ? 260 : 520, MB = 46;
  const moteBase = Float32Array.from({ length: MN * 3 }, () => (Math.random() - .5) * MB), moteV = Float32Array.from({ length: MN * 3 }, (_, i) => i % 3 === 1 ? .15 + Math.random() * .35 : (Math.random() - .5) * .9);
  const moteG = new T.BufferGeometry(); moteG.setAttribute('position', new T.BufferAttribute(new Float32Array(MN * 3), 3));
  const motes = new T.Points(moteG, new T.PointsMaterial({ map: tex(glowCanvas([[0, 'rgba(255,248,220,1)'], [.3, 'rgba(255,214,140,.7)'], [1, 'rgba(255,180,90,0)']])), size: .32, ...AB, opacity: .7, fog: false }));
  motes.frustumCulled = false; scene.add(motes);
  // bandada de pájaros que vuela hacia el sol
  const birdT = (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const g = cv.getContext('2d'); g.strokeStyle = '#24140f'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(8, 18); g.quadraticCurveTo(38, 14, 64, 44); g.quadraticCurveTo(90, 14, 120, 18); g.stroke(); return tex(cv); })();
  const birds = Array.from({ length: 9 }, (_, i) => { const s = new T.Sprite(new T.SpriteMaterial({ map: birdT, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    s.userData = { ox: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 7, oy: -Math.ceil(i / 2) * 3.2 + Math.random(), ph: Math.random() * 6 }; scene.add(s); return s; });
  const birdBase = new T.Vector3(), sunFlat = sunDir.clone().setY(0).normalize(), sideV = new T.Vector3(-sunFlat.z, 0, sunFlat.x);

  // ---- movimiento: cada equipo en su carril desde el principio ----
  const SP = 10.5, ease = k => k < .5 ? 4 * k ** 3 : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const smt = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const lead = t => Z0 - V * t;
  const calm = t => win ? 1 : 1 - smt(4.6, 5.8, t) + smt(12, 13.4, t);   // 0 durante las miradas
  const PT = win || n < 2 ? 0 : 1;                                          // el equipo de Paul
  let st = 0, rtNow = 0, frozen = false, saved = false, savedK = 0, stR = 0, egg = null, S = null;
  function laneX0(ti, z, sv){
    const lo = (ti - (n - 1) / 2) * LANE;
    if (z > zF + 25) return xm(z) + lo;
    const mg = sv && n > 1 && ti <= 1, tg = xb(mg ? 0 : ti, z) + (mg ? (ti === 0 ? -1.7 : 1.7) : 0);
    if (z > zF){ const k = smt(zF + 25, zF, z); return (xm(z) + lo) * (1 - k) + tg * k; }
    return tg;
  }
  const laneX = (ti, z) => { const a = laneX0(ti, z, false); return saved && savedK > 0 ? a + (laneX0(ti, z, true) - a) * ease(savedK) : a; };
  function carState(c, t){
    const surge = n > 1 ? Math.sin(t * .42 + c.ti * 2.2) * 4.5 * calm(t) : 0;
    const jz = c.slot === 0 ? 0 : Math.sin(t * .55 + c.ph) * 2 + Math.sin(t * .23 + c.ph * 2) * .9;
    const z = lead(t) - c.slot * SP + surge + jz;
    return { x: laneX(c.ti, z) + (c.slot === 0 ? 0 : Math.sin(t * .8 + c.ph * 3) * .4), y: ry(z), z };
  }
  const L0c = cars.find(x => x.ti === 0 && x.captain), L1c = cars.find(x => x.ti === 1 && x.captain) || L0c, PC = PT ? L1c : L0c;
  const sp = (c, t) => { const s = carState(c, t); return new T.Vector3(s.x, s.y, s.z); };

  // ---- easter egg: Mati en moto con su Stand ----
  const bike = new T.Group(); bike.visible = false; scene.add(bike);
  const bpM = envify(new T.MeshPhysicalMaterial({ color: 0x5b1aa8, metalness: .7, roughness: .3, clearcoat: 1, clearcoatRoughness: .06 }), 1.3), bkM = new T.MeshStandardMaterial({ color: 0x111114, metalness: .5, roughness: .5 });
  const shirtM = new T.MeshStandardMaterial({ color: 0x161616, roughness: .8 }), pantM = new T.MeshStandardMaterial({ color: 0xdedbd2, roughness: .9 });
  const bpart = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); bike.add(o); return o; };
  const bWheels = buildBike(T, bpart, { paint: bpM, frame: bkM, shirt: shirtM, pant: pantM, chrome: K.mats.chrome, tyre: K.mats.tyre, head: K.mats.head, skin: pantM });
  const nBase = bike.children.length;   // piezas de la moto sin el piloto... incluye al piloto (para la moto de Álvaro)
  { const c = document.createElement('canvas'); c.width = 256; c.height = 300; const g = c.getContext('2d');
    g.save(); g.beginPath(); g.arc(128, 128, 112, 0, 7); g.clip(); g.fillStyle = '#222'; g.fillRect(0, 0, 256, 256); if (matiImg) g.drawImage(matiImg, 200, 8, 170, 170, 16, 16, 224, 224); g.restore();
    g.lineWidth = 12; g.strokeStyle = '#b06cff'; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
    g.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; rrect(g, 68, 252, 120, 44, 14); g.fillStyle = '#2a0a4a'; g.fill(); g.fillStyle = '#fff'; g.fillText('MATI', 128, 275);
    const h = new T.Sprite(new T.SpriteMaterial({ map: tex(c), transparent: true })); h.scale.set(1.15, 1.15 * 300 / 256, 1); h.position.set(0, 2.3, -.05); bike.add(h); }
  if (win){   // Paul vuelve de paquete
    { const pt = new T.Mesh(new T.CapsuleGeometry(.2, .3, 6, 14), new T.MeshStandardMaterial({ color: 0xf0f0f0, roughness: .8 })); pt.position.set(0, 1.5, .78); pt.rotation.x = -.25; pt.scale.set(1.2, 1, .8); bpart(pt); }
    const p = new T.Sprite(new T.SpriteMaterial({ map: tex(ffCharCanvas('Paul', '#7fd3ff')), transparent: true })); p.scale.set(.85, .85 * 300 / 256, 1); p.position.set(.5, 2.05, .8); bike.add(p);
  }
  const standC = document.createElement('canvas'); standC.width = 320; standC.height = 710;
  { const g = standC.getContext('2d'); if (crocImg) g.drawImage(crocImg, 0, 0, 320, 710);
    const mk = document.createElement('canvas'); mk.width = 320; mk.height = 710; const mg = mk.getContext('2d'); mg.filter = 'blur(9px)'; mg.beginPath();
    [[28, 62], [70, 48], [130, 70], [200, 150], [222, 182], [190, 222], [150, 250], [140, 290], [160, 330], [168, 420], [212, 478], [232, 560], [205, 605], [40, 612], [26, 420], [24, 210]].forEach(([x, y], k) => k ? mg.lineTo(x, y) : mg.moveTo(x, y));
    mg.closePath(); mg.fillStyle = '#000'; mg.fill();
    g.globalCompositeOperation = 'destination-in'; g.drawImage(mk, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(140,60,255,.22)'; g.fillRect(0, 0, 320, 710); }
  const aura = new T.Sprite(new T.SpriteMaterial({ map: tex(glowCanvas([[0, 'rgba(210,140,255,.9)'], [.45, 'rgba(140,60,255,.45)'], [1, 'rgba(80,0,160,0)']])), ...AB, opacity: 0 }));
  aura.scale.set(7.5, 9.5, 1); aura.position.set(0, 3.7, 1.9); bike.add(aura);
  const stand = new T.Sprite(new T.SpriteMaterial({ map: tex(standC), transparent: true, opacity: 0, depthWrite: false })); stand.scale.set(2.95, 6.55, 1); stand.position.set(0, 3.7, 1.8); bike.add(stand);
  const gogo = [0, 1, 2].map(() => { const s = new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas('ゴ', { size: 150, w: 220, h: 220, glow: '#7a2cff', grad: ['#f3d8ff', '#b06cff', '#5a14b0'], font: '"Anton", Impact, sans-serif' })), transparent: true, opacity: 0, depthWrite: false })); s.scale.setScalar(1.1); bike.add(s); return s; });
  let standAt = -1;
  const bSide = () => (n === 2 ? 2.9 - 1.6 * ease(savedK) : n >= 3 ? 1.7 : 2.6);
  function bikeX(z, s){ const lx = laneX(PC.ti, z) + bSide(), cx = PT ? (laneX(0, z) + laneX(PC.ti, z)) / 2 : laneX(0, z); return lx * (1 - s) + cx * s; }
  function bikeState(){
    const cs = carState(PC, st); let z, s = 0;
    if (frozen) z = cs.z + 62 * (1 - ease(Math.min(1, Math.max(0, (rtNow - egg.t0 - .3) / 2))));
    else { s = win ? 0 : smt(stR + 9.8, stR + 13, st); z = cs.z - 16 * s; }
    return { x: bikeX(z, s), x2: bikeX(z - 1, s), y: ry(z), z };
  }
  // corazones (Toretto ❤ Paul)
  const heartC = document.createElement('canvas'); heartC.width = heartC.height = 128;
  { const g = heartC.getContext('2d'); g.translate(64, 66); g.scale(4.2, 4.2); g.translate(-5, -9.5); g.fillStyle = '#ff3b6b'; g.fill(new Path2D('M5 5C5 5 4 0 0 0C-6 0 -6 7 -6 7C-6 11 -3 15.4 5 19C12 15.4 16 11 16 7C16 7 16 0 10 0C7 0 5 5 5 5Z')); }
  const hearts = Array.from({ length: 16 }, (_, i) => { const s = new T.Sprite(new T.SpriteMaterial({ map: tex(heartC), transparent: true, opacity: 0, depthWrite: false })); s.scale.setScalar(.5); scene.add(s); return { s, t: Math.random(), w: i % 2, dx: (Math.random() - .5) * 1.6 }; });
  const tagTP = !win && n > 1 ? new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas('Toretto ❤ Paul', { size: 110, w: 1024, h: 190, glow: '#ff3b6b', grad: ['#ffffff', '#ffe9c4', '#ff8fb1'] })), transparent: true, opacity: 0, depthTest: false, fog: false })) : null;
  if (tagTP) scene.add(tagTP);


  // ---- easter egg 2: Álvaro en moto… y se la pega ----
  const abike = new T.Group(); abike.visible = false; scene.add(abike);
  { const alvShirt = new T.MeshStandardMaterial({ color: 0x5c1426, roughness: .75 }), alvPant = new T.MeshStandardMaterial({ color: 0x23262e, roughness: .85 }), alvBody = envify(new T.MeshPhysicalMaterial({ color: 0xb3121b, metalness: .7, roughness: .3, clearcoat: 1, clearcoatRoughness: .06 }), 1.3);
    bike.children.slice(0, nBase).forEach(o => { const k = o.clone(); if (k.material === shirtM) k.material = alvShirt; else if (k.material === pantM) k.material = alvPant; else if (k.material === bpM) k.material = alvBody; abike.add(k); });
    const c = document.createElement('canvas'); c.width = 256; c.height = 300; const g = c.getContext('2d');
    g.save(); g.beginPath(); g.arc(128, 128, 112, 0, 7); g.clip(); g.fillStyle = '#222'; g.fillRect(0, 0, 256, 256); if (alvImg) g.drawImage(alvImg, 118, 48, 202, 202, 16, 16, 224, 224); g.restore();
    g.lineWidth = 12; g.strokeStyle = '#ff7a1a'; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
    g.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; rrect(g, 58, 252, 140, 44, 14); g.fillStyle = '#3a1206'; g.fill(); g.fillStyle = '#fff'; g.fillText('ÁLVARO', 128, 275);
    const h = new T.Sprite(new T.SpriteMaterial({ map: tex(c), transparent: true })); h.scale.set(1.15, 1.15 * 300 / 256, 1); h.position.set(0, 2.3, -.05); abike.add(h); }
  const aWheels = abike.children.filter(o => o.userData.wheel);
  let alv = null;   // { t0, boomAt, boom: {x,y,z} }
  // explosión: bolas de fuego, humo, onda y escombros
  const HOT = new T.Color(2.8, 2.2, 1.6);   // HDR: el fuego brilla con el bloom
  const fireT = tex(glowCanvas([[0, 'rgba(255,255,220,1)'], [.18, 'rgba(255,214,90,.95)'], [.45, 'rgba(255,110,20,.75)'], [.75, 'rgba(160,30,0,.35)'], [1, 'rgba(60,0,0,0)']]));
  const smokeT = tex(glowCanvas([[0, 'rgba(40,34,30,.85)'], [.5, 'rgba(60,52,46,.45)'], [1, 'rgba(70,60,52,0)']]));
  const ringT = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 70, 128, 128, 126); gr.addColorStop(0, 'rgba(255,220,160,0)'); gr.addColorStop(.7, 'rgba(255,230,190,.9)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return tex(c); })();
  const fx3 = [];   // partículas { s, v:Vector3, t, life, grow, kind }
  const boomLight = new T.PointLight(0xff8a30, 0, 140, 2); scene.add(boomLight);
  let boomI = 0, boomDur = 1.8;
  const ring = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: ringT, ...AB, opacity: 0, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; scene.add(ring);
  function burst(P, big){
    const nF = big ? 26 : 9, nS = big ? 22 : 7;
    for (let i = 0; i < nF; i++){ const sp = new T.Sprite(new T.SpriteMaterial({ map: fireT, ...AB, opacity: 1, color: HOT })); sp.position.copy(P).add(new T.Vector3((Math.random() - .5) * 3, Math.random() * 2, (Math.random() - .5) * 3)); scene.add(sp);
      fx3.push({ s: sp, v: new T.Vector3((Math.random() - .5) * 10, 4 + Math.random() * 9, (Math.random() - .5) * 10), t: 0, life: .9 + Math.random() * .9, grow: (big ? 9 : 4) + Math.random() * 5, kind: 'fire' }); }
    for (let i = 0; i < nS; i++){ const sp = new T.Sprite(new T.SpriteMaterial({ map: smokeT, transparent: true, depthWrite: false, opacity: 0 })); sp.position.copy(P).add(new T.Vector3((Math.random() - .5) * 4, 1 + Math.random() * 2, (Math.random() - .5) * 4)); scene.add(sp);
      fx3.push({ s: sp, v: new T.Vector3((Math.random() - .5) * 3, 2.5 + Math.random() * 3, (Math.random() - .5) * 3), t: -Math.random() * .4, life: 3.5 + Math.random() * 2, grow: (big ? 14 : 7) + Math.random() * 6, kind: 'smoke' }); }
    for (let i = 0; i < (big ? 30 : 8); i++){ const m = new T.Mesh(new T.BoxGeometry(.2 + Math.random() * .4, .1 + Math.random() * .3, .2 + Math.random() * .5), new T.MeshStandardMaterial({ color: [0x222222, 0xb3121b, 0x9a9ca4, 0x444444][i % 4], metalness: .5, roughness: .5, emissive: 0xff5a10, emissiveIntensity: 1.6 })); m.castShadow = true; m.position.copy(P).add(new T.Vector3(0, 1, 0)); scene.add(m);
      fx3.push({ s: m, v: new T.Vector3((Math.random() - .5) * 26, 6 + Math.random() * 16, (Math.random() - .5) * 26), t: 0, life: 3, grow: 0, kind: 'debris', w: new T.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9) }); }
  }
  // el negro y el «JODER, ÁLVARO»
  const alvEnd = document.createElement('div'); alvEnd.className = 'ff-alv'; alvEnd.innerHTML = '<b>JODER, ÁLVARO</b><small>no queda ningún equipo</small>'; ov.appendChild(alvEnd);
  const alvEgg = (nuke) => {
    if (!X.isOpen() || layer.dataset.anim !== 'furious' || !cv.isConnected) return false;
    if (alv || egg || st > tWhite - 3.2) return true;
    alv = { t0: st, boomAt: st + 4.4, nuke: nuke === true };
    if (alv.nuke) alvEnd.querySelector('small').textContent = 'no queda ni la carretera';
    tWhite = Infinity; tDone = Infinity;   // este final lo lleva el easter egg
    capM.dataset.k = 'alv'; capM.innerHTML = '<small>Álvaro</small><i></i><small>¿qué podría salir mal?</small>';
    S = S || synth(); S && S.riser && S.riser(4.2);
    return true;
  };
  X.onType('alvaro', () => alvEgg(false));
  X.onType('nuclear', () => alvEgg(true));
  // ---- versión nuclear: destello, bola de fuego, onda, nube de Wilson y hongo ----
  const puffT = tex(glowCanvas([[0, 'rgba(255,255,255,.95)'], [.45, 'rgba(240,236,230,.6)'], [.8, 'rgba(225,220,214,.18)'], [1, 'rgba(220,215,210,0)']]));
  let NK = null;
  function nukeBoom(P){
    const g = new T.Group(); scene.add(g);
    const parts = [], mk = (kind, o) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: puffT, transparent: true, depthWrite: false, opacity: 0, fog: false })); g.add(sp); parts.push(Object.assign({ s: sp, kind, j: Math.random() }, o)); };
    for (let i = 0; i < (narrow ? 110 : 170); i++) mk('cap', { a: Math.random() * 6.28, b: Math.random() * 6.28, r: .55 + Math.random() * .5 });
    for (let i = 0; i < (narrow ? 50 : 80); i++) mk('stem', { f: Math.random(), a: Math.random() * 6.28 });
    for (let i = 0; i < (narrow ? 60 : 90); i++) mk('skirt', { a: Math.random() * 6.28, r: .6 + Math.random() * .6 });
    const core = []; for (let i = 0; i < 14; i++){ const sp = new T.Sprite(new T.SpriteMaterial({ map: fireT, ...AB, opacity: 0, fog: false, color: HOT })); g.add(sp); core.push({ s: sp, a: Math.random() * 6.28, r: Math.random() }); }
    const ball = new T.Mesh(new T.SphereGeometry(1, 32, 20), new T.MeshBasicMaterial({ color: new T.Color(0xfff2c8).multiplyScalar(5), ...AB, opacity: 1, fog: false })); ball.position.copy(P); g.add(ball);
    const dome = new T.Mesh(new T.SphereGeometry(1, 40, 20, 0, 6.29, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, fog: false })); dome.position.copy(P); g.add(dome);
    NK = { P: P.clone(), t: 0, g, parts, core, ball, dome, knocked: new Uint8Array(treeRec.length) };
    // un destello que lo quema todo
    flash.animate([{ opacity: 1 }, { opacity: 1, offset: .18 }, { opacity: 0 }], { duration: 2600, easing: 'ease-out' });
    if (S){ S.rumble && S.rumble(6.5); S.boom(true); later(() => S && S.boom(true), 260); later(() => S && S.boom(true), 900); }
  }
  const nq = new T.Quaternion(), nq2 = new T.Quaternion(), nAx = new T.Vector3(), nUp = new T.Vector3(0, 1, 0), nO = new T.Object3D(), nV = new T.Vector3(), cSmoke = new T.Color(.34, .27, .23), cLit = new T.Color(1.15, .8, .52), cHot = new T.Color(1, .78, .36), cCool = new T.Color(.5, .4, .35), cGlow = new T.Color(1, .45, .12);
  function nukeTick(dt){
    const N = NK; N.t += dt; const t = N.t, P = N.P;
    const H = 165 * (1 - Math.exp(-t / 2.1)), capR = 18 + 40 * (1 - Math.exp(-t / 2.4)), tube = capR * .5, cool = Math.min(1, t / 5);
    N.parts.forEach(p => {
      let x, y, z, sc, up = p.kind === 'skirt' ? -.3 : 0;
      if (p.kind === 'cap'){ const b = p.b + t * .9; up = Math.sin(b) * p.r; const rr = capR + Math.cos(b) * tube * p.r; x = Math.cos(p.a) * rr; z = Math.sin(p.a) * rr; y = H + Math.sin(b) * tube * .65 * p.r; sc = tube * 1.5; }
      else if (p.kind === 'stem'){ const f = p.f, rr = 5 + 5 * f + Math.sin(t * 2 + p.a) * 1.2; x = Math.cos(p.a + t * .4) * rr; z = Math.sin(p.a + t * .4) * rr; y = f * H * .92; sc = 11 + 7 * f; }
      else { const rr = (20 + 90 * (1 - Math.exp(-t / 2.6))) * p.r; x = Math.cos(p.a) * rr; z = Math.sin(p.a) * rr; y = 3 + 6 * p.r * Math.min(1, t); sc = 16 + 14 * p.r; }
      p.s.position.set(P.x + x, P.y + y, P.z + z); p.s.scale.setScalar(sc * Math.min(1, t * 1.6 + .2));
      const glow = p.kind === 'skirt' ? .2 : p.kind === 'stem' ? Math.max(0, 1 - p.f) * .9 : .55;
      // humo oscuro, cara superior bañada por el sol bajo y la panza incandescente por el fuego
      p.s.material.color.copy(cSmoke).lerp(cLit, Math.max(0, up * .6 + .45) * (1 - cool * .3)).lerp(cGlow, glow * (1 - cool * .55)).multiplyScalar(.7 + .6 * p.j + glow * (1 - cool) * (1.3 - up * .6) * 3.2);
      p.s.material.opacity = Math.min(.95, t * 2) * (p.kind === 'skirt' ? .7 : .92);
    });
    // corazón incandescente del hongo
    N.core.forEach(c => { c.s.position.set(P.x + Math.cos(c.a + t) * capR * .5 * c.r, P.y + H + Math.sin(t * 2 + c.a) * 4, P.z + Math.sin(c.a + t) * capR * .5 * c.r); c.s.scale.setScalar(tube * 2.4); c.s.material.opacity = Math.max(0, .9 - t * .16); });
    // bola de fuego que sube y se apaga, cúpula de condensación
    const bk = Math.min(1, t / .7); N.ball.scale.setScalar(4 + 30 * (1 - Math.pow(1 - bk, 3))); N.ball.position.set(P.x, P.y + H * .8 * Math.min(1, t / 1.2), P.z); N.ball.material.opacity = Math.max(0, 1 - t / 2.2);
    { const hk = 1 + 5 * Math.max(0, 1 - t / 1.8); N.ball.material.color.setRGB(hk, Math.max(.4, .95 - t * .25) * hk, Math.max(.1, .8 - t * .4) * hk); }
    N.dome.scale.setScalar(20 + 520 * Math.min(1, t / 1.6)); N.dome.material.opacity = t < .25 ? t * 2 : Math.max(0, .5 - (t - .25) * .45);
    // la onda tumba y quema los árboles a su paso
    const Rw = 420 * t, d = nO;
    for (let i = 0; i < treeRec.length; i++){ if (N.knocked[i]) continue; const r = treeRec[i], dx = r.b[0] - P.x, dz = r.b[2] - P.z, dd = Math.hypot(dx, dz); if (dd > Rw) continue;
      N.knocked[i] = 1; nAx.set(dz, 0, -dx).normalize(); nq.setFromAxisAngle(nAx, Math.min(1.45, 1.1 + 40 / (dd + 20)));
      nV.set(r.x - r.b[0], r.y - r.b[1], r.z - r.b[2]).applyQuaternion(nq); d.position.set(r.b[0] + nV.x, r.b[1] + nV.y, r.b[2] + nV.z);
      nq2.setFromAxisAngle(nUp, r.r0); d.quaternion.copy(nq).multiply(nq2); d.scale.set(r.sx, r.sy, r.sz); d.updateMatrix(); r.im.setMatrixAt(r.i, d.matrix); r.im.instanceMatrix.needsUpdate = true;
      if (r.im.instanceColor){ r.im.setColorAt(r.i, tmp2.setRGB(.09, .07, .06)); r.im.instanceColor.needsUpdate = true; } }
  }
  // onda de choque como distorsión de pantalla (postprocesado) sobre el compositor del motor
  let shock = null;
  function shockwave(P){
    try {
      if (!ctx.composer || !T.PP.ShockWaveEffect) return;
      if (!shock){ shock = new T.PP.ShockWaveEffect(cam, P.clone(), { speed: 1.2, maxRadius: .9, waveSize: .22, amplitude: alv && alv.nuke ? .05 : .035 }); ctx.composer.addPass(new T.PP.EffectPass(cam, shock)); }
      shock.position.copy(P); shock.explode();
    } catch (e) { /* sin onda de choque */ }
  }
  function alvBoom(P){
    alv.boom = P.clone(); impact(); shockwave(P);
    if (alv.nuke) nukeBoom(P);
    if (S){ S.boom(true); later(() => S && S.boom(true), 140); later(() => S && S.boom(false), 420); }
    if (snd){ const v0 = snd.volume, t0 = performance.now(); const iv = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 400); snd.volume = v0 * (1 - k); if (k >= 1){ clearInterval(iv); snd.pause(); } }, 30); }
    burst(P, true);
    boomLight.position.copy(P).add(tmp.set(0, 3, 0)); boomI = 1400; boomDur = 1.8; boomLight.intensity = boomI;
    ring.position.copy(P).add(tmp.set(0, .25, 0)); ring.material.opacity = 1; ring.scale.setScalar(1);
    if (alv.nuke){ boomI = 420000; boomDur = 8; boomLight.intensity = boomI; boomLight.distance = 1100; }
    // ya no hay equipo: todos los coches salen volando, con fuego
    cars.forEach((c, i) => {
      const d = c.g.position.clone().sub(P); d.y = 0; const r = Math.max(2, d.length()); d.normalize();
      const nk = alv.nuke ? 3.2 : 1;
      c.blast = { v: d.multiplyScalar((18 + 60 / r + Math.random() * 8) * nk).add(new T.Vector3(0, (12 + Math.random() * 12 + 30 / r) * nk, 0)), w: new T.Vector3((Math.random() - .5) * 8, (Math.random() - .5) * 8, (Math.random() - .5) * 8), delay: Math.min(.5, r / 60) };
      later(() => { if (X.isOpen()) burst(c.g.position, false); }, c.blast.delay * 1000 + 80 + i * 40);
    });
    abike.visible = false;
    alv.tEnd = alv.nuke ? 7.2 : 3.3;   // en tiempo de la escena (el loop lo comprueba)
  }

  // ---- montaje (tiempos del clip original desde 1:52) ----
  let SH = win
    ? [[0, 'aerialBack'], [4, 'cry'], [10, 'top'], [13, 'wide'], [16, 'sunset']]
    : [[0, 'aerialBack'], [6.2, 'glanceA'], [9, 'glanceB'], [12, 'top'], [16.8, 'forkTop'], [22, 'wide'], [27.2, 'sunset']];
  const shotAt = t => { let s = SH[0]; for (const x of SH) if (t >= x[0]) s = x; return s; };
  const sunAt = () => SH.find(x => x[1] === 'sunset')[0];
  let tWhite = win ? 24 : 36.5, tDone = tWhite + 2.2, doneF = false, closeF = false;
  later(() => { layer.classList.remove('intro'); layer.classList.add('up'); }, 1500);
  const tmp2 = new T.Color(), tmp = new T.Vector3(), fogWhite = new T.Color(1, .82, .62), pW = new T.Vector3(), qW = new T.Vector3();

  // ¡ZA WARUDO! — escribir "mati" durante la animación
  const cv = renderer.domElement, snd = X.song, vento = await X.audio('jojo/vento.mp3');
  const flash = document.createElement('div'); flash.className = 'ff-flash'; ov.appendChild(flash);
  const impact = () => flash.animate([{ opacity: .95 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' });
  function replan(){
    const t1 = st + 5.5, t2 = t1 + 4.6, offW = tWhite - sunAt(), at = shotAt(t2)[1], cur = /glance|cry/.test(at) ? 'top' : at;
    SH = [[st, 'matiRide'], [t1, 'together'], [t2, cur], ...SH.filter(x => x[0] > t2 && !/glance|cry/.test(x[1]))];
    if (!SH.some(x => x[1] === 'sunset')) SH.push([t2 + 4, 'sunset']);
    tWhite = sunAt() + offW; tDone = tWhite + 2.2;
  }
  function resume(){
    frozen = false; cv.style.filter = ''; impact();
    if (S){ S.boom(true); S.chord(); later(() => { S && S.close(); S = null; }, 4200); }
    if (snd) snd.playbackRate = 1;
    saved = true; stR = st; savedK = !win && n > 1 && lead(st) < zF - 10 ? 1 : 0;
    replan();
    capE.innerHTML = win ? `<b>Paul ha vuelto</b><small>${esc(teams[0].name)} · gracias, Mati</small>` : '<b>Juntos para siempre</b><small>Toretto ❤ Paul · gracias, Mati</small>';
    forP.textContent = 'PARA MATI';
  }
  const ffEgg = () => {
    if (!X.isOpen() || layer.dataset.anim !== 'furious' || !cv.isConnected) return false;
    if (egg || alv || st > tWhite - 3.2) return true;
    egg = { t0: rtNow }; frozen = true;
    S = synth(); if (S){ S.zap(1600); S.zap(900); }
    if (snd){ snd.preservesPitch = false; snd.mozPreservesPitch = false; snd.webkitPreservesPitch = false; snd.playbackRate = .5; }
    later(() => { if (snd) snd.pause(); }, 350);
    if (vento){ vento.pause(); vento.currentTime = 0; vento.playbackRate = 1; vento.volume = 1; const p = vento.play(); p && p.catch(() => {}); }
    const za = document.createElement('div'); za.className = 'jj-za'; fx.appendChild(za);
    za.animate([{ transform: 'translate(-50%,-50%) scale(0)' }, { transform: 'translate(-50%,-50%) scale(330)', offset: .35 }, { transform: 'translate(-50%,-50%) scale(260)', offset: .5 }, { transform: 'translate(-50%,-50%) scale(0)' }], { duration: 1600, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
    const wt = document.createElement('div'); wt.className = 'jj-world'; wt.innerHTML = '<b>¡ZA WARUDO!</b><small>toki yo tomare</small>'; fx.appendChild(wt);
    wt.querySelector('b').animate([{ opacity: 0, transform: 'skewX(-10deg) scale(2.4)' }, { opacity: 1, transform: 'skewX(-10deg) scale(1)', offset: .12 }, { opacity: 1, offset: .7 }, { opacity: 0, transform: 'skewX(-10deg) scale(1.1)' }], { duration: 2400, fill: 'forwards' });
    const sm = wt.querySelector('small');
    sm.animate([{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 2900, fill: 'forwards' });
    later(() => { sm.textContent = '1 segundo…'; }, 1000); later(() => { sm.textContent = '2 segundos…'; }, 2000);
    cv.style.transition = 'filter .5s';
    later(() => { if (frozen) cv.style.filter = 'grayscale(.82) contrast(1.28) brightness(.92)'; }, 350);
    later(() => { standAt = rtNow; S && S.boom(false); impact(); }, 1300);
    later(() => { za.remove(); wt.remove(); }, 2950);
    return true;
  };
  X.onType('mati', ffEgg);

  // lágrimas del capitán (victoria): gotas que caen por la cara
  const tearTex = tex(glowCanvas([[0, 'rgba(220,240,255,1)'], [.35, 'rgba(150,200,255,.85)'], [1, 'rgba(120,180,255,0)']]));
  const tears = Array.from({ length: 10 }, (_, i) => { const s = new T.Sprite(new T.SpriteMaterial({ map: tearTex, transparent: true, opacity: 0, depthTest: false })); s.scale.set(.032, .055, 1); s.renderOrder = 10; scene.add(s); return { s, side: i % 2 ? 1 : -1, t: Math.random() }; });
  const dW = new T.Vector3(), camR = new T.Vector3();
  const duo = c => `${esc(c.m.name)} & ${esc(c.passName)}`;
  function midHTML(k){
    if (k === 'glanceA' || k === 'glanceB'){ const me = k === 'glanceA' ? L0c : L1c, ot = me === L0c ? L1c : L0c; return `<small>${duo(me)} · ${esc(me.team.name)}</small><i></i><small>${duo(ot)} · ${esc(ot.team.name)}</small>`; }
    if (k === 'cry') return `<small>${duo(L0c)}</small><i></i><small>${saved ? '¡Paul ha vuelto!' : 'por Paul'}</small>`;
    if (k === 'freeze') return '<small>Mati</small><i></i><small>「 Stand: El Tiburón 」</small>';
    if (k === 'matiRide') return '<small>Mati salva a Paul</small><i></i><small>el tiempo vuelve a correr</small>';
    if (k === 'together') return '<small>Toretto ❤ Paul</small><i></i><small>juntos para siempre</small>';
    return '';
  }
  ctx.start((rt, rdt) => {
    const spd = window.__ffSpeed || 1; rt *= spd; rdt *= spd;
    rtNow = rt;
    if (frozen && rt - egg.t0 > 3) resume();
    if (egg && !frozen && !egg.back && st > stR + 5.2){ egg.back = 1; if (snd){ snd.volume = 0; const p = snd.play(); p && p.catch(() => {}); } }
    if (egg && egg.back && egg.back < 2){ const f = Math.min(1, (snd ? snd.volume : 1) + rdt / 1.2); if (snd) snd.volume = f; if (vento){ vento.volume = Math.max(0, 1 - f); if (f >= 1){ vento.pause(); vento.currentTime = 0; vento.volume = 1; } } if (f >= 1) egg.back = 2; }
    if (!frozen) st += rdt;
    const et = st, dt = frozen ? 0 : rdt;
    if (saved && savedK < 1) savedK = Math.min(1, savedK + dt / 1.6);
    if (!doneF && et >= tDone){ doneF = true; X.done(); }
    if (!closeF && et >= tDone + (A.hold || 5200) / 1000){ closeF = true; X.close(); return; }
    let [t0, kind] = shotAt(et), u = et - t0;
    if (frozen){ kind = 'freeze'; u = rt - egg.t0; }
    if (alv){ const a = et - alv.t0; kind = alv.boom ? 'alvBoom' : 'alvRide'; u = alv.boom ? et - alv.boomAt : a; }
    const inside = kind === 'glanceA' ? L0c : kind === 'glanceB' ? L1c : null;
    const oc = inside ? (inside === L0c ? L1c : L0c) : kind === 'cry' ? L0c : null;
    for (const c of cars){
      if (c.blast){ const b = c.blast; if ((b.t = (b.t || 0) + rdt) > b.delay){ b.v.y -= 28 * rdt; c.g.position.addScaledVector(b.v, rdt); c.g.rotation.x += b.w.x * rdt; c.g.rotation.y += b.w.y * rdt; c.g.rotation.z += b.w.z * rdt; c.paint.color.lerp(tmp2.set(0x1a1410), rdt * 1.5); } c.face.visible = false; if (c.pb) c.pb.visible = false; if (c.halo) c.halo.visible = false; continue; }
      const s = carState(c, et), s2 = carState(c, et + .05);
      c.g.position.set(s.x, s.y, s.z);
      c.g.rotation.y = Math.atan2(-(s2.x - s.x), -(s2.z - s.z));
      c.g.position.y += Math.sin(et * 7 + c.k * 2) * .015;
      c.wheels.forEach(w => { w.rotation.x -= dt * 34; });
      const lit = c.tA < 0 ? 1 : Math.min(1, Math.max(0, (et - c.tA - .4) / .7));
      if (c.tA >= 0) c.paint.color.setHex(0x9a9ca4).lerp(new T.Color(PAINT[c.ti % 4]), lit);
      c.glowM.opacity = .5 * lit;
      c.face.visible = !inside;
      const eggShot = kind === 'freeze' || kind === 'matiRide' || kind === 'together';
      c.face.material.opacity = inside || eggShot ? 0 : Math.min(1, et / 1.5) * (kind === 'sunset' || kind === 'wide' ? .0 : 1);
      const open = c === oc || (eggShot && c.captain);
      c.cab.visible = c.roof.visible = c !== inside && !open; c.driver.visible = c !== inside;
      const ds = c === oc ? (inside ? 1.1 : 1.05) : open ? 1 : .82; c.driver.scale.set(ds, ds * 300 / 256, 1);
      if (c.pass){ c.pass.visible = c !== inside; const ps = open ? ds * .92 : .78; c.pass.scale.set(ps, ps * 300 / 256, 1); }
      if (c.pb){ c.pb.visible = c.face.visible; c.pb.material.opacity = c.face.material.opacity; }
      if (c.halo){ c.halo.visible = !inside && kind !== 'cry'; c.halo.rotation.z = et * .8; c.halo.material.opacity = (.55 + .3 * Math.sin(et * 4)) * Math.min(1, et / 1.5); }
      if (c.dust){ const ps = c.dust.geometry.attributes.position, al = c.dustA; for (let j = 0; j < ps.count; j++){ al[j] += dt * (.7 + (j % 5) * .12); if (al[j] > 1){ al[j] -= 1; ps.setXYZ(j, s.x + (Math.random() - .5) * 1.8, s.y + .2, s.z + 2.2); } else ps.setY(j, ps.getY(j) + dt * 1.1); }
        ps.needsUpdate = true; c.dust.material.opacity = .32 * (kind === 'wide' || kind === 'sunset' ? .6 : 1); }
    }
    interior.visible = !!inside;
    // Mati
    let B = null;
    if (egg){
      B = bikeState(); bike.visible = true;
      bike.position.set(B.x, B.y + Math.sin(rt * 9) * .012, B.z); bike.rotation.y = Math.atan2(-(B.x2 - B.x), 1); bike.rotation.z = (B.x2 - B.x) * .6;
      bWheels.forEach(w => { w.rotation.x -= rdt * 38; });
      const sk = standAt < 0 ? 0 : Math.min(1, (rt - standAt) / .45), pop = sk < 1 ? .35 + .7 * ease(sk) : 1;
      stand.material.opacity = .88 * sk * (.9 + .1 * Math.sin(rt * 6)); stand.scale.set(2.95 * pop, 6.55 * pop, 1);
      aura.material.opacity = .55 * sk * (.75 + .25 * Math.sin(rt * 4.3)); aura.scale.set(7.5 * pop, 9.5 * pop * (1 + .04 * Math.sin(rt * 7)), 1);
      gogo.forEach((g, i) => { g.material.opacity = sk * (.55 + .45 * Math.sin(rt * 3 + i * 2)); g.position.set((i % 2 ? 1 : -1) * 2.1, 2.2 + i * 1.7 + Math.sin(rt * 2 + i) * .25, 1.8); });
    }
    let A3 = null;
    if (alv){
      const a = et - alv.t0, cs = carState(PC, et);
      if (!alv.boom){
        const z = cs.z + 46 * (1 - smt(0, 2.6, a)) - 6 * smt(2.6, 4.4, a);
        const wob = smt(2.4, 4.4, a), cx = (laneX(0, z) + laneX(PC.ti, z)) / 2;
        const x = (laneX(PC.ti, z) + bSide()) * (1 - wob) + cx * wob + Math.sin(a * 9) * 1.1 * wob;
        A3 = { x, y: ry(z), z };
        abike.visible = true; abike.position.set(x, A3.y, z);
        abike.rotation.set(0, Math.atan2(-Math.cos(a * 9) * 1.1 * wob * .4, 1), Math.sin(a * 9) * .5 * wob);
        aWheels.forEach(w => { w.rotation.x -= rdt * 40; });
        if (et >= alv.boomAt) alvBoom(new T.Vector3(x, A3.y, z));
      }
    }
    // partículas de la explosión
    for (let i = fx3.length - 1; i >= 0; i--){
      const p = fx3[i]; p.t += rdt; if (p.t < 0) continue;
      const k = p.t / p.life;
      if (k >= 1){ scene.remove(p.s); fx3.splice(i, 1); continue; }
      if (p.kind === 'debris'){ p.v.y -= 28 * rdt; p.s.position.addScaledVector(p.v, rdt); p.s.rotation.x += p.w.x * rdt; p.s.rotation.y += p.w.y * rdt; continue; }
      p.v.multiplyScalar(1 - rdt * (p.kind === 'fire' ? 2.2 : .6)); p.s.position.addScaledVector(p.v, rdt);
      p.s.scale.setScalar(1 + p.grow * Math.pow(k, p.kind === 'fire' ? .45 : .7));
      p.s.material.opacity = p.kind === 'fire' ? Math.pow(1 - k, 1.6) : Math.min(1, k * 4) * (1 - k) * .9;
    }
    if (boomLight.intensity > 0) boomLight.intensity = Math.max(0, boomLight.intensity - rdt * boomI / boomDur);
    if (ring.material.opacity > 0){ ring.material.opacity = Math.max(0, ring.material.opacity - rdt * 1.1); ring.scale.setScalar(ring.scale.x + rdt * (alv && alv.nuke ? 840 : 90)); }
    if (NK) nukeTick(rdt);
    if (alv && alv.boom && alv.tEnd && !alv.ended && st >= alv.boomAt + alv.tEnd){ alv.ended = true; alvEnd.classList.add('on');
      later(() => { doneF = true; X.done(); }, 1000); later(() => { closeF = true; X.close(); }, 1000 + (A.hold || 5200)); }
    const L0 = sp(L0c, et), L1 = sp(L1c, et), L = L0.clone().add(L1).multiplyScalar(.5);
    let pos, look;
    if (kind === 'alvRide' && A3){ const w = smt(2.4, 4.2, u); pos = new T.Vector3(A3.x + 5.2 + 6 * w, A3.y + 1.6 + 3.5 * w, A3.z - 8.5 - 4 * w); look = new T.Vector3(A3.x - .4 * (1 - w), A3.y + 1.8 - .8 * w, A3.z + 1.2); }
    else if (kind === 'alvBoom' && alv.nuke){ const P = alv.boom, k = ease(Math.min(1, u / 6.5));
      pos = new T.Vector3(P.x + 130 + 90 * k, P.y + 38 + 30 * k, P.z - 300 - 180 * k); look = new T.Vector3(P.x, P.y + 45 + 55 * k, P.z);
      const sh = Math.max(0, 1 - u / 3.5) * 5 * Math.min(1, u * 3); pos.x += (Math.random() - .5) * sh; pos.y += (Math.random() - .5) * sh; }
    else if (kind === 'alvBoom'){ const P = alv.boom, k = ease(Math.min(1, u / 4)); pos = new T.Vector3(P.x + 16 + 14 * k, P.y + 6 + 10 * k, P.z - 22 - 16 * k); look = new T.Vector3(P.x, P.y + 4 + 2 * k, P.z);
      const sh = Math.max(0, 1 - u / 1.6) * 1.6; pos.x += (Math.random() - .5) * sh; pos.y += (Math.random() - .5) * sh; }
    else if (kind === 'aerialBack'){ const k = ease(Math.min(1, u / 6.2)); pos = new T.Vector3(L.x + 9 - 4 * k, L.y + 46 - 22 * k, L.z + 46 - 14 * k); look = new T.Vector3(L.x, L.y, L.z - 30 + 8 * k); }
    else if (kind === 'freeze'){ const P = sp(PC, et), a = .95 + u * .11, R = 8.6 - u * .5; pos = new T.Vector3(P.x + Math.sin(a) * R, P.y + 2.5 + u * .2, P.z - Math.cos(a) * R); look = new T.Vector3(P.x + .8, P.y + 1.3, P.z + 3.5 * Math.min(1, u / 3)); }
    else if (kind === 'matiRide' && B){ pos = new T.Vector3(B.x + 5.4 - u * .35, B.y + 1.5 + u * .12, B.z - 8.8 + u * .9); look = new T.Vector3(B.x - .5, B.y + 2.4, B.z + 1.4); }
    else if (kind === 'together'){ const P = win && B ? new T.Vector3(B.x, B.y, B.z) : sp(PC, et), C = L0.clone().add(P).multiplyScalar(.5); pos = new T.Vector3(C.x + Math.sin(u * .4) * 1.2, C.y + 2.1, C.z - 11.5 + u * .8); look = new T.Vector3(C.x, C.y + 1.25, C.z); }
    else if (inside){
      oc.g.updateMatrixWorld(true); oc.driver.getWorldPosition(dW); if (oc.pass) oc.pass.getWorldPosition(qW); else qW.copy(dW);
      inside.g.updateMatrixWorld(true); inside.driver.getWorldPosition(pW);
      const push = ease(Math.min(1, u / 2.6));
      pos = pW.clone().lerp(dW, .08 + .18 * push); pos.y += .05; look = dW.clone().lerp(qW, .45); look.y += .02 + Math.sin(u * .8) * .03;
      pos.x += Math.sin(et * 2.1) * .012; pos.y += Math.sin(et * 3.3) * .01;
    }
    else if (kind === 'cry'){ const me = L0, k = ease(Math.min(1, u / 6)); pos = new T.Vector3(me.x + (2.9 - .6 * k), me.y + 1.45, me.z + 1.2 - k * .5); look = new T.Vector3(me.x - .1, me.y + 1.3, me.z + .6); }
    else if (kind === 'top'){ pos = new T.Vector3(L.x + 1.5, L.y + 52 + u * 1.2, L.z - 6 - u * .5); look = new T.Vector3(L.x, L.y, L.z - 8); }
    else if (kind === 'forkTop'){ const k = ease(Math.min(1, u / 5.2)); const fz = zF - 20; pos = new T.Vector3(xm(zF) + 2, ry(zF) + 70 + 40 * k, fz + 10 - 12 * k); look = new T.Vector3(xm(zF), ry(zF), fz - 14 - 12 * k); }
    else if (kind === 'wide'){ const k = ease(Math.min(1, u / 5.2)); pos = new T.Vector3(L.x - 70 + 25 * k, L.y + 110 + 30 * k, L.z + 120 - 40 * k); look = new T.Vector3(L.x, L.y, L.z - 160); }
    else { // atardecer: vista amplia y la cámara sube hacia el sol hasta el blanco
      const k = ease(Math.min(1, u / 8.5)), bx = xm(win ? L.z : zF), bz = win ? L.z + 40 : zF + 10;
      pos = new T.Vector3(bx + 20, (win ? L.y : ry(zF)) + 150 + 70 * k, bz + 60 - 30 * k);
      const pitch = -.3 + .36 * k, yaw = Math.atan2(sunDir.x, -sunDir.z) * (.75 + .25 * k);
      look = pos.clone().add(new T.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(600));
    }
    cam.position.copy(pos); cam.lookAt(look);
    if (!inside && kind !== 'cry' && kind !== 'together'){ cam.position.x += Math.sin(et * .9) * .25; cam.position.y += Math.sin(et * .7) * .18; }
    tears.forEach(tr => { if (kind !== 'cry' || u < 1.6 || saved){ tr.s.material.opacity = 0; return; } tr.t += dt * .55; if (tr.t > 1) tr.t = 0;
      L0c.g.updateMatrixWorld(true); cam.updateMatrixWorld(); L0c.driver.getWorldPosition(dW); camR.setFromMatrixColumn(cam.matrixWorld, 0);
      tr.s.position.copy(dW).addScaledVector(camR, tr.side * .1).add(tmp.set(0, .07 - tr.t * .26, 0)); tr.s.material.opacity = Math.sin(tr.t * Math.PI) * .85; });
    // corazones
    const hOn = saved && (kind === 'together' || (kind === 'matiRide' && u > 2.5) || kind === 'cry');
    hearts.forEach(h => {
      if (!hOn){ h.s.material.opacity = Math.max(0, h.s.material.opacity - rdt * 2); return; }
      h.t += dt * .45; if (h.t > 1) h.t -= 1;
      const P = h.w ? (win && B ? tmp.set(B.x, B.y, B.z) : sp(PC, et)) : L0;
      h.s.position.set(P.x + h.dx, P.y + 2.3 + h.t * 3.2, P.z + Math.sin(h.t * 6 + h.dx) * .3); h.s.scale.setScalar(.35 + .3 * h.t); h.s.material.opacity = Math.sin(h.t * Math.PI) * .9;
    });
    // motas: caja que viaja con la cámara
    { const mp = moteG.attributes.position.array, cp = cam.position, h = MB / 2;
      for (let i = 0; i < MN * 3; i += 3){ for (let a = 0; a < 3; a++){ let v = moteBase[i + a] + moteV[i + a] * rt + Math.sin(rt * .6 + i) * .4 - (a === 0 ? cp.x : a === 1 ? cp.y : cp.z); v = ((v + h) % MB + MB) % MB - h; mp[i + a] = (a === 0 ? cp.x : a === 1 ? cp.y : cp.z) + v; } }
      moteG.attributes.position.needsUpdate = true;
      const soft = ['cry', 'together', 'sunset', 'matiRide', 'wide'].includes(kind); motes.material.opacity += ((soft ? .95 : .5) - motes.material.opacity) * Math.min(1, rdt * 2); }
    // pájaros: lejos, en la dirección del sol, se ven en los planos abiertos
    { const on = ['wide', 'sunset', 'aerialBack', 'forkTop', 'together'].includes(kind) ? 1 : 0;
      birdBase.copy(cam.position).addScaledVector(sunFlat, 260 + rt * 4).addScaledVector(sideV, -40 + rt * 3); birdBase.y = cam.position.y + 30 + Math.sin(rt * .3) * 4;
      birds.forEach(b => { const u2 = b.userData, fl = Math.sin(rt * 7 + u2.ph); b.position.copy(birdBase).addScaledVector(sideV, u2.ox).add(tmp.set(0, u2.oy + fl * .4, 0)).addScaledVector(sunFlat, Math.abs(u2.ox) * -.6);
        b.scale.set(5, 2.5 * (.55 + .45 * fl), 1); b.material.opacity += (on * .85 - b.material.opacity) * Math.min(1, rdt * 1.5); }); }
    ov.dataset.mood = kind;
    // sombras siguen al convoy
    uTime.value = rt;
    sunL.target.position.copy(L); sunL.position.copy(L).addScaledVector(lightDir, 700); sunL.target.updateMatrixWorld();
    sky.position.copy(cam.position); sunMesh.position.copy(cam.position).addScaledVector(sunDir, 3300);
    // nombres de equipo sobre sus carreteras
    const tagOn = (kind === 'forkTop' && u > 2.4) || (kind === 'wide' && u < 5.6);
    const zt = win ? L.z - 50 : (kind === 'forkTop' ? zF - 110 : kind === 'wide' ? L.z - 60 : zF - 420);
    const tagAt = (s, xt, on) => {
      const sc = Math.max(5, cam.position.distanceTo(tmp.set(xt, ry(zt), zt)) * .07);
      s.position.set(xt, ry(zt) + sc * .7 + 4, zt); s.scale.set(sc * 5.4, sc, 1);
      s.material.opacity = Math.max(0, Math.min(1, s.material.opacity + (on ? dt * 1.2 : -dt * 1.5)));
    };
    tagS.forEach((s, i) => tagAt(s, win || zt > zF ? xm(zt) : xb(i, zt), tagOn && !(saved && n > 1 && i <= 1)));
    if (tagTP) tagAt(tagTP, zt > zF ? xm(zt) : xb(0, zt), tagOn && saved);
    // sol y destellos (crecen en el atardecer hasta quemar la imagen)
    const sunK = kind === 'sunset' ? Math.min(1, u / 8) : kind === 'wide' ? .2 : 0;
    setGlow(1 + sunK * .7);
    sunGlow.position.copy(cam.position).addScaledVector(sunDir, 3000); sunGlow.material.opacity = .18 + .3 * sunK; sunGlow.scale.setScalar(520 + 700 * sunK * sunK); sunMesh.material.color.setRGB(3.2 + 5 * sunK, 2.6 + 4 * sunK, 1.8 + 2.6 * sunK);
    const ndc = tmp.copy(sunGlow.position).project(cam), hh = Math.tan(T.MathUtils.degToRad(cam.fov / 2)) * 40, hw = hh * cam.aspect, onS = ndc.z < 1 && Math.abs(ndc.x) < 1.3 && Math.abs(ndc.y) < 1.3 ? 1 : 0;
    ghosts.forEach(g => { const f = g.userData.f; g.position.set(ndc.x * hw * (1 - 2 * f), ndc.y * hh * (1 - 2 * f), -40); g.scale.setScalar(g.userData.s * .2); g.material.opacity = onS * (.12 + .3 * sunK); });
    scene.fog.near = 260 - 160 * sunK; scene.fog.color.setHex(0xe0a070).lerp(fogWhite, sunK * .6);
    if (NK){ const h = Math.min(1, NK.t / 1.5); scene.fog.color.lerp(tmp2.setRGB(.62, .26, .1), h); scene.fog.near = 60; setGlow(1 + 2.5 * Math.max(0, 1 - NK.t / 3)); }
    // rótulos
    capT.style.opacity = !egg && !alv && et > .8 && et < 4.8 ? Math.min(1, (et - .8) * 1.2, (4.8 - et) * 1.2) : 0;
    const midKey = alv ? 'alv' : inside ? kind : ['cry', 'freeze', 'matiRide', 'together'].includes(kind) ? kind + (saved ? '+' : '') : '';
    if (!alv && capM.dataset.k !== midKey){ capM.dataset.k = midKey; capM.innerHTML = midHTML(midKey.replace('+', '')); }
    capM.style.opacity = alv ? (alv.boom ? 0 : Math.min(1, u * 1.5)) : !midKey ? 0 : kind === 'freeze' ? Math.min(1, Math.max(0, (u - 1.5) * 2)) : Math.min(1, u * 1.5);
    const ce = sunAt() + (win ? 1 : 1.2); capE.style.opacity = et > ce && et < tWhite - .6 ? Math.min(1, (et - ce) * .7, (tWhite - .6 - et) * 1.2) : 0;
    fade.style.opacity = et < .6 ? 1 - et / .6 : et > tWhite - 2.6 ? Math.min(1, (et - tWhite + 2.6) / 2.6) : 0;
    forP.style.opacity = et > tWhite + .4 ? Math.min(1, (et - tWhite - .4) / 1.2) : 0;
  });
}
