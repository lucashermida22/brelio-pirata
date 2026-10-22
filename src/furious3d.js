
  // =====================================================================
  //  FAST & FURIOUS 3D — "el último viaje". Montaje calcado del final de
  //  Furious 7 (desde 1:52): aéreo trasero, miradas entre conductores,
  //  cenital, bifurcación, aéreo amplio, atardecer y fundido a blanco.
  // =====================================================================
  // ---- personajes de la saga (sin fotos: emoji + nombre) ----
  let ffEggHook = null;
  const FF_CHAR = { Toretto: '👨🏻‍🦲', Paul: '👱🏼‍♂️', Letty: '👩🏻', Roman: '😎', Tej: '🧑🏾‍🔧', Han: '🧑🏻', Mia: '👩🏼', Hobbs: '👨🏾‍🦲', Shaw: '🧔🏻', Gisele: '👩🏽' };
  const FF_PHOTO = { Toretto: '__FF_TORETTO__', Paul: '__FF_PAUL__' }, ffImgs = {};
  function ffCharCanvas(name, color){
    const c = document.createElement('canvas'); c.width = 256; c.height = 300; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 100, 10, 128, 128, 120); gr.addColorStop(0, '#5a4a3c'); gr.addColorStop(1, '#16120f');
    g.beginPath(); g.arc(128, 128, 112, 0, 7); g.fillStyle = gr; g.fill();
    g.font = '150px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; if (ffImgs[name]){ g.save(); g.beginPath(); g.arc(128, 128, 112, 0, 7); g.clip(); g.drawImage(ffImgs[name], 16, 16, 224, 224); g.restore(); } else g.fillText(FF_CHAR[name] || '🏎️', 128, 142);
    g.lineWidth = 12; g.strokeStyle = color; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
    g.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif'; const w = Math.min(250, g.measureText(name).width + 26); rrect(g, 128 - w / 2, 252, w, 44, 14); g.fillStyle = '#120612'; g.fill(); g.fillStyle = '#fff'; g.fillText(name, 128, 275, 230);
    return c;
  }
  async function playFurious(teams, A, win){
    const layer = $('#vsLayer'), fx = $('#vsFx');
    const imgs = await Promise.all([loadImg($('#vsHero').dataset.orig || $('#vsHero').src), ...teams.flatMap(t => t.members.map(m => loadImg(photoFor(m.name))))]);
    if (!vsOpen) return;
    const heroImg = imgs.shift();
    const [matiImg, crocImg, torImg, paulImg] = await Promise.all([loadImg($('#matiHero').src), loadImg($('#matiCroc').src), loadImg(FF_PHOTO.Toretto), loadImg(FF_PHOTO.Paul)]);
    ffImgs.Toretto = torImg; ffImgs.Paul = paulImg;
    if (!vsOpen) return;
    const ctx = glInit({ clear: 0xe9b07a, fov: 38, bloom: [.7, .65, .84] });
    if (!ctx) return;
    const { T, scene, cam, tex, renderer } = ctx, W = ctx.W, H = ctx.H, narrow = W / H < .8;
    cam.far = 4000; cam.updateProjectionMatrix();
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };

    // ---- bandas de cine + rótulos ----
    const ov = document.createElement('div'); ov.className = 'ff-ov';
    ov.innerHTML = '<div class="ff-bar t"></div><div class="ff-bar b"></div><div class="ff-cap ff-title"></div><div class="ff-cap ff-mid"></div><div class="ff-cap ff-end"></div><div class="ff-fade"></div><div class="ff-for"></div>';
    fx.appendChild(ov);
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

    // ---- cielo dorado ----
    const sunDir = new T.Vector3(-.3, .075, -1).normalize();
    const sky = new T.Mesh(new T.SphereGeometry(3500, 64, 32), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { sun: { value: sunDir }, glow: { value: 1 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform vec3 sun; uniform float glow; varying vec3 vP;
        void main(){ float h = vP.y; vec3 zen = vec3(.20,.33,.52), mid = vec3(.62,.62,.62), hor = vec3(1.,.70,.42), low = vec3(.80,.46,.28);
          vec3 c = mix(hor, mid, smoothstep(.02, .18, h)); c = mix(c, zen, smoothstep(.16, .6, h)); c = mix(low, c, smoothstep(-.12, .02, h));
          float s = max(dot(normalize(vP), sun), 0.);
          c += vec3(1.,.6,.3) * pow(s, 4.) * .3 * glow + vec3(1.,.82,.55) * pow(s, 60.) * .5 * glow + vec3(1.,.95,.85) * pow(s, 700.) * 1.2 * glow + vec3(1.) * smoothstep(.9993, .9997, s) * 2.;
          gl_FragColor = vec4(c, 1.); }` }));
    scene.add(sky);
    scene.fog = new T.Fog(0xe0a070, 260, 2200);
    scene.add(new T.HemisphereLight(0xffd8b0, 0x30241c, .45));
    const sunL = new T.DirectionalLight(0xffb870, 1.9); sunL.castShadow = true;
    sunL.shadow.mapSize.set(narrow ? 1024 : 2048, narrow ? 1024 : 2048); Object.assign(sunL.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 10, far: 1400 }); sunL.shadow.bias = -.0008;
    scene.add(sunL, sunL.target);

    // ---- terreno con luz rasante "horneada" (relieve marcado) ----
    const TS = 2600, TN = narrow ? 300 : 440;
    const tg = new T.PlaneGeometry(TS, TS, TN, TN); tg.rotateX(-Math.PI / 2); tg.translate(0, 0, -450);
    const P = tg.attributes.position;
    for (let i = 0; i < P.count; i++) P.setY(i, Hgt(P.getX(i), P.getZ(i)));
    tg.computeVertexNormals();
    const N = tg.attributes.normal, cols = new Float32Array(P.count * 3), col = new T.Color(), shade = new T.Color('#3b3346'), warm = new T.Color('#ffcf8a');
    const cGrass = new T.Color('#b88d3f'), cScrub = new T.Color('#5c5f26'), cDark = new T.Color('#3a4019'), cRock = new T.Color('#9a7552'), cSand = new T.Color('#c9a46a');
    for (let i = 0; i < P.count; i++){
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const dif = Math.max(0, N.getX(i) * sunDir.x + N.getY(i) * sunDir.y + N.getZ(i) * sunDir.z);
      const k = fbm(x * .018 + 9, z * .018, 3) * .5 + .5, k2 = nz3(x * .07, 2, z * .07) * .5 + .5;
      col.copy(cGrass).lerp(cScrub, Math.min(1, k * 1.25)).lerp(cDark, Math.max(0, k2 - .45) * 1.4);
      const slope = 1 - N.getY(i); if (slope > .35) col.lerp(cRock, Math.min(1, (slope - .35) * 2.2));
      if (roadDist(x, z) < 8) col.lerp(cSand, .55);
      const lit = .34 + 1.35 * Math.pow(dif, .8);
      col.multiplyScalar(lit); col.lerp(shade, Math.max(0, .55 - dif) * .55); col.lerp(warm, Math.pow(dif, 3) * .25);
      cols.set([col.r, col.g, col.b], i * 3);
    }
    tg.setAttribute('color', new T.BufferAttribute(cols, 3));
    const terrain = new T.Mesh(tg, new T.MeshBasicMaterial({ vertexColors: true })); scene.add(terrain);

    // monte bajo (chaparral) junto a la carretera
    const BN = narrow ? 5000 : 11000;
    const bushes = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), new T.MeshLambertMaterial({ color: 0xffffff }), BN);
    { const d = new T.Object3D(), c = new T.Color();
      for (let i = 0; i < BN; i++){
        const z = 650 - Math.random() * 1750, side = Math.random() < .5 ? -1 : 1, off = 9 + Math.pow(Math.random(), 1.6) * 170;
        const base = z > zF ? xm(z) : xb(rand(n), z), x = base + side * off;
        if (roadDist(x, z) < 8.5) continue;
        const s = .45 + Math.pow(Math.random(), 2) * 1.5;
        d.position.set(x, Hgt(x, z) - s * .12, z); d.scale.set(s, s * (.42 + Math.random() * .25), s); d.rotation.set(0, Math.random() * 6, 0); d.updateMatrix(); bushes.setMatrixAt(i, d.matrix);
        c.setHSL(.15 + Math.random() * .07, .35 + Math.random() * .2, .1 + Math.random() * .09); bushes.setColorAt(i, c);
      } bushes.instanceColor.needsUpdate = true; }
    scene.add(bushes);

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
    const mkRoadTex = lines => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
      g.fillStyle = '#34302e'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 1400; i++){ g.fillStyle = `rgba(${140 + rand(80)},${130 + rand(70)},${120 + rand(60)},.07)`; g.fillRect(rand(256), rand(256), 2, 2); }
      if (lines){ g.fillStyle = '#e6dfcc'; g.fillRect(8, 0, 5, 256); g.fillRect(243, 0, 5, 256); g.fillStyle = '#f2c445'; g.fillRect(124, 0, 4, 256); g.fillRect(130, 0, 4, 256); }
      const t = tex(c); t.wrapT = T.RepeatWrapping; return t; };
    const roadT = mkRoadTex(true), plainT = mkRoadTex(false);
    function strip(cx, z1, z2, wf, segs, map, lift){
      const pos = [], uv = [], idx = [];
      for (let s = 0; s <= segs; s++){
        const z = z1 + (z2 - z1) * s / segs, x = cx(z), w = typeof wf === 'function' ? wf(z) : wf, dz = (z2 - z1) / segs, dx = cx(z + dz) - x, L = Math.hypot(dx, dz), nx = -dz / L, nzv = dx / L;
        pos.push(x - nx * w / 2, ry(z) + lift, z - nzv * w / 2, x + nx * w / 2, ry(z) + lift, z + nzv * w / 2);
        uv.push(0, s * Math.abs(dz) / 16, 1, s * Math.abs(dz) / 16);
        if (s < segs){ const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new T.Mesh(g, new T.MeshStandardMaterial({ map, roughness: .9, metalness: 0 }));
      m.receiveShadow = true; scene.add(m);
    }
    const mainW = Math.max(8.5, n * LANE + 2.6);
    let JL = 6; if (n > 1) while (JL < 120 && xb(1, zF - JL) - xb(0, zF - JL) < 7.6) JL += 1; JL += 4;
    strip(xm, Z0 + 320, win ? -1300 : zF, mainW, 700, roadT, .1);
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
      g.fillStyle = '#f2e6cf'; g.font = '800 86px "Plus Jakarta Sans", system-ui, sans-serif'; g.fillText('BRELIO', 380, 190); g.font = '500 40px Geist, system-ui, sans-serif'; g.fillStyle = '#e8a35a'; g.fillText('presenta: el último viaje', 384, 260);
      const zB = Z0 - 70, xB = xm(zB) + mainW / 2 + 8;
      const board = new T.Group(); board.position.set(xB, ry(zB), zB); board.rotation.y = -.45; scene.add(board);
      const panel = new T.Mesh(new T.PlaneGeometry(12, 6), new T.MeshBasicMaterial({ map: tex(bc), color: 0xd8d0c8, side: T.DoubleSide })); panel.position.y = 7.5; panel.castShadow = true; board.add(panel);
      [-4, 4].forEach(x => { const p = new T.Mesh(new T.CylinderGeometry(.18, .2, 7.5, 8), new T.MeshStandardMaterial({ color: 0x55504a })); p.position.set(x, 3.75, -.2); board.add(p); });
    }

    // ---- coches ----
    const body = new T.BoxGeometry(2, .58, 4.6, 1, 1, 6), cabG = new T.BoxGeometry(1.74, .56, 2.5), wheelG = new T.CylinderGeometry(.43, .43, .34, 18), spoilerG = new T.BoxGeometry(1.9, .07, .42);
    { const p = body.attributes.position; for (let i = 0; i < p.count; i++){ const y = p.getY(i), z = p.getZ(i); if (y > 0 && z < -1.1) p.setY(i, y - .17 * Math.min(1, (-z - 1.1) / 1.2)); if (y > 0 && z > 1.9) p.setY(i, y - .05); } body.computeVertexNormals(); }
    { const p = cabG.attributes.position; for (let i = 0; i < p.count; i++){ if (p.getY(i) > 0){ p.setZ(i, p.getZ(i) * .6 + .28); p.setX(i, p.getX(i) * .88); } } cabG.computeVertexNormals(); }
    wheelG.rotateZ(Math.PI / 2);
    const tyre = new T.MeshStandardMaterial({ color: 0x0e0e0e, roughness: .9 }), rimM = new T.MeshStandardMaterial({ color: 0xbfc4cc, metalness: .9, roughness: .25 });
    const headM = new T.MeshBasicMaterial({ color: 0xfff1cf }), tailM = new T.MeshBasicMaterial({ color: 0xff2020 });
    const PAINT = [0xf2f2f4, 0x2a2c31, 0x8a1a1a, 0x1a3a7a];
    let ii = 0;
    const per = Math.max(...teams.map(t => t.members.length));
    const caps = teams.map(t => rand(t.members.length));
    const cars = teams.flatMap((t, ti) => t.members.map((m, k) => {
      const g = new T.Group();
      const paint = new T.MeshStandardMaterial({ color: win ? PAINT[ti % 4] : 0x9a9ca4, metalness: .6, roughness: .26 });
      const b = new T.Mesh(body, paint); b.position.y = .64; b.castShadow = true; g.add(b);
      const glass = new T.MeshStandardMaterial({ color: 0x141820, metalness: .9, roughness: .08, transparent: true, opacity: .55 });
      const cab = new T.Mesh(cabG, glass); cab.position.set(0, 1.2, .1); cab.castShadow = true; g.add(cab);
      const sp = new T.Mesh(spoilerG, paint); sp.position.set(0, 1.12, 2.1); g.add(sp);
      [[-1, 1.48], [1, 1.48], [-1, -1.48], [1, -1.48]].forEach(([x, z]) => { const w = new T.Mesh(wheelG, tyre); w.position.set(x * .99, .43, z); w.castShadow = true; g.add(w); const r = new T.Mesh(new T.CircleGeometry(.24, 14), rimM); r.position.set(x * 1.17, .43, z); r.rotation.y = x * Math.PI / 2; g.add(r); });
      [-.62, .62].forEach(x => { const h = new T.Mesh(new T.BoxGeometry(.4, .13, .05), headM); h.position.set(x, .7, -2.31); g.add(h); const tl = new T.Mesh(new T.BoxGeometry(.44, .12, .05), tailM); tl.position.set(x, .74, 2.31); g.add(tl); });
      const glowM = new T.MeshBasicMaterial({ color: new T.Color(t.bar), ...AB, opacity: 0 });
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
      return { g, paint, glowM, face, driver, cab, ti, k, m, team: t, fs0, pass, pb, passName, ph: Math.random() * 6.28 };
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
    const bpM = new T.MeshStandardMaterial({ color: 0x5b1aa8, metalness: .75, roughness: .28 }), bkM = new T.MeshStandardMaterial({ color: 0x111114, metalness: .5, roughness: .5 });
    const shirtM = new T.MeshStandardMaterial({ color: 0x161616, roughness: .8 }), pantM = new T.MeshStandardMaterial({ color: 0xdedbd2, roughness: .9 });
    const bWheels = [-.78, .74].map(z => { const w = new T.Mesh(new T.TorusGeometry(.34, .12, 10, 26), tyre); w.rotation.y = Math.PI / 2; w.position.set(0, .46, z); w.castShadow = true; bike.add(w); return w; });
    const bpart = (geo, m, x, y, z, rx) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); if (rx) o.rotation.x = rx; o.castShadow = true; bike.add(o); return o; };
    bpart(new T.BoxGeometry(.24, .26, 1.25), bkM, 0, .72, 0);
    bpart(new T.BoxGeometry(.46, .3, .62), bpM, 0, .98, -.22);
    bpart(new T.BoxGeometry(.36, .12, .7), bkM, 0, .98, .42);
    bpart(new T.BoxGeometry(.3, .2, .5), bpM, 0, .86, .8, .3);
    bpart(new T.CylinderGeometry(.04, .04, .8, 8), rimM, 0, .9, -.66, -.35);
    bpart(new T.BoxGeometry(.86, .05, .05), bkM, 0, 1.28, -.6);
    bpart(new T.SphereGeometry(.12, 12, 8), headM, 0, 1.06, -.86);
    bpart(new T.CylinderGeometry(.06, .07, .7, 8), rimM, .2, .6, .45, Math.PI / 2 - .2);
    bpart(new T.BoxGeometry(.52, .62, .3), shirtM, 0, 1.52, .12, -.55);
    [-.21, .21].forEach(x => { bpart(new T.BoxGeometry(.17, .17, .62), pantM, x, 1.06, .2); bpart(new T.BoxGeometry(.13, .13, .62), shirtM, x * 1.6, 1.46, -.3, .5); });
    { const c = document.createElement('canvas'); c.width = 256; c.height = 300; const g = c.getContext('2d');
      g.save(); g.beginPath(); g.arc(128, 128, 112, 0, 7); g.clip(); g.fillStyle = '#222'; g.fillRect(0, 0, 256, 256); if (matiImg) g.drawImage(matiImg, 200, 8, 170, 170, 16, 16, 224, 224); g.restore();
      g.lineWidth = 12; g.strokeStyle = '#b06cff'; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
      g.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; rrect(g, 68, 252, 120, 44, 14); g.fillStyle = '#2a0a4a'; g.fill(); g.fillStyle = '#fff'; g.fillText('MATI', 128, 275);
      const h = new T.Sprite(new T.SpriteMaterial({ map: tex(c), transparent: true })); h.scale.set(1.15, 1.15 * 300 / 256, 1); h.position.set(0, 2.3, -.05); bike.add(h); }
    if (win){   // Paul vuelve de paquete
      bpart(new T.BoxGeometry(.48, .58, .3), new T.MeshStandardMaterial({ color: 0xf0f0f0 }), 0, 1.5, .74, -.2);
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

    // ---- montaje (tiempos del clip original desde 1:52) ----
    let SH = win
      ? [[0, 'aerialBack'], [4, 'cry'], [10, 'top'], [13, 'wide'], [16, 'sunset']]
      : [[0, 'aerialBack'], [6.2, 'glanceA'], [9, 'glanceB'], [12, 'top'], [16.8, 'forkTop'], [22, 'wide'], [27.2, 'sunset']];
    const shotAt = t => { let s = SH[0]; for (const x of SH) if (t >= x[0]) s = x; return s; };
    const sunAt = () => SH.find(x => x[1] === 'sunset')[0];
    let tWhite = win ? 24 : 36.5, tDone = tWhite + 2.2, doneF = false, closeF = false;
    later(() => { layer.classList.remove('intro'); layer.classList.add('up'); }, 1500);
    const tmp = new T.Vector3(), fogWhite = new T.Color(1, .82, .62), pW = new T.Vector3(), qW = new T.Vector3();

    // ¡ZA WARUDO! — escribir "mati" durante la animación
    const cv = renderer.domElement, snd = $(A.sound), vento = $('#ventoSound');
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
    ffEggHook = () => {
      if (!vsOpen || layer.dataset.anim !== 'furious' || !cv.isConnected) return false;
      if (egg || st > tWhite - 3.2) return true;
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
      if (!doneF && et >= tDone){ doneF = true; layer.classList.add('done'); }
      if (!closeF && et >= tDone + (A.hold || 5200) / 1000){ closeF = true; closeVersus(); return; }
      let [t0, kind] = shotAt(et), u = et - t0;
      if (frozen){ kind = 'freeze'; u = rt - egg.t0; }
      const inside = kind === 'glanceA' ? L0c : kind === 'glanceB' ? L1c : null;
      const oc = inside ? (inside === L0c ? L1c : L0c) : kind === 'cry' ? L0c : null;
      for (const c of cars){
        const s = carState(c, et), s2 = carState(c, et + .05);
        c.g.position.set(s.x, s.y, s.z);
        c.g.rotation.y = Math.atan2(-(s2.x - s.x), -(s2.z - s.z));
        c.g.position.y += Math.sin(et * 7 + c.k * 2) * .015;
        const lit = c.tA < 0 ? 1 : Math.min(1, Math.max(0, (et - c.tA - .4) / .7));
        if (c.tA >= 0) c.paint.color.setHex(0x9a9ca4).lerp(new T.Color(PAINT[c.ti % 4]), lit);
        c.glowM.opacity = .5 * lit;
        c.face.visible = !inside;
        const eggShot = kind === 'freeze' || kind === 'matiRide' || kind === 'together';
        c.face.material.opacity = inside || eggShot ? 0 : Math.min(1, et / 1.5) * (kind === 'sunset' || kind === 'wide' ? .0 : 1);
        const open = c === oc || (eggShot && c.captain);
        c.cab.visible = c !== inside && !open; c.driver.visible = c !== inside;
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
        bWheels.forEach(w => { w.rotation.x += rdt * 38; });
        const sk = standAt < 0 ? 0 : Math.min(1, (rt - standAt) / .45), pop = sk < 1 ? .35 + .7 * ease(sk) : 1;
        stand.material.opacity = .88 * sk * (.9 + .1 * Math.sin(rt * 6)); stand.scale.set(2.95 * pop, 6.55 * pop, 1);
        aura.material.opacity = .55 * sk * (.75 + .25 * Math.sin(rt * 4.3)); aura.scale.set(7.5 * pop, 9.5 * pop * (1 + .04 * Math.sin(rt * 7)), 1);
        gogo.forEach((g, i) => { g.material.opacity = sk * (.55 + .45 * Math.sin(rt * 3 + i * 2)); g.position.set((i % 2 ? 1 : -1) * 2.1, 2.2 + i * 1.7 + Math.sin(rt * 2 + i) * .25, 1.8); });
      }
      const L0 = sp(L0c, et), L1 = sp(L1c, et), L = L0.clone().add(L1).multiplyScalar(.5);
      let pos, look;
      if (kind === 'aerialBack'){ const k = ease(Math.min(1, u / 6.2)); pos = new T.Vector3(L.x + 9 - 4 * k, L.y + 46 - 22 * k, L.z + 46 - 14 * k); look = new T.Vector3(L.x, L.y, L.z - 30 + 8 * k); }
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
      // sombras siguen al convoy
      sunL.target.position.copy(L); sunL.position.copy(L).addScaledVector(sunDir, 700); sunL.target.updateMatrixWorld();
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
      sky.material.uniforms.glow.value = 1 + sunK * .7;
      sunGlow.material.opacity = .38 + .4 * sunK; sunGlow.scale.setScalar(520 + 700 * sunK * sunK);
      const ndc = tmp.copy(sunGlow.position).project(cam), hh = Math.tan(T.MathUtils.degToRad(cam.fov / 2)) * 40, hw = hh * cam.aspect, onS = ndc.z < 1 && Math.abs(ndc.x) < 1.3 && Math.abs(ndc.y) < 1.3 ? 1 : 0;
      ghosts.forEach(g => { const f = g.userData.f; g.position.set(ndc.x * hw * (1 - 2 * f), ndc.y * hh * (1 - 2 * f), -40); g.scale.setScalar(g.userData.s * .2); g.material.opacity = onS * (.12 + .3 * sunK); });
      scene.fog.near = 260 - 160 * sunK; scene.fog.color.setHex(0xe0a070).lerp(fogWhite, sunK * .6);
      // rótulos
      capT.style.opacity = !egg && et > .8 && et < 4.8 ? Math.min(1, (et - .8) * 1.2, (4.8 - et) * 1.2) : 0;
      const midKey = inside ? kind : ['cry', 'freeze', 'matiRide', 'together'].includes(kind) ? kind + (saved ? '+' : '') : '';
      if (capM.dataset.k !== midKey){ capM.dataset.k = midKey; capM.innerHTML = midHTML(midKey.replace('+', '')); }
      capM.style.opacity = !midKey ? 0 : kind === 'freeze' ? Math.min(1, Math.max(0, (u - 1.5) * 2)) : Math.min(1, u * 1.5);
      const ce = sunAt() + (win ? 1 : 1.2); capE.style.opacity = et > ce && et < tWhite - .6 ? Math.min(1, (et - ce) * .7, (tWhite - .6 - et) * 1.2) : 0;
      fade.style.opacity = et < .6 ? 1 - et / .6 : et > tWhite - 2.6 ? Math.min(1, (et - tWhite + 2.6) / 2.6) : 0;
      forP.style.opacity = et > tWhite + .4 ? Math.min(1, (et - tWhite - .4) / 1.2) : 0;
    });
  }
