import { $, faceCanvas, glowCanvas, loadImg, loadThree, photoFor, popSprite, rand, rrect, synth, textCanvas } from '@kit';


// =====================================================================
//  FERIA 3D: coches de choque. Los jugadores van en coches que chocan;
//  cada embestida asigna equipo y el coche se va a aparcar a su lado.
// =====================================================================
export async function playFeria(X){
  const { teams, win, A, later, opts } = X;
  const _vs = { get fxStop(){ return X.getStop(); }, set fxStop(f){ X.setStop(f); } };
  await loadThree(); if (!X.isOpen()) return;
  const layer = $('#vsLayer');
  const imgs = await Promise.all([loadImg($('#vsHero').src), ...teams.flatMap(t => t.members.map(m => loadImg(photoFor(m.name))))]);
  if (!X.isOpen()) return;
  const heroImg = imgs.shift();
  const ctx = await X.three({ clear: 0x04010c, fov: 46, tone: 'neutral', env: true, envIntensity: .85,
    bloom: { intensity: 1.15, threshold: .85, radius: .75, smoothing: .2 }, ao: { radius: 1.3, intensity: 2.6, falloff: 1.2 },
    vignette: { offset: .3, darkness: .55 }, ca: .0005, grain: .03 });
  if (!ctx) return;
  const { T, scene, cam, tex, sun, q } = ctx, W = ctx.W, H = ctx.H, narrow = W / H < .8;
  scene.fog = new T.Fog(0x04010c, 38, 108);
  const S = synth();
  const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };
  // color HDR: multiplicado por encima de 1 para que el bloom lo recoja
  const hdr = (c, k) => new T.Color(c).multiplyScalar(k);
  const RB = (w, h, d, r, s = 3) => new T.RoundedBoxGeometry(w, h, d, s, r);
  const lod = q.mob ? .6 : 1, seg = n => Math.max(6, Math.round(n * lod));
  const shade = (o, c = true, r = true) => { o.traverse(m => { if (m.isMesh){ m.castShadow = c; m.receiveShadow = r; } }); return o; };

  // ---- medidas de la pista según la pantalla ----
  const camD = new T.Vector3(0, 9.5, 14.5), look = new T.Vector3(0, 0, .6);
  const dist = camD.distanceTo(look), visH = 2 * dist * Math.tan(T.MathUtils.degToRad(24)), visW = visH * W / H;
  const RX = Math.min(12, visW * .43), RZ = narrow ? 6.5 : 6.2;
  const all = teams.flatMap((t, ti) => t.members.map((m, k) => ({ m, ti, k, team: t })));
  const N = all.length, rc = Math.max(.5, Math.min(1, Math.sqrt(RX * RZ * 4 / N) * .21));

  // ---- luces (físicas: direccional/ambiente ×π; puntuales con caída 1/d²) ----
  scene.add(new T.HemisphereLight(0x8a7aff, 0x1a0a30, 1.1));
  const key = new T.DirectionalLight(0xfff0e0, 2.4); key.position.set(5, 14, 8); scene.add(key, key.target);
  sun(key, { size: Math.max(RX, RZ) + 6, near: 2, far: 50, radius: 4, bias: -.0005, normalBias: .03 });
  const pls = [0xff2a6a, 0x2ad8ff, 0xffd23f, 0x7dff6a].map((c, i) => { const l = new T.PointLight(c, 90, 34, 2); l.position.set((i - 1.5) * RX * .6, 5.6, (i % 2 ? 1 : -1) * RZ * .5); scene.add(l); return l; });
  const flashL = new T.PointLight(0xfff2b0, 0, 14, 2); scene.add(flashL);   // destello de choque (una sola luz reutilizada)

  // ---- suelo metálico de placas, bordes de goma, red del techo ----
  const fc = document.createElement('canvas'); fc.width = fc.height = 512;
  { const g = fc.getContext('2d'); g.fillStyle = '#15161d'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++){ const x = i * 256, y = j * 256, gr = g.createLinearGradient(x, y, x + 256, y + 256); gr.addColorStop(0, '#6d7288'); gr.addColorStop(.5, '#4a4f62'); gr.addColorStop(1, '#383c4c'); g.fillStyle = gr; rrect(g, x + 6, y + 6, 244, 244, 10); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; rrect(g, x + 10, y + 10, 236, 236, 8); g.stroke();
      // rejilla antideslizante: rombos
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 3; for (let k = -256; k < 256; k += 22){ g.beginPath(); g.moveTo(x + 30 + k, y + 30); g.lineTo(x + 226 + k, y + 226); g.stroke(); }
      g.fillStyle = '#a9aec4'; [[20, 20], [236, 20], [20, 236], [236, 236]].forEach(([dx, dy]) => { g.beginPath(); g.arc(x + dx, y + dy, 4.5, 0, 7); g.fill(); }); } }
  const ft = tex(fc); ft.wrapS = ft.wrapT = T.RepeatWrapping; ft.repeat.set(RX / 1.6, RZ / 1.6);
  const fb = document.createElement('canvas'); fb.width = fb.height = 256;   // relieve: placas y remaches
  { const g = fb.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 6); g.fillRect(0, 0, 6, 256); g.fillRect(125, 0, 6, 256); g.fillRect(0, 125, 256, 6); g.lineWidth = 3; g.strokeStyle = '#888'; for (let k = -128; k < 128; k += 11){ g.beginPath(); g.moveTo(15 + k, 15); g.lineTo(113 + k, 113); g.stroke(); } }
  const fbt = tex(fb, { linear: true }); fbt.wrapS = fbt.wrapT = T.RepeatWrapping; fbt.repeat.copy(ft.repeat);
  const floor = new T.Mesh(new T.PlaneGeometry(RX * 2 + 1, RZ * 2 + 1), new T.MeshPhysicalMaterial({ map: ft, bumpMap: fbt, bumpScale: 1.4, metalness: .9, roughness: .3, clearcoat: .5, clearcoatRoughness: .25, envMapIntensity: 1.3 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // suelo oscuro de la feria alrededor de la pista
  const ground = new T.Mesh(new T.PlaneGeometry(260, 260), new T.MeshStandardMaterial({ color: 0x0b0716, roughness: .85, metalness: .1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.04; ground.receiveShadow = true; scene.add(ground);
  const sc = document.createElement('canvas'); sc.width = 128; sc.height = 16;
  { const g = sc.getContext('2d'); for (let i = 0; i < 8; i++){ g.fillStyle = i % 2 ? '#15151a' : '#ffd23f'; g.beginPath(); g.moveTo(i * 16, 16); g.lineTo(i * 16 + 8, 0); g.lineTo(i * 16 + 24, 0); g.lineTo(i * 16 + 16, 16); g.fill(); } }
  const stripe = tex(sc); stripe.wrapS = T.RepeatWrapping;
  const wallMat = new T.MeshPhysicalMaterial({ map: stripe, roughness: .45, clearcoat: .6, clearcoatRoughness: .3 });
  [[0, -RZ - .3, RX * 2 + 1.2, .5], [0, RZ + .3, RX * 2 + 1.2, .5]].forEach(([x, z, w, d]) => { const m = new T.Mesh(RB(w, .55, d, .2, 3), wallMat); m.position.set(x, .28, z); scene.add(shade(m)); });
  [[-RX - .3, 0], [RX + .3, 0]].forEach(([x, z]) => { const m = new T.Mesh(RB(.5, .55, RZ * 2 + 1.2, .2, 3), wallMat); m.position.set(x, .28, z); scene.add(shade(m)); });
  stripe.repeat.set(12, 1);
  // tiras de neón (HDR) en la base interior de la valla
  const neonA = new T.MeshBasicMaterial({ color: hdr(0xff2a6a, 3.2) }), neonB = new T.MeshBasicMaterial({ color: hdr(0x2ad8ff, 3.2) });
  [[0, -RZ + .02, RX * 2, .05, neonA], [0, RZ - .02, RX * 2, .05, neonB]].forEach(([x, z, w, d, mt]) => { const m = new T.Mesh(new T.BoxGeometry(w, .04, d), mt); m.position.set(x, .06, z); scene.add(m); });
  [[-RX + .02, neonB], [RX - .02, neonA]].forEach(([x, mt]) => { const m = new T.Mesh(new T.BoxGeometry(.05, .04, RZ * 2), mt); m.position.set(x, .06, 0); scene.add(m); });
  const ceilY = 6.2;
  const net = new T.GridHelper(Math.max(RX, RZ) * 2.2, 26, 0x7a8aff, 0x4a44a0); net.position.y = ceilY; net.material.transparent = true; net.material.opacity = .45; scene.add(net);

  // ---- bombillas (instanciadas, HDR) con cable y postes cromados ----
  const bulbCols = [0xff2a6a, 0xffd23f, 0x2ad8ff, 0x7dff6a, 0xff8a2a];
  const perim = [[-RX - .6, -RZ - .6], [RX + .6, -RZ - .6], [RX + .6, RZ + .6], [-RX - .6, RZ + .6]];
  const bulbPos = [], wireMat = new T.MeshStandardMaterial({ color: 0x08060c, roughness: .6 });
  const chromePost = new T.MeshStandardMaterial({ color: 0xd8d8ea, metalness: 1, roughness: .16 });
  for (let s = 0; s < 4; s++){
    const [x1, z1] = perim[s], [x2, z2] = perim[(s + 1) % 4], L = Math.hypot(x2 - x1, z2 - z1), n = Math.round(L / 1.1), pts = [];
    for (let i = 0; i <= n; i++){ const k = i / n; pts.push(new T.Vector3(x1 + (x2 - x1) * k, 2.6 + Math.sin(k * Math.PI) * -.35, z1 + (z2 - z1) * k)); if (i < n) bulbPos.push(pts[i]); }
    const wire = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), n * 4, .018, 5), wireMat); wire.castShadow = true; scene.add(wire);
    const post = new T.Group();
    const shaft = new T.Mesh(new T.CylinderGeometry(.07, .1, 2.6, seg(14)), chromePost), cap = new T.Mesh(new T.SphereGeometry(.14, seg(14), seg(10)), chromePost), foot = new T.Mesh(new T.CylinderGeometry(.22, .26, .12, seg(16)), wallMat);
    shaft.position.y = 1.3; cap.position.y = 2.66; foot.position.y = .06; post.add(shaft, cap, foot); post.position.set(x1, 0, z1); scene.add(shade(post));
  }
  const bulbN = bulbPos.length, bulbs = new T.InstancedMesh(new T.SphereGeometry(.14, seg(14), seg(10)), new T.MeshBasicMaterial({ color: 0xffffff }), bulbN);
  const bulbBase = new T.InstancedMesh(new T.CylinderGeometry(.06, .08, .1, 8), wireMat, bulbN), dm = new T.Object3D(), tc = new T.Color();
  bulbPos.forEach((p, i) => { dm.position.copy(p); dm.updateMatrix(); bulbs.setMatrixAt(i, dm.matrix); dm.position.y += .15; dm.updateMatrix(); bulbBase.setMatrixAt(i, dm.matrix); });
  bulbs.instanceColor = new T.InstancedBufferAttribute(new Float32Array(bulbN * 3), 3); scene.add(bulbs, bulbBase);

  // ---- noria al fondo: estructura con rayos, góndolas que se mantienen verticales y luces en cadena ----
  const WX = -RX * .72, WY = 6, WZ = -20, WR = 5.8;
  const wheelRoot = new T.Group(); wheelRoot.position.set(WX, 0, WZ); scene.add(wheelRoot);
  const wheel = new T.Group(); wheel.position.set(0, WY, 0); wheelRoot.add(wheel);
  const steel = new T.MeshStandardMaterial({ color: 0xb9b2d8, metalness: .8, roughness: .35, emissive: 0x241a4a, emissiveIntensity: .6 });
  const rimMat = new T.MeshStandardMaterial({ color: 0x3a1030, emissive: 0xff5ab8, emissiveIntensity: 2.6, roughness: .4 });
  const rim2Mat = new T.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x2ad8ff, emissiveIntensity: 2.2, roughness: .4 });
  const rod = (a, b, r, mat, sg = 8) => { const d = b.clone().sub(a), m = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), sg), mat); m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return m; };
  for (const z of [-.7, .7]){
    const r1 = new T.Mesh(new T.TorusGeometry(WR, .12, 10, seg(96)), rimMat); r1.position.z = z; wheel.add(r1);
    const r2 = new T.Mesh(new T.TorusGeometry(WR * .55, .07, 8, seg(64)), rim2Mat); r2.position.z = z; wheel.add(r2);
    for (let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2; wheel.add(rod(new T.Vector3(0, 0, z), new T.Vector3(Math.cos(a) * WR, Math.sin(a) * WR, z), .045, steel, 6)); }
  }
  for (let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2; wheel.add(rod(new T.Vector3(Math.cos(a) * WR, Math.sin(a) * WR, -.7), new T.Vector3(Math.cos(a) * WR, Math.sin(a) * WR, .7), .05, steel, 6)); }
  const hub = new T.Mesh(new T.CylinderGeometry(.7, .7, 1.8, seg(24)), steel); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  const hubGlow = new T.Mesh(new T.SphereGeometry(.45, 16, 12), new T.MeshBasicMaterial({ color: hdr(0xffd23f, 3) })); hubGlow.position.z = .95; wheel.add(hubGlow);
  // bombillas del aro (cadena)
  const rimN = q.mob ? 32 : 64, rimB = new T.InstancedMesh(new T.SphereGeometry(.14, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff }), rimN * 2);
  rimB.instanceColor = new T.InstancedBufferAttribute(new Float32Array(rimN * 6), 3);
  for (let i = 0; i < rimN; i++) for (let s = 0; s < 2; s++){ const a = i / rimN * Math.PI * 2; dm.position.set(Math.cos(a) * (WR + .05), Math.sin(a) * (WR + .05), s ? .7 : -.7); dm.rotation.set(0, 0, 0); dm.scale.setScalar(1); dm.updateMatrix(); rimB.setMatrixAt(i * 2 + s, dm.matrix); }
  wheel.add(rimB);
  // góndolas
  const cabCols = [0xff3b6b, 0x3bc8ff, 0xffd23f, 0x7dff6a, 0xff8a2a, 0xc46bff];
  const cabGeo = RB(1, .8, .9, .14, 3), roofGeo = new T.ConeGeometry(.78, .42, 4), winMat = new T.MeshBasicMaterial({ color: hdr(0xfff0c0, 2.4) });
  const cabins = [];
  for (let i = 0; i < 16; i++){
    const a = i / 16 * Math.PI * 2, pivot = new T.Group(); pivot.position.set(Math.cos(a) * WR, Math.sin(a) * WR, 0);
    const cab = new T.Group(), bm = new T.MeshStandardMaterial({ color: cabCols[i % 6], metalness: .35, roughness: .3, emissive: cabCols[i % 6], emissiveIntensity: .12 });
    const body = new T.Mesh(cabGeo, bm); body.position.y = -1.15; const roof = new T.Mesh(roofGeo, bm); roof.rotation.y = Math.PI / 4; roof.position.y = -.55;
    const win = new T.Mesh(new T.PlaneGeometry(.62, .32), winMat); win.position.set(0, -1.1, .46); const win2 = win.clone(); win2.position.z = -.46; win2.rotation.y = Math.PI;
    const arm = rod(new T.Vector3(-.35, -.6, 0), new T.Vector3(0, 0, 0), .03, steel, 5), arm2 = rod(new T.Vector3(.35, -.6, 0), new T.Vector3(0, 0, 0), .03, steel, 5);
    cab.add(body, roof, win, win2, arm, arm2); pivot.add(cab); wheel.add(pivot); cabins.push(pivot);
  }
  // patas en A y base
  const lx = [-WR * .68, WR * .68];
  for (const z of [-1.1, 1.1]){
    for (const x of lx) wheelRoot.add(rod(new T.Vector3(x, -.05, z * 1.5), new T.Vector3(0, WY, z * .55), .16, steel, 8));
    wheelRoot.add(rod(new T.Vector3(-WR * .4, WY * .42, z * 1.1), new T.Vector3(WR * .4, WY * .42, z * 1.1), .07, steel, 6));
  }
  const baseP = new T.Mesh(RB(WR * 1.9, .35, 4.4, .12, 2), new T.MeshStandardMaterial({ color: 0x1a1230, roughness: .5, metalness: .6 })); baseP.position.y = .08; wheelRoot.add(baseP);
  // luces a lo largo de las patas
  const legB = new T.InstancedMesh(new T.SphereGeometry(.1, 8, 6), new T.MeshBasicMaterial({ color: hdr(0xffd23f, 2.8) }), 2 * 2 * 9);
  { let n = 0; for (const z of [-1.1, 1.1]) for (const x of lx) for (let i = 0; i < 9; i++){ const k = (i + .5) / 9; dm.position.set(x * (1 - k), -.05 + (WY + .05) * k, z * 1.5 * (1 - k) + z * .55 * k + .2); dm.updateMatrix(); legB.setMatrixAt(n++, dm.matrix); } }
  wheelRoot.add(legB);
  wheelRoot.traverse(m => { if (m.isMesh && !m.isInstancedMesh){ m.castShadow = true; m.receiveShadow = true; } });
  // puestos de feria de fondo (siluetas con toldo y bombillas)
  const awnTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d'); for (let i = 0; i < 8; i++){ g.fillStyle = i % 2 ? '#fff' : '#ff2a6a'; g.fillRect(i * 16, 0, 16, 32); } return tex(c); })();
  [[-RX - 7, -17], [RX + 7, -19], [RX * .35, -34], [-RX * 1.5, -33], [RX * 1.25, -30]].forEach(([x, z], i) => {
    const st = new T.Group(), cm = new T.MeshStandardMaterial({ color: [0x2b1650, 0x16304f, 0x4f1636][i % 3], roughness: .7 });
    const box = new T.Mesh(RB(4.2, 2.4, 3, .12, 2), cm); box.position.y = 1.2;
    const awn = new T.Mesh(RB(4.6, .25, 1.6, .1, 2), new T.MeshStandardMaterial({ map: awnTex, roughness: .6, emissive: 0x2a0a18, emissiveIntensity: .4 })); awn.rotation.x = .35; awn.position.set(0, 2.55, 1.6);
    const lamp = new T.Mesh(new T.BoxGeometry(3.6, .1, .1), new T.MeshBasicMaterial({ color: hdr(bulbCols[i % 5], 3) })); lamp.position.set(0, 2.2, 2.3);
    st.add(box, awn, lamp); st.position.set(x, 0, z); st.rotation.y = -x * .015; scene.add(shade(st));
  });

  // ---- letrero de neón + foto del chico ----
  const signC = document.createElement('canvas'); signC.width = 1024; signC.height = 300;
  const drawSign = (l1, l2, on) => { const g = signC.getContext('2d'); g.clearRect(0, 0, 1024, 300); rrect(g, 8, 8, 1008, 284, 40); g.fillStyle = 'rgba(20,6,40,.9)'; g.fill(); g.lineWidth = 10; g.strokeStyle = on ? '#ff2a6a' : '#5a2040'; g.shadowColor = '#ff2a6a'; g.shadowBlur = on ? 30 : 0; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic 900 104px Bungee, "Arial Black", sans-serif'; g.fillStyle = on ? '#fff59a' : '#6a5a2a'; g.shadowColor = '#ffd23f'; g.fillText(l1, 512, 120, 960);
    g.font = '800 54px "Plus Jakarta Sans", system-ui, sans-serif'; g.fillStyle = on ? '#7ff8ff' : '#2a5a6a'; g.shadowColor = '#2ad8ff'; g.fillText(l2, 512, 222, 940); };
  const signT = tex(signC);
  const sw = narrow ? 6.4 : 9, sh = narrow ? 1.9 : 2.64, sy = narrow ? 4.6 : 3.7, sz = -RZ - 2;
  const sign = new T.Mesh(new T.PlaneGeometry(sw, sh), new T.MeshBasicMaterial({ map: signT, transparent: true, color: hdr(0xffffff, 1.6) }));
  sign.position.set(0, sy, sz); sign.rotation.x = -.12; scene.add(sign);
  const signBack = new T.Mesh(RB(sw + .3, sh + .3, .3, .12, 3), new T.MeshStandardMaterial({ color: 0x120a22, metalness: .8, roughness: .3 })); signBack.position.set(0, sy, sz - .17); signBack.rotation.x = -.12; scene.add(shade(signBack));
  for (const sx of [-1, 1]){ const leg = new T.Mesh(new T.CylinderGeometry(.09, .12, sy - sh / 2 + .1, 10), chromePost); leg.position.set(sx * (sw / 2 - .5), (sy - sh / 2) / 2, sz - .3); scene.add(shade(leg)); }
  // focos sobre el letrero
  for (const sx of [-1, 0, 1]){ const lamp = new T.Mesh(new T.CylinderGeometry(.12, .16, .3, 10), new T.MeshStandardMaterial({ color: 0x222233, metalness: .9, roughness: .3 })); lamp.rotation.x = Math.PI / 2 - .5; lamp.position.set(sx * sw * .32, sy + sh / 2 + .35, sz + .25); const gl = new T.Mesh(new T.CircleGeometry(.1, 12), new T.MeshBasicMaterial({ color: hdr(0xfff0c0, 4) })); gl.position.set(0, .16, 0); gl.rotation.x = -Math.PI / 2; lamp.add(gl); scene.add(lamp); }
  const l1 = win ? A.winTitle : A.title, l2 = win ? teams[0].name : (teams.length === 2 ? `${teams[0].name} vs ${teams[1].name}` : teams.map(t => t.name).join(' · '));
  drawSign(l1, l2, false); signT.needsUpdate = true;
  let hero = null;
  if (!win && heroImg){ const ht = tex(heroImg);
    hero = new T.Group();
    const fr = new T.Mesh(RB(1.34, 2.2, .14, .07, 3), new T.MeshStandardMaterial({ color: 0xffd23f, metalness: 1, roughness: .22, emissive: 0xffa010, emissiveIntensity: .35 }));
    const ph = new T.Mesh(new T.PlaneGeometry(1.125, 2), new T.MeshBasicMaterial({ map: ht, color: 0xdddddd })); ph.position.z = .08; hero.add(fr, ph);
    shade(hero); hero.position.set(0, sy + (narrow ? 2.2 : 2.45), -RZ - 2.2); hero.scale.setScalar(.01); scene.add(hero); }

  // ---- coches de choque ----
  const rubber = new T.MeshStandardMaterial({ color: 0x0c0c10, roughness: .75 });
  const chrome = new T.MeshStandardMaterial({ color: 0xe0e0f0, metalness: 1, roughness: .14 });
  const seatMat = new T.MeshPhysicalMaterial({ color: 0x1c0d18, roughness: .5, clearcoat: .6 });
  const lightMat = new T.MeshBasicMaterial({ color: hdr(0xfff2c0, 4.5) }), tailMat = new T.MeshBasicMaterial({ color: hdr(0xff2020, 3.5) });
  const neutral = [0xff3b6b, 0x3bc8ff, 0xffd23f, 0x7dff6a, 0xff8a2a, 0xc46bff];
  const sparkTex = tex(glowCanvas([[0, 'rgba(255,255,255,1)'], [.2, 'rgba(160,220,255,.9)'], [1, 'rgba(0,0,0,0)']]));
  const glowTex = tex(glowCanvas([[0, 'rgba(255,255,255,.95)'], [.45, 'rgba(255,255,255,.35)'], [1, 'rgba(0,0,0,0)']]));
  // geometrías compartidas (en unidades de rc)
  const G = {
    tub: new T.LatheGeometry([[0, .08], [.8, .08], [.9, .18], [.95, .34], [.9, .5], [.8, .56], [0, .56]].map(([x, y]) => new T.Vector2(x, y)), seg(40)),
    bumper: new T.TorusGeometry(.95, .15, seg(14), seg(44)), trim: new T.TorusGeometry(.84, .028, 8, seg(44)), band: new T.TorusGeometry(.95, .03, 6, seg(44)),
    cowl: new T.SphereGeometry(.6, seg(24), seg(14), 0, Math.PI * 2, 0, Math.PI / 2), back: RB(1.05, .78, .2, .09, 3), seat: RB(.9, .16, .5, .07, 3),
    wheelT: new T.TorusGeometry(.18, .03, 8, 20), col: new T.CylinderGeometry(.025, .025, .3, 6), lamp: new T.SphereGeometry(.1, 10, 8),
    pole: new T.CylinderGeometry(.035, .035, ceilY - rc * .5, 8), mount: new T.CylinderGeometry(.09, .12, .2, 10), shoe: RB(.24, .07, .24, .03, 2),
  };
  let ii = 0;
  const cars = all.map((p, i) => {
    const g = new T.Group(), body = new T.Group();
    const col = new T.Color(neutral[i % neutral.length]);
    const bodyMat = new T.MeshPhysicalMaterial({ color: col, metalness: .35, roughness: .32, clearcoat: 1, clearcoatRoughness: .08, emissive: col.clone().multiplyScalar(.05) });
    const add = (geo, mat, x, y, z, f) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); f && f(m); body.add(m); return m; };
    add(G.tub, bodyMat, 0, 0, 0);
    add(G.bumper, rubber, 0, .22, 0, m => m.rotation.x = Math.PI / 2);
    add(G.band, chrome, 0, .22, 0, m => { m.rotation.x = Math.PI / 2; m.scale.z = 2.6; });
    add(G.trim, chrome, 0, .565, 0, m => m.rotation.x = Math.PI / 2);
    add(G.cowl, bodyMat, 0, .56, .42, m => m.scale.set(1.05, .6, .62));
    add(G.back, bodyMat, 0, .95, -.52);
    add(G.seat, seatMat, 0, .66, -.22);
    add(G.wheelT, rubber, 0, .98, .2, m => m.rotation.x = -.95);
    add(G.col, chrome, 0, .84, .26, m => m.rotation.x = .6);
    add(G.lamp, lightMat, -.46, .38, .82, m => m.scale.set(1, 1, .6)); add(G.lamp, lightMat, .46, .38, .82, m => m.scale.set(1, 1, .6));
    add(G.lamp, tailMat, -.5, .4, -.8, m => m.scale.set(.8, .8, .5)); add(G.lamp, tailMat, .5, .4, -.8, m => m.scale.set(.8, .8, .5));
    body.scale.set(rc, rc, rc * 1.22); g.add(body);
    const mount = new T.Mesh(G.mount, chrome); mount.position.set(0, rc * .98, -rc * .95); g.add(mount);
    const pole = new T.Mesh(G.pole, chrome); pole.position.set(0, (ceilY + rc * .5) / 2 + rc * .05, -rc * .95); g.add(pole);
    const shoe = new T.Mesh(G.shoe, rubber); shoe.position.set(0, ceilY - .02, -rc * .95); g.add(shoe);
    shade(g);
    const spark = new T.Sprite(new T.SpriteMaterial({ map: sparkTex, color: hdr(0xbfe8ff, 3.5), ...AB })); spark.position.set(0, ceilY - .05, -rc * .95); spark.scale.setScalar(.6); g.add(spark);
    const glow = new T.Mesh(new T.PlaneGeometry(rc * 3.6, rc * 4.4), new T.MeshBasicMaterial({ map: glowTex, color: hdr(col, 1.8), ...AB, opacity: .6 })); glow.rotation.x = -Math.PI / 2; glow.position.y = .035; g.add(glow);
    const face = new T.Sprite(new T.SpriteMaterial({ map: tex(faceCanvas(p.m.name, '#ffffff', imgs[ii++], p.m.name)), transparent: true })); face.scale.set(rc * 1.7, rc * 1.7 * 300 / 256, 1); face.position.set(0, rc * 1.75, -rc * .15); g.add(face);
    const flag = new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas(p.team.name, { size: 80, w: 768, h: 150, glow: p.team.bar, weight: 800 })), transparent: true, depthTest: false, opacity: 0 }));
    flag.scale.set(rc * 3.2, rc * .62, 1); flag.position.set(0, rc * 2.75, 0); g.add(flag);
    // entrada por los laterales
    const side = i % 2 ? 1 : -1;
    const pos = new T.Vector3(side * (RX + 4), 0, (Math.random() - .5) * RZ * 1.4);
    g.position.copy(pos); scene.add(g);
    const a = Math.random() * Math.PI * 2;
    return { p, g, bodyMat, spark, glow, flag, face, pos, vel: new T.Vector3(-side * 7, 0, Math.sin(a) * 3), mode: 'enter', heading: side > 0 ? -Math.PI / 2 : Math.PI / 2, bump: 0, squash: 0, target: null, slot: null, tRam: 0, entered: false, delay: .12 * i };
  });

  // ---- plazas de aparcamiento por equipo ----
  const nT = teams.length, axisX = !narrow;
  const zoneCenters = teams.map((_, i) => axisX ? new T.Vector3(-RX + (i + .5) * (2 * RX / nT), 0, 0) : new T.Vector3(0, 0, -RZ + (i + .5) * (2 * RZ / nT)));
  teams.forEach((t, ti) => {
    const mem = cars.filter(c => c.p.ti === ti), n = mem.length, zc = zoneCenters[ti];
    const zW = axisX ? 2 * RX / nT : 2 * RX, zD = axisX ? 2 * RZ : 2 * RZ / nT;
    const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * (zW / zD))))), rows = Math.ceil(n / cols);
    const sx = Math.min(rc * 2.6, (zW - rc * 1.5) / Math.max(1, cols - 1 || 1)), sz = Math.min(rc * 3.1, (zD - rc * 2) / Math.max(1, rows - 1 || 1));
    mem.forEach((c, k) => {
      const r = Math.floor(k / cols), inRow = Math.min(cols, n - r * cols), cc = k % cols;
      const x = zc.x + (cc - (inRow - 1) / 2) * (cols > 1 ? sx : 0), z = zc.z + (r - (rows - 1) / 2) * (rows > 1 ? sz : 0);
      c.slot = new T.Vector3(x, 0, z);
      c.slotHeading = nT === 1 ? 0 : axisX ? (zc.x < 0 ? Math.PI / 2 : -Math.PI / 2) : (zc.z < 0 ? 0 : Math.PI);
    });
  });
  const teamSigns = teams.map((t, ti) => {
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas(t.name, { size: 120, w: 1024, h: 200, glow: t.bar, grad: ['#ffffff', '#fff2b0', t.bar] })), transparent: true, opacity: 0, depthTest: false }));
    const zc = zoneCenters[ti]; s.position.set(zc.x, 3.4, zc.z - (axisX ? RZ * .55 : 0)); s.scale.set(narrow ? 4 : 5.4, narrow ? .8 : 1.05, 1); scene.add(s); return s;
  });
  const vsS = nT > 1 && !win ? new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas('VS', { size: 200, w: 512, h: 280, italic: true, grad: ['#fff', '#ffd23f', '#ff2a6a'], glow: '#ff2a6a' })), transparent: true, opacity: 0, depthTest: false })) : null;
  if (vsS){ vsS.position.set(0, 2.6, 0); vsS.scale.set(2.6, 1.42, 1); scene.add(vsS); }

  // ---- efectos ----
  const fxList = [];
  function sparks(pos, col, n = 60, sp = 7){
    const p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++){ p.set([pos.x, pos.y, pos.z], i * 3); const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2; v.push(Math.cos(a) * sp * (.4 + Math.random()), Math.sin(e) * sp * (.5 + Math.random()), Math.sin(a) * sp * (.4 + Math.random())); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ color: hdr(col, 3.2), size: .24, map: sparkTex, ...AB })); scene.add(pts);
    fxList.push({ o: pts, t: 0, d: .7, u: (o, k, dt) => { const a = o.geometry.attributes.position.array; for (let i = 0; i < n; i++){ a[i*3] += v[i*3] * dt; a[i*3+1] += v[i*3+1] * dt; a[i*3+2] += v[i*3+2] * dt; v[i*3+1] -= 18 * dt; if (a[i*3+1] < .03 && v[i*3+1] < 0){ a[i*3+1] = .03; v[i*3+1] *= -.35; } } o.geometry.attributes.position.needsUpdate = true; o.material.opacity = 1 - k; } });
  }
  const WORDS = ['¡PUM!', '¡CATAPUM!', '¡CRASH!', '¡ZASCA!', '¡BOOM!', '¡MEEEC!'];
  function pum(pos, big){
    const s = popSprite(ctx, WORDS[rand(WORDS.length)], pos.clone().setY(rc * 3.2), { h: big ? 1.9 : 1.2 });
    fxList.push({ o: s, t: 0, d: .7, u: (o, k) => { const e = k < .25 ? k / .25 : 1; o.scale.set(o.userData.h * 3.5 * (1.4 - .4 * e), o.userData.h * (1.4 - .4 * e), 1); o.position.y += .02; o.material.opacity = 1 - Math.max(0, (k - .6) / .4); } });
  }
  function fireworks(){
    const pos = new T.Vector3((Math.random() - .5) * RX * 2, 8 + Math.random() * 4, -RZ - 4 - Math.random() * 6);
    sparks(pos, new T.Color().setHSL(Math.random(), 1, .6), 140, 9); S && S.boom(false);
  }

  // ---- línea de tiempo ----
  const beat = A.beat / 1000;
  const tCars = 1.4, tAssign = win ? 99 : 4.6, step = Math.max(.7, Math.min(1.05, 7 / N));
  const order = []; const per = Math.max(...teams.map(t => t.members.length));
  for (let r = 0; r < per; r++) teams.forEach((t, ti) => { const c = cars.find(x => x.p.ti === ti && x.p.k === r); if (c) order.push(c); });
  order.forEach((c, i) => c.tAssign = tAssign + i * step);
  let tDone = win ? 6.2 : null, doneFired = false, shake = 0, lastPum = 0, lastFw = 0;
  later(() => { layer.classList.remove('intro'); layer.classList.add('up'); }, 1800);
  const finish = et => { if (doneFired) return; doneFired = true; tDone = et; X.done(); S && S.chord(); later(X.close, A.hold || 4200); };
  if (win){ cars.forEach(c => { c.assigned = true; c.bodyMat.color.set(c.p.team.bar); c.flag.material.opacity = 1; }); later(() => cars.forEach(c => c.mode = 'park'), 4200); }

  const tmp = new T.Vector3(), tmp2 = new T.Vector3();
  function assign(c, et){
    if (c.assigned) return; c.assigned = true; c.mode = 'park'; c.tAssigned = et;
    const tc = new T.Color(c.p.team.bar);
    c.bodyMat.color.copy(tc); c.bodyMat.emissive.copy(tc).multiplyScalar(.25);
    sparks(c.g.position.clone().setY(1), tc, 90, 8); pum(c.g.position, true); shake = Math.max(shake, .5); S && S.boom(true);
    if (teamSigns[c.p.ti].material.opacity < .05) teamSigns[c.p.ti].userData.on = et;
  }

  ctx.start((et, dt) => {
    // cámara: grúa desde arriba al principio, temblor en choques, órbita al final
    const kIn = Math.min(1, et / 1.8), e = 1 - Math.pow(1 - kIn, 3);
    const orbit = tDone ? Math.min(1, (et - tDone) / 1.5) : 0;
    const ang = (1 - e) * -1.1 + Math.sin((et - (tDone || 0)) * .45) * .38 * orbit;
    cam.position.set(Math.sin(ang) * camD.z, camD.y + (1 - e) * 14 - orbit * 1.5, Math.cos(ang) * camD.z);
    shake *= Math.pow(.02, dt);
    cam.position.x += (Math.random() - .5) * shake; cam.position.y += (Math.random() - .5) * shake;
    cam.lookAt(look);

    // letrero que parpadea al encenderse
    const on = et > .5 && !(et < 1.2 && Math.random() < .35);
    if (on !== drawSign.last){ drawSign(l1, l2, on); signT.needsUpdate = true; drawSign.last = on; }
    if (hero){ const k = Math.min(1, Math.max(0, (et - .9) / .5)); hero.scale.setScalar(k < 1 ? Math.max(.01, k * (1 + Math.sin(k * Math.PI) * .25)) : 1 + Math.sin(et * 2) * .02); hero.rotation.z = Math.sin(et * 1.6) * .04; }
    const bb = Math.floor(et / (beat || .37));
    for (let i = 0; i < bulbN; i++){ const lit = ((bb + i) % 3) !== 0; tc.setHex(lit ? bulbCols[i % 5] : 0x222233).multiplyScalar(lit ? 3.4 : 1); bulbs.setColorAt(i, tc); }
    bulbs.instanceColor.needsUpdate = true;
    for (let i = 0; i < rimN * 2; i++){ const j = i >> 1, lit = ((Math.floor(et * 6) + j) % 4) < 2; tc.setHex(lit ? bulbCols[(j >> 1) % 5] : 0x2a2038).multiplyScalar(lit ? 3 : 1); rimB.setColorAt(i, tc); }
    rimB.instanceColor.needsUpdate = true;
    wheel.rotation.z = et * .12; cabins.forEach(c => c.rotation.z = -wheel.rotation.z);
    pls.forEach((l, i) => l.intensity = 70 + 50 * Math.sin(et * 3 + i * 1.7));
    flashL.intensity *= Math.pow(.0005, dt);

    // física de los coches
    for (const c of cars){
      if (et < tCars + c.delay) continue;
      if (!c.entered){ c.entered = true; c.mode = win ? 'donut' : 'wander'; }
      if (c.mode === 'parked') continue;
      if (!c.assigned && c.tAssign && et >= c.tAssign && c.mode !== 'ram'){
        c.mode = 'ram'; c.tRam = et;
        const pool = cars.filter(o => o !== c && o.mode !== 'parked' && o.entered);
        c.target = pool.length ? pool.reduce((b, o) => o.g.position.distanceTo(c.g.position) < b.g.position.distanceTo(c.g.position) ? o : b) : null;
        if (!c.target) assign(c, et);
        pum(c.g.position, false);
      }
      if (c.mode === 'ram' && et - c.tRam > 1.4) assign(c, et);
      let desired = null, spd = 6.5;
      if (c.mode === 'wander'){
        const sp = c.vel.length(); if (sp < 5.5) c.vel.multiplyScalar(5.5 / Math.max(.1, sp)); if (sp > 8) c.vel.multiplyScalar(8 / sp);
        c.vel.applyAxisAngle(new T.Vector3(0, 1, 0), (Math.random() - .5) * dt * 2.2);
      } else if (c.mode === 'ram' && c.target){ desired = tmp.copy(c.target.g.position).sub(c.g.position).setY(0).normalize().multiplyScalar(12); }
      else if (c.mode === 'donut'){ const a = et * 1.4 + c.p.k * (Math.PI * 2 / cars.length); desired = tmp.set(Math.cos(a) * RX * .5 - c.g.position.x, 0, Math.sin(a) * RZ * .5 - c.g.position.z).multiplyScalar(2.2); }
      else if (c.mode === 'park'){
        tmp.copy(c.slot).sub(c.g.position).setY(0); const d = tmp.length();
        if (d < .12){ c.mode = 'parked'; c.g.position.copy(c.slot); c.vel.set(0, 0, 0); continue; }
        desired = tmp.normalize().multiplyScalar(Math.min(9, d * 3.2 + .6));
      }
      if (desired) c.vel.lerp(desired, Math.min(1, dt * (c.mode === 'park' ? 6 : 4)));
      c.g.position.addScaledVector(c.vel, dt);
      // paredes
      if (!c.inside && Math.abs(c.g.position.x) < RX - rc) c.inside = true;
      if (c.inside){
        if (c.g.position.x < -RX + rc){ c.g.position.x = -RX + rc; c.vel.x = Math.abs(c.vel.x); c.bump = 1; }
        if (c.g.position.x > RX - rc){ c.g.position.x = RX - rc; c.vel.x = -Math.abs(c.vel.x); c.bump = 1; }
      }
      if (c.g.position.z < -RZ + rc){ c.g.position.z = -RZ + rc; c.vel.z = Math.abs(c.vel.z); c.bump = 1; }
      if (c.g.position.z > RZ - rc){ c.g.position.z = RZ - rc; c.vel.z = -Math.abs(c.vel.z); c.bump = 1; }
    }
    // choques entre coches
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++){
      const a = cars[i], b = cars[j]; if (!a.entered || !b.entered) continue;
      tmp.copy(b.g.position).sub(a.g.position).setY(0); const d = tmp.length(), min = rc * 2.05;
      if (d >= min || d < 1e-4) continue;
      const nrm = tmp.multiplyScalar(1 / d), aS = a.mode === 'parked', bS = b.mode === 'parked';
      if (aS && bS) continue;
      const over = min - d;
      if (aS) b.g.position.addScaledVector(nrm, over); else if (bS) a.g.position.addScaledVector(nrm, -over); else { a.g.position.addScaledVector(nrm, -over / 2); b.g.position.addScaledVector(nrm, over / 2); }
      const rel = tmp2.copy(a.vel).sub(b.vel).dot(nrm);
      if (rel > 0){
        const imp = rel * 1.05;
        if (aS) b.vel.addScaledVector(nrm, imp * 2); else if (bS) a.vel.addScaledVector(nrm, -imp * 2);
        else { a.vel.addScaledVector(nrm, -imp); b.vel.addScaledVector(nrm, imp); }
        a.bump = b.bump = 1;
        const mid = a.g.position.clone().add(b.g.position).multiplyScalar(.5).setY(rc * .5);
        if (rel > 2.5 && et - lastPum > .14){ lastPum = et; sparks(mid, 0xfff2b0, 40, 6); flashL.position.copy(mid).setY(1.4); flashL.intensity = 140; S && S.zap(180 + rand(200)); if (Math.random() < .5) pum(mid, false); shake = Math.max(shake, .18); }
        if (a.mode === 'ram' && (a.target === b || rel > 3)) assign(a, et);
        if (b.mode === 'ram' && (b.target === a || rel > 3)) assign(b, et);
      }
    }
    // aspecto de cada coche
    for (const c of cars){
      if (!c.entered) { c.g.visible = false; continue; } c.g.visible = true;
      const target = c.mode === 'parked' ? c.slotHeading : (c.vel.lengthSq() > .2 ? Math.atan2(c.vel.x, c.vel.z) : c.heading);
      let dh = target - c.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.heading += dh * Math.min(1, dt * 8);
      c.g.rotation.y = c.heading;
      c.bump *= Math.pow(.004, dt);
      const beatBounce = c.mode === 'parked' && tDone ? Math.max(0, Math.sin((et / (beat * 2)) * Math.PI * 2 + c.p.k)) * .18 : 0;
      c.g.position.y = c.bump * .35 + beatBounce;
      c.g.scale.set(1 + c.bump * .12, 1 - c.bump * .15, 1 + c.bump * .12);
      c.g.rotation.z = Math.sin(et * 22 + c.p.k) * c.bump * .08;
      c.spark.material.opacity = c.vel.lengthSq() > 4 ? (Math.random() < .6 ? 1 : .2) : .15;
      c.spark.scale.setScalar(.3 + Math.random() * .5);
      c.glow.material.color.copy(c.bodyMat.color).multiplyScalar(1.8);
      if (c.assigned) c.flag.material.opacity = Math.min(1, c.flag.material.opacity + dt * 3);
    }
    teamSigns.forEach((s, i) => { if (s.userData.on != null || win || tDone) s.material.opacity = Math.min(1, s.material.opacity + dt * 2); s.position.y = 3.4 + Math.sin(et * 2 + i) * .08; });
    if (vsS && teamSigns.some(s => s.material.opacity > .5)){ vsS.material.opacity = Math.min(1, vsS.material.opacity + dt * 2); vsS.material.rotation = Math.sin(et * 3) * .1; const k = 1 + Math.sin(et * 8) * .05; vsS.scale.set(2.6 * k, 1.42 * k, 1); }
    if (!doneFired && cars.every(c => c.mode === 'parked')) finish(et);
    if (win && tDone && et - lastFw > .45){ lastFw = et; fireworks(); }
    for (let i = fxList.length - 1; i >= 0; i--){ const f = fxList[i]; f.t += dt; const k = Math.min(1, f.t / f.d); f.u(f.o, k, dt); if (k >= 1){ scene.remove(f.o); f.o.geometry && f.o.geometry.dispose(); f.o.material.map && f.o.material.map !== sparkTex && f.o.material.map.dispose(); f.o.material.dispose(); fxList.splice(i, 1); } }
  });
  const st = _vs.fxStop; _vs.fxStop = () => { S && S.close(); st(); };
}
