// =====================================================================
//  APPROVED · capa WebGL
//  - fondo: el despacho en 3D (paneles de madera, diplomas, luz cálida con polvo en suspensión)
//  - delante: papelitos y gotas de tinta que saltan en cada sellazo
//  - easter egg: Álvaro se va en moto hacia el sol (escena 3D completa)
//  Todo procedural; si no hay WebGL, la animación sigue con su versión CSS.
// =====================================================================

export async function setupGL(ctx, root) {
  let base = null;
  try { base = await ctx.three({ clear: 0x2a1208, fov: 38, bloom: [.45, .7, .86] }); } catch (e) { base = null; }
  if (!base) return null;
  const { T, scene, cam, tex } = base;
  root.classList.add('ap-gl');

  // ---------- utilidades ----------
  const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  const soft = tex(cv(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,240,210,.55)'); gr.addColorStop(1, 'rgba(255,220,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }));
  const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };

  // ---------- el despacho ----------
  const office = new T.Group(); scene.add(office);
  const woodC = cv(1024, 512, (g, w, h) => {
    const pw = 86;
    for (let x = 0, i = 0; x < w; x += pw, i++) {
      const l = 30 + (i * 37 % 9);
      g.fillStyle = `hsl(${20 + (i * 13 % 6)}, ${58 + (i * 7 % 10)}%, ${l}%)`; g.fillRect(x, 0, pw, h);
      for (let k = 0; k < 26; k++) {   // vetas
        g.strokeStyle = `rgba(40,14,4,${.08 + Math.random() * .14})`; g.lineWidth = .6 + Math.random() * 1.6; g.beginPath();
        const ox = x + Math.random() * pw; g.moveTo(ox, 0);
        for (let y = 0; y <= h; y += 16) g.lineTo(ox + Math.sin(y * .02 + k) * 3 + Math.sin(y * .007 + i) * 5, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(20,6,2,.75)'; g.fillRect(x, 0, 3, h);
      g.fillStyle = 'rgba(255,200,150,.10)'; g.fillRect(x + 3, 0, 2, h);
    }
  });
  const woodT = tex(woodC); woodT.wrapS = T.RepeatWrapping; woodT.repeat.set(2.4, 1);
  const wallM = new T.MeshStandardMaterial({ map: woodT, roughness: .65, metalness: 0 });
  const wall = new T.Mesh(new T.PlaneGeometry(30, 12), wallM); wall.position.set(0, 1, -2); office.add(wall);
  const darkWood = new T.MeshStandardMaterial({ color: 0x4a1e0a, roughness: .55 }), railWood = new T.MeshStandardMaterial({ color: 0x9a552b, roughness: .4 });
  const lower = new T.Mesh(new T.PlaneGeometry(30, 3), darkWood); lower.position.set(0, -3.4, -1.98); office.add(lower);
  const rail = new T.Mesh(new T.BoxGeometry(30, .22, .3), railWood); rail.position.set(0, -1.85, -1.85); office.add(rail);
  // diplomas con marco dorado
  const gold = new T.MeshStandardMaterial({ color: 0xc9a24e, metalness: .85, roughness: .3, emissive: 0x2a1a04 });
  const dipT = tex(cv(256, 320, (g) => {
    g.fillStyle = '#f3e8cc'; g.fillRect(0, 0, 256, 320);
    g.strokeStyle = 'rgba(120,80,30,.6)'; g.lineWidth = 3; g.strokeRect(14, 14, 228, 292);
    g.fillStyle = 'rgba(90,60,20,.55)'; for (let i = 0; i < 6; i++) g.fillRect(48, 60 + i * 22, 160 - (i % 2) * 40, 6);
    g.strokeStyle = 'rgba(70,110,40,.7)'; g.lineWidth = 6; g.beginPath(); g.arc(128, 236, 44, Math.PI * .65, Math.PI * 2.35); g.stroke();
    g.fillStyle = '#d6336c'; g.beginPath(); g.arc(128, 236, 22, 0, 7); g.fill();
  }));
  [[-6.4, 3.3], [-4.2, 3.3], [6.2, 3.3]].forEach(([x, y]) => {
    const f = new T.Group(); f.position.set(x, y, -1.9);
    const paper = new T.Mesh(new T.PlaneGeometry(1.4, 1.75), new T.MeshStandardMaterial({ map: dipT, roughness: .9 })); paper.position.z = .02; f.add(paper);
    [[0, .95, 1.66, .16], [0, -.95, 1.66, .16], [-.78, 0, .16, 2.06], [.78, 0, .16, 2.06]].forEach(([bx, by, bw, bh]) => { const b = new T.Mesh(new T.BoxGeometry(bw, bh, .12), gold); b.position.set(bx, by, .05); f.add(b); });
    office.add(f);
  });
  // luz
  scene.add(new T.HemisphereLight(0xffd9b0, 0x2a0e04, .55));
  const key = new T.SpotLight(0xffc48a, 2.2, 40, .62, .55, 1.2); key.position.set(-3, 7, 6); key.target.position.set(0, 1, -2); scene.add(key, key.target);
  const fill = new T.PointLight(0xff8a4a, .6, 30); fill.position.set(6, -1, 4); scene.add(fill);
  // haz de luz y polvo en suspensión
  const beam = new T.Mesh(new T.PlaneGeometry(4, 16), new T.MeshBasicMaterial({ map: tex(cv(64, 256, (g) => { const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,220,170,0)'); gr.addColorStop(.5, 'rgba(255,220,170,.22)'); gr.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.3, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-in'; g.fillStyle = v; g.fillRect(0, 0, 64, 256); })), ...AB, opacity: .8 }));
  beam.position.set(-1.6, 2.2, -1); beam.rotation.z = -.5; office.add(beam);
  const DN = 260, dpos = new Float32Array(DN * 3), dsp = [];
  for (let i = 0; i < DN; i++) { dpos.set([(Math.random() - .5) * 14, (Math.random() - .5) * 9 + 1, Math.random() * 4 - 1.5], i * 3); dsp.push(Math.random() * 6.28); }
  const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dpos, 3));
  const dust = new T.Points(dg, new T.PointsMaterial({ map: soft, size: .09, color: 0xffd6a0, ...AB, opacity: .55 })); office.add(dust);

  // ---------- capa delantera: papelitos y tinta ----------
  const fcv = document.createElement('canvas'); fcv.className = 'ap-glfx'; root.appendChild(fcv);
  let fr = null;
  try { fr = new T.WebGLRenderer({ canvas: fcv, alpha: true, antialias: true }); } catch (e) { fr = null; fcv.remove(); }
  const fscene = new T.Scene(), fcam = new T.PerspectiveCamera(50, 1, .1, 100); fcam.position.z = 10;
  fscene.add(new T.AmbientLight(0xffffff, .75)); const fl = new T.DirectionalLight(0xffffff, .6); fl.position.set(2, 4, 6); fscene.add(fl);
  const paperG = new T.PlaneGeometry(.2, .26), dropG = new T.CircleGeometry(.06, 10);
  const parts = [];
  let fW = 0, fH = 0, fRaf = 0, fPrev = 0;
  function fSize() { fW = root.clientWidth; fH = root.clientHeight; if (!fr) return; fr.setPixelRatio(Math.min(2, devicePixelRatio || 1)); fr.setSize(fW, fH, false); fcam.aspect = fW / Math.max(1, fH); fcam.updateProjectionMatrix(); }
  fSize(); addEventListener('resize', fSize);
  const toWorld = (px, py) => { const vh = 2 * Math.tan(T.MathUtils.degToRad(25)) * 10, r = root.getBoundingClientRect(); return new T.Vector3(((px - r.left) / fW - .5) * vh * fcam.aspect, (.5 - (py - r.top) / fH) * vh, 0); };
  function fLoop(now) {
    const dt = Math.min(.05, (now - fPrev) / 1000 || .016); fPrev = now;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      if (p.t > p.life) { fscene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); continue; }
      p.v.y -= p.g * dt; p.v.multiplyScalar(1 - p.drag * dt); p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += p.w.x * dt; p.m.rotation.y += p.w.y * dt; p.m.rotation.z += p.w.z * dt;
      p.m.material.opacity = Math.min(1, (p.life - p.t) / .35);
    }
    fr.render(fscene, fcam);
    fRaf = parts.length ? requestAnimationFrame(fLoop) : 0;
    if (!parts.length) fr.clear();
  }
  // estallido en un punto de la pantalla: kind 'stamp' | 'ban' | 'gold'
  function burst(px, py, kind, ink) {
    if (!fr) return;
    const P = toWorld(px, py), big = kind === 'ban', n = kind === 'gold' ? 90 : big ? 70 : 16;
    const inkC = new T.Color(ink || '#e2336f');
    for (let i = 0; i < n; i++) {
      const isDrop = kind !== 'gold' && i % 3 === 0;
      const col = kind === 'gold' ? new T.Color().setHSL(.1 + Math.random() * .04, .85, .55 + Math.random() * .2) : isDrop ? inkC : new T.Color(0xfffdf6).lerp(new T.Color(0xe9dfc8), Math.random());
      const m = new T.Mesh(isDrop ? dropG : paperG, new T.MeshLambertMaterial({ color: col, side: T.DoubleSide, transparent: true }));
      m.position.copy(P).add(new T.Vector3((Math.random() - .5) * .6, (Math.random() - .5) * .4, Math.random() * .5));
      const s = kind === 'gold' ? .5 + Math.random() * .6 : big ? .7 + Math.random() * 1.1 : .45 + Math.random() * .5; m.scale.setScalar(s);
      const a = Math.random() * Math.PI * 2, sp = kind === 'gold' ? 4 + Math.random() * 7 : big ? 5 + Math.random() * 9 : 2 + Math.random() * 3.5;
      parts.push({ m, t: 0, life: (kind === 'gold' ? 2.6 : big ? 2 : 1.1) + Math.random() * .6, g: kind === 'gold' ? 5 : isDrop ? 14 : 7, drag: isDrop ? .6 : 1.8,
        v: new T.Vector3(Math.cos(a) * sp, Math.sin(a) * sp * .8 + (kind === 'gold' ? 4 : 2.5), (Math.random() - .3) * sp),
        w: new T.Vector3((Math.random() - .5) * 14, (Math.random() - .5) * 14, (Math.random() - .5) * 10) });
      fscene.add(m);
    }
    if (!fRaf) { fPrev = performance.now(); fRaf = requestAnimationFrame(fLoop); }
  }

  // ---------- el easter egg: carretera al atardecer ----------
  let mode = 'office', bumpK = 0, egg = null;
  const mouse = { x: 0, y: 0 };
  const onMove = (e) => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; };
  addEventListener('pointermove', onMove);

  function buildSunset(faceImg) {
    const g = new T.Group(); scene.add(g);
    scene.fog = new T.Fog(0xd8664a, 40, 900);
    // cielo
    const sky = new T.Mesh(new T.SphereGeometry(1500, 32, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; void main(){ float h = vP.y;
        vec3 c = mix(vec3(1.,.78,.45), vec3(.93,.42,.27), smoothstep(.0,.08,h)); c = mix(c, vec3(.55,.2,.38), smoothstep(.07,.25,h)); c = mix(c, vec3(.13,.07,.24), smoothstep(.22,.6,h));
        c = mix(vec3(.35,.12,.18), c, smoothstep(-.05,.0,h));
        float s = max(dot(normalize(vP), normalize(vec3(0.,.035,-1.))), 0.);
        c += vec3(1.,.6,.3) * pow(s, 14.) * .45 + vec3(1.,.9,.7) * pow(s, 260.) * 1.4;
        gl_FragColor = vec4(c, 1.); }` }));
    g.add(sky);
    const sun = new T.Sprite(new T.SpriteMaterial({ map: soft, color: 0xfff0c8, ...AB, fog: false, depthTest: false })); sun.position.set(0, 34, -1000); sun.scale.setScalar(150); sun.material.opacity = .7; g.add(sun);
    const sunCore = new T.Mesh(new T.CircleGeometry(48, 48), new T.MeshBasicMaterial({ color: 0xfff3d0, fog: false })); sunCore.position.set(0, 30, -1010); g.add(sunCore);
    // suelo y carretera
    const ground = new T.Mesh(new T.PlaneGeometry(4000, 4000), new T.MeshStandardMaterial({ color: 0x3a1a22, roughness: 1 })); ground.rotation.x = -Math.PI / 2; g.add(ground);
    const roadT = tex(cv(128, 512, (gg) => { gg.fillStyle = '#2a1c22'; gg.fillRect(0, 0, 128, 512); for (let i = 0; i < 900; i++) { gg.fillStyle = `rgba(255,220,200,${Math.random() * .05})`; gg.fillRect(Math.random() * 128, Math.random() * 512, 2, 2); } gg.fillStyle = '#ffd88a'; gg.fillRect(61, 0, 6, 220); gg.fillStyle = 'rgba(255,240,220,.7)'; gg.fillRect(4, 0, 4, 512); gg.fillRect(120, 0, 4, 512); }));
    roadT.wrapT = T.RepeatWrapping; roadT.repeat.set(1, 160);
    const road = new T.Mesh(new T.PlaneGeometry(8, 3000), new T.MeshStandardMaterial({ map: roadT, roughness: .5, metalness: .1 })); road.rotation.x = -Math.PI / 2; road.position.set(0, .01, -1400); g.add(road);
    // colinas en siluetas
    [[-380, 90, 0x40183a], [-620, 140, 0x5a2048], [-860, 210, 0x7a2c50]].forEach(([z, hgt, col], j) => {
      const pts = []; for (let i = 0; i <= 60; i++) { const x = -1600 + i * 3200 / 60; pts.push(new T.Vector2(x, hgt * (.35 + .65 * Math.abs(Math.sin(i * .37 + j) * Math.cos(i * .13 + j * 2))))); }
      const sh = new T.Shape(); sh.moveTo(-1600, -10); pts.forEach((p) => sh.lineTo(p.x, p.y)); sh.lineTo(1600, -10); sh.closePath();
      const m = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: col, fog: true })); m.position.z = z; g.add(m);
    });
    scene.add(new T.AmbientLight(0xffb48a, .35));
    const sunL = new T.DirectionalLight(0xffb070, 1.6); sunL.position.set(0, 12, -60); g.add(sunL);
    const rim = new T.DirectionalLight(0x9a6cff, .5); rim.position.set(-6, 4, 10); g.add(rim);
    // la moto de Álvaro
    const bike = new T.Group(); g.add(bike);
    const tyre = new T.MeshStandardMaterial({ color: 0x101010, roughness: .9 }), chrome = new T.MeshStandardMaterial({ color: 0xcfd3d8, metalness: .95, roughness: .2 });
    const red = new T.MeshStandardMaterial({ color: 0xb3121b, metalness: .6, roughness: .3 }), blk = new T.MeshStandardMaterial({ color: 0x15151a, metalness: .5, roughness: .5 });
    const shirt = new T.MeshStandardMaterial({ color: 0x5c1426, roughness: .8 }), jeans = new T.MeshStandardMaterial({ color: 0x23262e, roughness: .9 });
    const add = (geo, m, x, y, z, rx) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); if (rx) o.rotation.x = rx; bike.add(o); return o; };
    const wheels = [-.78, .76].map((z) => { const w = add(new T.TorusGeometry(.34, .12, 12, 28), tyre, 0, .46, z); w.rotation.y = Math.PI / 2; add(new T.CylinderGeometry(.2, .2, .05, 16), chrome, 0, .46, z).rotation.z = Math.PI / 2; return w; });
    add(new T.BoxGeometry(.24, .26, 1.25), blk, 0, .72, 0);
    add(new T.BoxGeometry(.46, .32, .64), red, 0, .99, -.22);
    add(new T.BoxGeometry(.36, .12, .72), blk, 0, .99, .42);
    add(new T.BoxGeometry(.3, .2, .5), red, 0, .87, .82, .3);
    add(new T.CylinderGeometry(.04, .04, .8, 8), chrome, 0, .9, -.66, -.35);
    add(new T.BoxGeometry(.86, .05, .05), blk, 0, 1.28, -.6);
    add(new T.CylinderGeometry(.06, .07, .7, 8), chrome, .2, .6, .45, Math.PI / 2 - .2);
    add(new T.BoxGeometry(.52, .62, .3), shirt, 0, 1.52, .12, -.55);
    [-.21, .21].forEach((x) => { add(new T.BoxGeometry(.17, .17, .62), jeans, x, 1.06, .2); add(new T.BoxGeometry(.13, .13, .62), shirt, x * 1.6, 1.46, -.3, .5); });
    const tail = new T.Sprite(new T.SpriteMaterial({ map: soft, color: 0xff2030, ...AB })); tail.position.set(0, .95, 1.08); tail.scale.setScalar(.7); bike.add(tail);
    const faceC = cv(256, 256, (gg) => { gg.save(); gg.beginPath(); gg.arc(128, 128, 116, 0, 7); gg.clip(); gg.fillStyle = '#222'; gg.fillRect(0, 0, 256, 256); if (faceImg) gg.drawImage(faceImg, 118, 48, 202, 202, 12, 12, 232, 232); gg.restore(); gg.lineWidth = 10; gg.strokeStyle = '#ff7a1a'; gg.beginPath(); gg.arc(128, 128, 116, 0, 7); gg.stroke(); });
    const head = new T.Sprite(new T.SpriteMaterial({ map: tex(faceC) })); head.scale.setScalar(.9); head.position.set(0, 2.22, -.05); bike.add(head);
    const shadow = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .4, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(.7, 1.6, 1); shadow.position.set(0, .02, 0); bike.add(shadow);
    // polvo de la rueda trasera
    const PN = 80, ppos = new Float32Array(PN * 3).fill(-999), pa = new Float32Array(PN).map(() => Math.random());
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(ppos, 3));
    const puffs = new T.Points(pg, new T.PointsMaterial({ map: soft, size: .9, color: 0xffc89a, transparent: true, opacity: .35, depthWrite: false })); puffs.frustumCulled = false; g.add(puffs);
    return { g, bike, wheels, puffs, ppos, pa, PN };
  }

  // Álvaro se va: devuelve una promesa que se resuelve cuando ya es un puntito en el sol
  function alvaro(faceImg) {
    office.visible = false; scene.fog = null;
    egg = { t: 0, ...buildSunset(faceImg) };
    mode = 'alvaro';
  }

  // ---------- bucle del fondo ----------
  let t = 0;
  base.start((et, dt) => {
    t += dt;
    if (mode === 'office') {
      // deriva lenta de cámara + parallax con el ratón + golpe del sello
      const bx = (Math.random() - .5) * bumpK * .12, by = (Math.random() - .5) * bumpK * .12; bumpK = Math.max(0, bumpK - dt * 4);
      cam.position.set(Math.sin(t * .13) * .35 + mouse.x * .5 + bx, .35 + Math.sin(t * .09) * .15 - mouse.y * .3 + by, 8);
      cam.lookAt(0, .6, -2);
      const p = dg.attributes.position;
      for (let i = 0; i < DN; i++) { let y = p.getY(i) + dt * (.05 + (i % 7) * .012), x = p.getX(i) + Math.sin(t * .5 + dsp[i]) * dt * .06; if (y > 6) y = -3.5; p.setXY(i, x, y); }
      p.needsUpdate = true;
      beam.material.opacity = .65 + Math.sin(t * .7) * .12 + bumpK * .3;
      key.intensity = 2.2 + bumpK * 1.4;
    } else if (egg) {
      egg.t += dt; const k = egg.t;
      // la moto acelera por la carretera hacia el sol
      const z = -(5 * k + 3.4 * k * k), sway = Math.sin(k * 1.7) * .25;
      egg.bike.position.set(sway, 0, z); egg.bike.rotation.z = -Math.cos(k * 1.7) * .08; egg.bike.position.y = Math.sin(k * 24) * .015;
      egg.wheels.forEach((w) => { w.rotation.x -= dt * (20 + k * 10); });
      // polvo
      const p = egg.puffs.geometry.attributes.position;
      for (let i = 0; i < egg.PN; i++) { egg.pa[i] += dt * 1.4; if (egg.pa[i] > 1) { egg.pa[i] -= 1; p.setXYZ(i, sway + (Math.random() - .5) * .5, .25, z + 1.1); } else p.setY(i, p.getY(i) + dt * .5); }
      p.needsUpdate = true;
      // cámara: persecución baja al principio, luego se queda en la carretera y sube mientras se aleja
      // 1) de frente y bajo: se le ve la cara · 2) le pasamos por detrás · 3) nos quedamos en la carretera y se pierde en el sol
      const sm = (a, b) => { const q = Math.min(1, Math.max(0, (k - a) / (b - a))); return q * q * (3 - 2 * q); };
      const B = egg.bike.position, e1 = sm(1.6, 3.4), e2 = sm(3.4, 5.2);
      const front = new T.Vector3(B.x + 3.8, 1.25, B.z - 5.6), behind = new T.Vector3(B.x + 1.5, 1.5, B.z + 6.4);
      if (!egg.still && k >= 3.4) egg.still = behind.clone();
      const still = egg.still ? egg.still.clone().add(new T.Vector3(0, (k - 3.4) * .5, 0)) : behind;
      cam.position.copy(front.lerp(behind, e1).lerp(still, e2));
      const look = new T.Vector3(B.x, 1.7 - e1 * .4, B.z - e1 * 2).lerp(new T.Vector3(0, 30, -1000), e2 * .6);
      cam.lookAt(look);
      if (cam.fov !== 34) { cam.fov = 34; cam.far = 3000; cam.updateProjectionMatrix(); }
    }
  });

  return {
    bump() { bumpK = 1; },
    burst,
    alvaro,
    dispose() {
      removeEventListener('resize', fSize); removeEventListener('pointermove', onMove);
      cancelAnimationFrame(fRaf); parts.forEach((p) => fscene.remove(p.m));
      try { fr && fr.dispose(); fr && fr.forceContextLoss(); } catch (e) { /* nada */ }
      fcv.remove();
    },
  };
}
