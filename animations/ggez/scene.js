import { gg } from './gg.js';
import { $, cardCanvas, glowCanvas, loadImg, loadThree, photoFor, quality, rand, rrect } from '@kit';


// =====================================================================
//  GG EZ 3D (Three.js): escenario esports en directo. Pantalla del
//  streamer, letras de vóxeles, túnel hexagonal al ritmo, podios en arco.
//  Motor común (gl.js): suelo pulido con reflejos, neones HDR con bloom,
//  haces volumétricos, cartas biseladas con luz de borde, AO y sombras.
// =====================================================================
function voxelPoints(text, rows){
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const fs = rows * 1.25, font = `900 ${fs}px Orbitron, "Arial Black", Impact, sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width) + 4;
  c.width = w; c.height = Math.ceil(fs * 1.1);
  g.font = font; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(text, 2, c.height / 2);
  const d = g.getImageData(0, 0, c.width, c.height).data, pts = [];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 140) pts.push([x - c.width / 2, c.height / 2 - y]);
  voxelPoints.lastH = c.height;
  return { pts, w: c.width, h: c.height };
}

export async function playGG3D(X){
  const { teams, win, A, later, opts } = X;
  const _vs = { get fxStop(){ return X.getStop(); }, set fxStop(f){ X.setStop(f); } };
  await loadThree(); if (!X.isOpen()) return;
  const layer = $('#vsLayer'), fx = $('#vsFx'), beat = A.beat / 1000, lowQ = quality().mob;
  const imgs = await Promise.all([loadImg($('#vsHero').src), ...teams.flatMap(t => t.members.map(m => loadImg(photoFor(m.name))))]);
  if (!X.isOpen()) return;
  const heroImg = imgs.shift();
  // motor 3D común: bloom HDR, AO, entorno PBR y viñeta; si no hay WebGL, se vuelve a la versión de DOM
  const ctx = await X.three({ clear: 0x05010d, fov: 50, near: .1, far: 400, tone: 'neutral', env: true, envIntensity: .55,
    bloom: { intensity: 1.3, threshold: .8, radius: .8, smoothing: .22 }, ao: lowQ ? false : { radius: 1.6, intensity: 2.2, falloff: 1.2 },
    vignette: { offset: .3, darkness: .6 }, ca: .0007, grain: .04 });
  if (!ctx) return false;
  if (!X.isOpen()) return;
  const flash = document.createElement('div'); flash.className = 'three-flash gg'; fx.appendChild(flash);
  const { T, scene, cam, tex, sun, q } = ctx, W = ctx.W, H = ctx.H;
  scene.fog = new T.Fog(0x05010d, 18, 95);
  cam.position.set(0, 0, 15);
  const VH = 2 * 15 * Math.tan(T.MathUtils.degToRad(25)), VW = VH * W / H, narrow = W / H < .8;
  const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };
  const CY = new T.Color('#00f0ff'), MG = new T.Color('#ff2bd6'), BL = new T.Color('#3d8bff');
  const hdr = (c, k) => new T.Color(c).multiplyScalar(k);   // color HDR (>1) para que el bloom lo recoja
  const RB = (w, h, d, r, s = 3) => new T.RoundedBoxGeometry(w, h, d, s, r);
  const sg = n => Math.max(6, Math.round(n * (lowQ ? .6 : 1)));
  const world = new T.Group(); scene.add(world);
  const offX = !narrow && W >= 900 ? -VW * .095 : 0; world.position.x = offX;   // deja hueco al chat

  // luces (físicas): relleno hemisférico, luz principal con sombra suave, contraluces de neón y dos focos que bailan
  scene.add(new T.HemisphereLight(0x7a86d8, 0x1a0630, 1.3));
  const key = new T.DirectionalLight(0xdfe6ff, 2.6); key.position.set(4, 14, 9); scene.add(key, key.target);
  sun(key, { size: Math.max(VW, VH) * .65, near: 1, far: 60, radius: 4, bias: -.0006, normalBias: .03 });
  const rimC = new T.DirectionalLight(0x00f0ff, 2.2); rimC.position.set(-9, 5, -10); scene.add(rimC);
  const rimM = new T.DirectionalLight(0xff2bd6, 2.2); rimM.position.set(9, 5, -10); scene.add(rimM);
  const pl1 = new T.PointLight(0x00f0ff, 200, 40, 2), pl2 = new T.PointLight(0xff2bd6, 200, 40, 2); scene.add(pl1, pl2);

  // suelo pulido (reflejos del entorno + destellos de los focos), rejilla de neón que avanza y techo
  const floorY = narrow ? -6.4 : -5.2;
  const floor = new T.Mesh(new T.PlaneGeometry(240, 240), new T.MeshPhysicalMaterial({ color: 0x120a2e, metalness: .75, roughness: .26, clearcoat: .8, clearcoatRoughness: .2, envMapIntensity: 1.5 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY - .02; floor.receiveShadow = true; scene.add(floor);
  const gridC = document.createElement('canvas'); gridC.width = gridC.height = 128;
  { const g = gridC.getContext('2d'); g.fillStyle = 'rgba(255,255,255,1)'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 0, 3, 128); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, 128, 9); g.fillRect(0, 0, 9, 128); }
  const gridT = tex(gridC); gridT.wrapS = gridT.wrapT = T.RepeatWrapping; gridT.repeat.set(120, 120);
  const grid = new T.Mesh(new T.PlaneGeometry(240, 240), new T.MeshBasicMaterial({ map: gridT, color: hdr(MG, 1.2), ...AB }));
  grid.rotation.x = -Math.PI / 2; grid.position.y = floorY; scene.add(grid);
  const grid2 = new T.Mesh(grid.geometry, new T.MeshBasicMaterial({ map: gridT, color: hdr(CY, .5), ...AB, side: T.DoubleSide }));
  grid2.rotation.x = Math.PI / 2; grid2.position.y = 11; scene.add(grid2);
  // guías de neón que se alejan a los lados del pasillo
  const dashN = 16, dashL = 9;
  const dashes = new T.InstancedMesh(RB(.22, .09, 3.6, .04, 2), new T.MeshBasicMaterial({ color: 0xffffff }), dashN * 4);
  dashes.instanceColor = new T.InstancedBufferAttribute(new Float32Array(dashN * 12), 3); scene.add(dashes);
  const dashX = [-14, 14, -28, 28], dashZ = Array.from({ length: dashN }, (_, i) => 4 - i * dashL), dummy = new T.Object3D(), tcol = new T.Color();
  // túnel hexagonal: anillos de tubos de neón (una malla fusionada, dos materiales)
  const hexGeo = (() => { const gs = []; for (let k = 0; k < 6; k++){ const a = (k + .5) / 6 * Math.PI * 2 + Math.PI / 6, r = Math.cos(Math.PI / 6); const g = new T.CylinderGeometry(.012, .012, 1.03, sg(6)); g.rotateZ(a); g.translate(Math.cos(a) * r, Math.sin(a) * r, 0); gs.push(g); const j = new T.SphereGeometry(.024, 8, 6); j.translate(Math.cos(k / 6 * Math.PI * 2 + Math.PI / 6), Math.sin(k / 6 * Math.PI * 2 + Math.PI / 6), 0); gs.push(j); } return T.mergeGeometries(gs); })();
  const hexMats = [new T.MeshBasicMaterial({ color: hdr(CY, 2) }), new T.MeshBasicMaterial({ color: hdr(MG, 2) })];
  const hexes = [];
  for (let i = 0; i < 18; i++){
    const l = new T.Mesh(hexGeo, hexMats[i % 2]);
    l.position.set(0, 1, -12 - i * 9); l.scale.setScalar(13); scene.add(l); hexes.push(l);
  }

  // pantalla del streamer (la foto) con marco de neón y badge LIVE
  const hT = heroImg ? tex(heroImg) : null;
  const metal = new T.MeshStandardMaterial({ color: 0x14102a, metalness: .85, roughness: .28, emissive: 0x220a44, emissiveIntensity: .5 });
  const monitor = new T.Group(); world.add(monitor);
  const scr = new T.Mesh(new T.PlaneGeometry(.5625, 1), new T.MeshBasicMaterial({ map: hT, color: 0xd6d6d6 }));
  scr.position.z = .008;
  const housing = new T.Mesh(RB(.5625 * 1.07, 1.05, .07, .035, 3), metal); housing.position.z = -.03; housing.castShadow = true;
  const bezel = new T.Mesh(RB(.5625 * 1.14, 1.12, .05, .05, 3), new T.MeshBasicMaterial({ color: hdr(CY, 2.4) }));
  bezel.position.z = -.055; monitor.add(bezel, housing, scr);
  const liveC = document.createElement('canvas'); liveC.width = 256; liveC.height = 80;
  { const g = liveC.getContext('2d'); rrect(g, 4, 8, 248, 64, 14); g.fillStyle = '#ff2a4f'; g.fill(); g.fillStyle = '#fff'; g.font = '900 40px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('● LIVE', 128, 42); }
  const live = new T.Mesh(new T.PlaneGeometry(.3, .094), new T.MeshBasicMaterial({ map: tex(liveC), transparent: true, color: hdr(0xffffff, 1.3) }));
  live.position.set(-.13, .43, .014); monitor.add(live);
  const monBig = VH * .55, monSmall = VH * (narrow ? .17 : .2), monTopY = VH / 2 - VH * .03 - monSmall / 2;
  monitor.scale.setScalar(monBig); monitor.position.set(0, 0, -90);
  monitor.visible = !win;

  // letras de vóxeles (cubos biselados, con reflejos y brillo propio)
  const vGeo = lowQ ? new T.BoxGeometry(1, 1, 1) : RB(1, 1, 1, .14, 2);
  const vMat = new T.MeshPhysicalMaterial({ color: 0xffffff, metalness: .15, roughness: .42, envMapIntensity: .45, emissive: 0x1d46d8, emissiveIntensity: .4 });
  function voxelText(text, width, y, rows = 26){
    const { pts, w } = voxelPoints(text, rows), cell = width / w;
    const mesh = new T.InstancedMesh(vGeo, vMat, pts.length);
    const data = pts.map(([x, yy], i) => {
      const from = new T.Vector3((Math.random() - .5) * 60, (Math.random() - .5) * 40, -30 - Math.random() * 60);
      const to = new T.Vector3(x * cell, yy * cell, 0), col = new T.Color().copy(BL).lerp(CY, (yy / rows) + .5);
      mesh.setColorAt(i, col);
      return { from, to, d: Math.random() * .6 + (x / w + .5) * .5 };
    });
    mesh.instanceColor.needsUpdate = true;
    const grp = new T.Group(); grp.add(mesh); grp.position.y = y; world.add(grp);
    return { grp, mesh, data, cell, t0: -1, h: voxelPoints.lastH * cell };
  }
  function updVoxels(v, et, pulse){
    if (v.t0 < 0 || et < v.t0) { v.mesh.visible = false; return; }
    v.mesh.visible = true;
    const k0 = (et - v.t0) / 1.4;
    v.data.forEach((d, i) => {
      const k = Math.max(0, Math.min(1, (k0 - d.d * .45) / .55)), e = 1 - Math.pow(1 - k, 3);
      dummy.position.lerpVectors(d.from, d.to, e);
      dummy.rotation.set((1 - e) * 6, (1 - e) * 4, 0);
      const wave = k >= 1 ? 1 + pulse * .35 * Math.max(0, Math.sin(d.to.x * .9 - et * 8)) : 1;
      dummy.scale.set(v.cell * .92, v.cell * .92, v.cell * 2.6 * wave);
      dummy.updateMatrix(); v.mesh.setMatrixAt(i, dummy.matrix);
    });
    v.mesh.instanceMatrix.needsUpdate = true;
  }
  const titleW = Math.min(VW * (narrow ? .7 : .3), win ? 7.5 : 6.2);
  const title = voxelText(win ? 'VICTORY' : 'GG EZ', titleW, 0);
  const titleY = monTopY - monSmall / 2 - .3 - title.h / 2; title.grp.position.y = titleY;

  // podios en arco por equipo
  const n = teams.length, per = Math.max(...teams.map(t => t.members.length));
  const aTop = titleY - title.h / 2 - .5, aBot = floorY + .3;
  const vsGap = n > 1 ? (narrow ? (aTop - aBot) * .1 : VW * .09) : 0;
  const usableW = (W >= 900 && !narrow ? VW * .78 : VW * .94);
  const centers = [];
  let teamW, teamH;
  if (narrow){ teamW = usableW; teamH = (aTop - aBot - (n - 1) * vsGap) / n; for (let i = 0; i < n; i++) centers.push([0, aTop - teamH / 2 - i * (teamH + vsGap)]); }
  else { teamW = Math.min((usableW - (n - 1) * vsGap) / n, n === 1 ? VW * .55 : 99); teamH = aTop - aBot; const tot = n * teamW + (n - 1) * vsGap; for (let i = 0; i < n; i++) centers.push([-tot / 2 + teamW / 2 + i * (teamW + vsGap), (aTop + aBot) / 2]); }
  const perRow = Math.min(per, narrow ? 5 : 6), tiers = Math.ceil(per / perRow);
  const cw = Math.min(teamW / (perRow * (narrow ? 1.32 : 1.22)), teamH / (tiers * 1.33 * 1.25 + .5)), ch = cw * 1.33;

  const backC = document.createElement('canvas'); backC.width = 256; backC.height = 340;
  { const g = backC.getContext('2d'), gr = g.createLinearGradient(0, 0, 256, 340); gr.addColorStop(0, '#ff2bd6'); gr.addColorStop(1, '#00f0ff'); g.fillStyle = gr; g.fillRect(0, 0, 256, 340); g.fillStyle = '#05010d'; g.font = '900 120px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GG', 128, 175); }
  const backTex = tex(backC);
  const side = new T.MeshStandardMaterial({ color: 0x0b0620, metalness: .85, roughness: .22 });
  // geometrías compartidas: carta biselada (cuerpo + marco de luz de borde + láminas con la ilustración y un brillo que barre)
  const bw = cw * .906, bh = ch * .929;
  const cardBodyGeo = RB(bw, bh, .09, .05, 3), cardFrameGeo = RB(bw * 1.045, bh * 1.03, .05, .06, 3), cardPlane = new T.PlaneGeometry(cw, ch), backPlane = new T.PlaneGeometry(bw, bh);
  const sheenC = document.createElement('canvas'); sheenC.width = 256; sheenC.height = 64;
  { const g = sheenC.getContext('2d'), gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.42, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.9)'); gr.addColorStop(.58, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); }
  const sheenT = tex(sheenC); sheenT.wrapS = T.RepeatWrapping; sheenT.repeat.set(1, 1);
  const sheenMat = new T.MeshBasicMaterial({ map: sheenT, color: hdr(0xffffff, .55), ...AB });
  // podio hexagonal biselado
  const pedR = cw * .56;
  const pedGeo = (() => { const s = new T.Shape(); for (let k = 0; k < 6; k++){ const a = k / 6 * Math.PI * 2; k ? s.lineTo(Math.cos(a) * pedR, Math.sin(a) * pedR) : s.moveTo(Math.cos(a) * pedR, Math.sin(a) * pedR); } s.closePath();
    const g = new T.ExtrudeGeometry(s, { depth: .2, bevelEnabled: true, bevelThickness: .05, bevelSize: .06, bevelSegments: 3, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, -.1, 0); return g; })();
  const pedRing = new T.TorusGeometry(pedR * .9, .022, 6, 6); pedRing.rotateX(Math.PI / 2);
  const cards = [], pedestals = [], spots = [], pools = [], frameMats = [];
  // haz volumétrico: cono con borde difuso (fresnel), vetas que giran y caída hacia arriba
  const beamMat = col => new T.ShaderMaterial({
    uniforms: { col: { value: col }, op: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 col; uniform float op; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float edge = pow(f, 1.6); float h = pow(1. - vUv.y, 1.3); float streak = .72 + .28 * sin(vUv.x * 62.83 * 2.); gl_FragColor = vec4(col * 2.2 * edge * h * streak * op, 1.); }',
  });
  const poolC = document.createElement('canvas'); poolC.width = poolC.height = 128;
  { const g = poolC.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const poolT = tex(poolC);
  let ci = 0;
  teams.forEach((t, ti) => {
    const [cx, cy] = centers[ti], col = new T.Color(t.bar);
    const grp = new T.Group(); grp.position.set(cx, cy, 0);
    grp.rotation.y = n > 1 && !narrow ? -cx / (usableW / 2) * .32 : 0; world.add(grp);
    // foco: haz exterior suave + núcleo más estrecho
    const spot = new T.Mesh(new T.ConeGeometry(teamW * .48, 16, sg(48), 1, true), beamMat(col));
    spot.position.set(0, 8 - teamH / 2 + .2, -1.2); grp.add(spot); spots.push(spot);
    const core = new T.Mesh(new T.ConeGeometry(teamW * .2, 16, sg(32), 1, true), beamMat(col.clone().lerp(new T.Color(1, 1, 1), .5)));
    core.position.copy(spot.position); grp.add(core); spots.push(core); core.userData.k = .45;
    // charco de luz en el suelo
    const pool = new T.Mesh(new T.PlaneGeometry(teamW * 1.2, teamW * .8), new T.MeshBasicMaterial({ map: poolT, color: hdr(col, 1.6), ...AB, opacity: 0 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(cx, floorY + .03, -.6); world.add(pool); pools.push(pool);
    const frameMat = new T.MeshBasicMaterial({ color: hdr(col, 2.2) }); frameMats.push(frameMat);
    t.members.forEach((m, k) => {
      const tier = Math.floor(k / perRow), inTier = Math.min(perRow, t.members.length - tier * perRow), idx = k % perRow;
      const spread = Math.min(1.1, (narrow ? .12 : .26) * (inTier - 1)), th = inTier > 1 ? -spread + (2 * spread) * idx / (inTier - 1) : 0;
      const R = cw * inTier * .55 / Math.max(.4, spread);
      const x = Math.sin(th) * Math.min(R, 40), z = (Math.cos(th) - 1) * Math.min(R, 40) - tier * cw * .9;
      const baseY = -teamH / 2 + .25 + tier * ch * .62;
      const ped = new T.Group(), pmat = new T.MeshStandardMaterial({ color: 0x120a26, metalness: .85, roughness: .2, emissive: col, emissiveIntensity: .15 });
      const plate = new T.Mesh(pedGeo, pmat); plate.castShadow = plate.receiveShadow = true;
      const ringM = new T.MeshBasicMaterial({ color: hdr(col, 2) }), ring = new T.Mesh(pedRing, ringM); ring.position.y = .16;
      ped.add(plate, ring);
      ped.position.set(x, baseY - 6, z); ped.rotation.y = th; grp.add(ped);
      pedestals.push({ mesh: ped, mat: pmat, ring: ringM, col, y: baseY, t0: 0 });
      const card = new T.Group();
      const body = new T.Mesh(cardBodyGeo, side); body.castShadow = body.receiveShadow = true;
      const frame = new T.Mesh(cardFrameGeo, frameMat); frame.position.z = -.012; frame.castShadow = true;
      const front = new T.Mesh(cardPlane, new T.MeshBasicMaterial({ map: tex(cardCanvas(m, t.bar, imgs[ci++])), color: 0xd4d4d4, transparent: true })); front.position.z = .047;
      const sheen = new T.Mesh(backPlane, sheenMat); sheen.position.z = .05;
      const back = new T.Mesh(backPlane, new T.MeshBasicMaterial({ map: backTex, color: 0xcccccc })); back.position.z = -.047; back.rotation.y = Math.PI;
      card.add(frame, body, back, front, sheen);
      card.visible = false; grp.add(card);
      cards.push({ mesh: card, ti, k, grp, x, z, th, y: baseY + .15 + ch / 2 + .05, col, landed: false });
    });
  });

  // VS de vóxeles entre equipos
  const vsList = [];
  for (let i = 1; i < n; i++){
    const [x1, y1] = centers[i - 1], [x2, y2] = centers[i];
    const v = voxelText('VS', narrow ? Math.min(2.4, vsGap * 2.2) : Math.min(vsGap * .95, 3), 0, 22);
    world.remove(v.grp); v.grp.position.set((x1 + x2) / 2, (y1 + y2) / 2, 1.2); world.add(v.grp); vsList.push(v);
  }

  // efectos: anillos, chispas al aterrizar, brasas flotantes y confeti
  const fxList = [];
  const sparkTex = tex(glowCanvas([[0, 'rgba(255,255,255,1)'], [.25, 'rgba(255,255,255,.7)'], [1, 'rgba(0,0,0,0)']]));
  const ringGeo = new T.RingGeometry(.9, 1, sg(64));
  function floorRing(parent, pos, color, maxR, dur){
    const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: hdr(color, 3), ...AB, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); parent.add(m);
    fxList.push({ obj: m, parent, t: 0, dur, upd: (o, k) => { o.scale.setScalar(.1 + maxR * (1 - Math.pow(1 - k, 3))); o.material.opacity = 1 - k; } });
  }
  function burst(parent, pos, color, cnt, sp){
    const p = new Float32Array(cnt * 3), v = [];
    for (let i = 0; i < cnt; i++){ p.set([pos.x, pos.y, pos.z], i * 3); const a = Math.random() * Math.PI * 2, e = Math.random() * 1.1; v.push(Math.cos(a) * sp * (.3 + Math.random()), Math.sin(e) * sp * (.6 + Math.random()), Math.sin(a) * sp * (.3 + Math.random())); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ color: hdr(color, 3.2), size: .2, map: sparkTex, ...AB })); parent.add(pts);
    fxList.push({ obj: pts, parent, t: 0, dur: .8, upd: (o, k, dt) => { const a = o.geometry.attributes.position.array; for (let i = 0; i < cnt; i++){ a[i*3] += v[i*3] * dt; a[i*3+1] += v[i*3+1] * dt; a[i*3+2] += v[i*3+2] * dt; v[i*3+1] -= 14 * dt; } o.geometry.attributes.position.needsUpdate = true; o.material.opacity = 1 - k; } });
  }
  const EN = lowQ ? 120 : 260, emb = new Float32Array(EN * 3), embV = [];
  for (let i = 0; i < EN; i++){ emb.set([(Math.random() - .5) * VW * 1.3, floorY + Math.random() * (VH + 4), -10 + Math.random() * 14], i * 3); embV.push(.25 + Math.random() * .7); }
  const embG = new T.BufferGeometry(); embG.setAttribute('position', new T.BufferAttribute(emb, 3));
  const embers = new T.Points(embG, new T.PointsMaterial({ color: hdr(0x9fe8ff, 2.4), size: .14, map: sparkTex, ...AB, opacity: .8 })); scene.add(embers);
  // confeti de cubitos
  const CN = lowQ ? 220 : 420, conf = new T.InstancedMesh(RB(.14, .14, .03, .01, 1), new T.MeshBasicMaterial({ color: 0xffffff }), CN), cData = [];
  for (let i = 0; i < CN; i++){ cData.push({ p: new T.Vector3((Math.random() - .5) * VW, VH / 2 + Math.random() * VH, (Math.random() - .5) * 6), v: .8 + Math.random() * 1.6, r: Math.random() * 6, s: (Math.random() - .5) * 8 }); conf.setColorAt(i, new T.Color().setHSL(Math.random(), 1, .6).multiplyScalar(1.5)); }
  conf.instanceColor.needsUpdate = true; conf.visible = false; world.add(conf);

  // ---- línea de tiempo (en compases) ----
  const tUp = 5 * beat, tTitle = 5 * beat, tPeds = 7 * beat, tVs = 8 * beat, tCards = 9 * beat;
  const step = cards.length > 10 ? beat / 2 : beat;
  const order = []; for (let r = 0; r < per; r++) teams.forEach((t, ti) => { const c = cards.find(x => x.ti === ti && x.k === r); if (c) order.push(c); });
  order.forEach((c, i) => { c.tLand = tCards + (i + 1) * step; });
  const tDone = tCards + order.length * step + 1.5 * beat;
  title.t0 = tTitle; vsList.forEach(v => v.t0 = tVs);
  pedestals.forEach((p, i) => p.t0 = tPeds + i * .05);
  later(() => { layer.classList.remove('intro'); layer.classList.add('up'); }, tUp * 1000);
  later(() => { X.done(); gg.alert(win ? `🏆 ${teams[0].name} gana. GG EZ` : '✅ Partida lista · GG EZ'); }, tDone * 1000);
  later(X.close, (tDone + (A.hold || 3700) / 1000) * 1000);

  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const outBack = k => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  let punch = 0, lastBeat = -1, flashed = false;
  ctx.start((et, dt) => {
    const bi = Math.floor(et / beat), bk = (et % beat) / beat, pulse = Math.pow(1 - bk, 3);
    if (bi !== lastBeat){ lastBeat = bi; punch = 1; }
    punch *= Math.pow(.001, dt);

    // túnel y rejillas al ritmo
    const spd = 30 + (et < tUp ? 60 * (et / tUp) : 0);
    hexes.forEach((h, i) => { h.position.z += spd * dt; if (h.position.z > 2) h.position.z -= 18 * 9; h.rotation.z = et * .3 + i * .08; h.scale.setScalar(13 + pulse * 1.4); });
    hexMats[0].color.copy(CY).multiplyScalar(1.1 + 2.2 * pulse * .6 + .5); hexMats[1].color.copy(MG).multiplyScalar(1.1 + 2.2 * pulse + .5);
    grid.position.z = (et * spd * .5) % 2; grid2.position.z = grid.position.z;
    grid.material.color.copy(MG).lerp(CY, .5 + .5 * Math.sin(et * .8)).multiplyScalar(.8 + 1.5 * pulse);
    const dz = (et * spd * .6) % (dashN * dashL);
    for (let s = 0; s < 4; s++) for (let i = 0; i < dashN; i++){
      const z = ((dashZ[i] + dz + dashN * dashL * 4) % (dashN * dashL)) - dashN * dashL + 6;
      dummy.position.set(dashX[s], floorY + .05, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); dashes.setMatrixAt(s * dashN + i, dummy.matrix);
      tcol.copy(s % 2 ? MG : CY).multiplyScalar(1.6 + 1.8 * pulse); dashes.setColorAt(s * dashN + i, tcol);
    }
    dashes.instanceMatrix.needsUpdate = true; dashes.instanceColor.needsUpdate = true;
    pl1.position.set(Math.sin(et * 1.3) * 9, 3, 6); pl2.position.set(Math.cos(et * 1.1) * 9, -2, 6);
    pl1.intensity = 130 + 150 * pulse; pl2.intensity = 130 + 150 * pulse;
    // brasas que suben
    { const a = embG.attributes.position.array; for (let i = 0; i < EN; i++){ a[i * 3 + 1] += embV[i] * dt; a[i * 3] += Math.sin(et + i) * .2 * dt; if (a[i * 3 + 1] > floorY + VH + 4) a[i * 3 + 1] = floorY; } embG.attributes.position.needsUpdate = true; }

    // pantalla del streamer
    if (et < tUp){
      const k = ease(Math.min(1, et / (4 * beat)));
      monitor.position.set(0, 0, -90 + 90 * k);
      monitor.rotation.set(Math.sin(et * 3) * .3 * (1 - k), (1 - k) * Math.PI * 6, 0);
      monitor.scale.setScalar(monBig * (1 + pulse * .04 * k));
      if (k >= 1 && !flashed){ flashed = true; flash.classList.add('go'); }
    } else {
      const k = ease(Math.min(1, (et - tUp) / (2 * beat)));
      monitor.position.set(0, monTopY * k, 0);
      monitor.scale.setScalar((monBig + (monSmall - monBig) * k) * (1 + pulse * .035));
      monitor.rotation.set(0, Math.sin(et * Math.PI / (beat * 4)) * .35 * k, 0);
    }
    bezel.material.color.copy(CY).lerp(MG, .5 + .5 * Math.sin(et * 4)).multiplyScalar(2 + pulse * 1.2);

    updVoxels(title, et, pulse);
    vsList.forEach(v => { updVoxels(v, et, pulse); v.grp.rotation.y = et > tVs ? (et - tVs) * Math.PI / (beat * 4) : 0; v.grp.scale.setScalar(1 + pulse * .12); });

    // podios
    pedestals.forEach(p => {
      const k = Math.max(0, Math.min(1, (et - p.t0) / (beat * 1.5)));
      p.mesh.position.y = p.y - 6 * (1 - outBack(k)) - .15;
      p.mat.emissiveIntensity = .15 + .5 * pulse * k + (et > tDone ? .4 : 0);
      p.ring.color.copy(p.col).multiplyScalar((1.4 + 2.4 * pulse) * k + .1);
    });
    spots.forEach(s => { const o = et > tPeds ? Math.min(.22, (et - tPeds) * .3) * (.75 + .25 * pulse) + (et > tDone ? .08 : 0) : 0; s.material.uniforms.op.value = o * 1.7 * (s.userData.k || 1); s.rotation.y = et * .4; });
    pools.forEach(p => { p.material.opacity = et > tPeds ? Math.min(.55, (et - tPeds) * .5) * (.7 + .3 * pulse) : 0; });
    frameMats.forEach((m, i) => m.color.copy(new T.Color(teams[i].bar)).multiplyScalar(1.6 + 1.6 * pulse));
    sheenT.offset.x = -((et * .45) % 2) + .5; sheenMat.opacity = .85;

    // cartas: caen girando sobre su podio, al compás
    for (const c of cards){
      const tl = c.tLand, ts = tl - beat * .95;
      if (et < ts) continue;
      c.mesh.visible = true;
      if (et < tl){
        const k = (et - ts) / (tl - ts), e = k * k;
        c.mesh.position.set(c.x, c.y + (1 - e) * 9, c.z);
        c.mesh.rotation.set(0, c.th + (1 - e) * Math.PI * 4 + Math.PI, (1 - e) * .6);
        c.mesh.scale.setScalar(.6 + .4 * e);
      } else {
        if (!c.landed){
          c.landed = true;
          floorRing(c.grp, new T.Vector3(c.x, c.y - ch / 2 - .05, c.z), c.col.getHex(), cw * 1.8, .6);
          burst(c.grp, new T.Vector3(c.x, c.y - ch / 2, c.z + .2), c.col, lowQ ? 22 : 44, 4.2);
          punch = 1.4;
          const team = teams[c.ti];
          gg.alert(`🎮 ${team.members[c.k].name} se une a ${team.name}`);
          if (gg.push) gg.push(['gg ' + team.members[c.k].name, team.members[c.k].name + ' 1v9', 'EZ ' + team.members[c.k].name, team.members[c.k].name + ' diff'][rand(4)]);
        }
        const lk = Math.min(1, (et - tl) / (beat * .8));
        const done = et > tDone ? Math.min(1, (et - tDone) / beat) : 0;
        c.mesh.position.set(c.x, c.y + (1 - outBack(lk)) * -.3 + done * (.25 + .12 * pulse), c.z);
        c.mesh.rotation.set(0, c.th + done * Math.sin(et * 2 + c.k) * .18, 0);
        c.mesh.scale.setScalar(1 + pulse * .04);
      }
    }

    // confeti en modo ganador
    if (win && et > tDone){
      conf.visible = true;
      cData.forEach((d, i) => {
        d.p.y -= d.v * dt * 3; if (d.p.y < floorY) d.p.y = VH / 2 + 1;
        d.r += d.s * dt; dummy.position.copy(d.p); dummy.rotation.set(d.r, d.r * .7, d.r * .3); dummy.scale.setScalar(1); dummy.updateMatrix(); conf.setMatrixAt(i, dummy.matrix);
      });
      conf.instanceMatrix.needsUpdate = true;
    }

    for (let i = fxList.length - 1; i >= 0; i--){
      const f = fxList[i]; f.t += dt; const k = Math.min(1, f.t / f.dur); f.upd(f.obj, k, dt);
      if (k >= 1){ f.parent.remove(f.obj); f.obj.geometry !== ringGeo && f.obj.geometry.dispose(); f.obj.material.dispose(); fxList.splice(i, 1); }
    }

    // cámara: golpe de zoom en cada beat + barrido orbital al final
    const fov = 50 - punch * 1.6;
    if (Math.abs(cam.fov - fov) > .01){ cam.fov = fov; cam.updateProjectionMatrix(); }
    const sweep = et > tDone ? Math.min(1, (et - tDone) / 1.5) : 0;
    cam.position.set(Math.sin((et - tDone) * .55) * 3.2 * sweep, Math.sin(et * .7) * .25 + sweep * 1.2, 15 - sweep * 1.2);
    cam.lookAt(offX * .3 * sweep, -sweep * .6, 0);
  });
  const st = _vs.fxStop; _vs.fxStop = () => { flash.remove(); st(); };
  return true;
}
