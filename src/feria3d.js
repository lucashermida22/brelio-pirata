
  // =====================================================================
  //  FERIA 3D: coches de choque. Los jugadores van en coches que chocan;
  //  cada embestida asigna equipo y el coche se va a aparcar a su lado.
  // =====================================================================
  async function playFeria(teams, A, win){
    const layer = $('#vsLayer');
    const imgs = await Promise.all([loadImg($('#vsHero').src), ...teams.flatMap(t => t.members.map(m => loadImg(photoFor(m.name))))]);
    if (!vsOpen) return;
    const heroImg = imgs.shift();
    const ctx = glInit({ clear: 0x04010c, fov: 46, bloom: [.75, .5, .86] });
    if (!ctx) return;
    const { T, scene, cam, tex } = ctx, W = ctx.W, H = ctx.H, narrow = W / H < .8;
    scene.fog = new T.Fog(0x04010c, 34, 90);
    const S = synth();
    const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };

    // ---- medidas de la pista según la pantalla ----
    const camD = new T.Vector3(0, 9.5, 14.5), look = new T.Vector3(0, 0, .6);
    const dist = camD.distanceTo(look), visH = 2 * dist * Math.tan(T.MathUtils.degToRad(24)), visW = visH * W / H;
    const RX = Math.min(12, visW * .43), RZ = narrow ? 6.5 : 6.2;
    const all = teams.flatMap((t, ti) => t.members.map((m, k) => ({ m, ti, k, team: t })));
    const N = all.length, rc = Math.max(.5, Math.min(1, Math.sqrt(RX * RZ * 4 / N) * .21));

    // ---- luces ----
    scene.add(new T.AmbientLight(0x5a4a8a, .32));
    const key = new T.DirectionalLight(0xffffff, .7); key.position.set(4, 12, 8); scene.add(key);
    const pls = [0xff2a6a, 0x2ad8ff, 0xffd23f, 0x7dff6a].map((c, i) => { const l = new T.PointLight(c, 1.6, 30); l.position.set((i - 1.5) * RX * .6, 5, (i % 2 ? 1 : -1) * RZ * .5); scene.add(l); return l; });

    // ---- suelo metálico, bordes de goma, red del techo ----
    const fc = document.createElement('canvas'); fc.width = fc.height = 256;
    { const g = fc.getContext('2d'); g.fillStyle = '#2c2f3a'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++){ const gr = g.createLinearGradient(i * 128, j * 128, i * 128 + 128, j * 128 + 128); gr.addColorStop(0, '#3e4250'); gr.addColorStop(1, '#262833'); g.fillStyle = gr; g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124); }
      g.fillStyle = '#5a5f70'; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) [[10, 10], [118, 10], [10, 118], [118, 118]].forEach(([x, y]) => { g.beginPath(); g.arc(i * 128 + x, j * 128 + y, 3, 0, 7); g.fill(); }); }
    const ft = tex(fc); ft.wrapS = ft.wrapT = T.RepeatWrapping; ft.repeat.set(RX / 1.2, RZ / 1.2);
    const floor = new T.Mesh(new T.PlaneGeometry(RX * 2 + 1, RZ * 2 + 1), new T.MeshStandardMaterial({ map: ft, metalness: .75, roughness: .35 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const sc = document.createElement('canvas'); sc.width = 128; sc.height = 16;
    { const g = sc.getContext('2d'); for (let i = 0; i < 8; i++){ g.fillStyle = i % 2 ? '#111' : '#ffd23f'; g.beginPath(); g.moveTo(i * 16, 16); g.lineTo(i * 16 + 8, 0); g.lineTo(i * 16 + 24, 0); g.lineTo(i * 16 + 16, 16); g.fill(); } }
    const stripe = tex(sc); stripe.wrapS = T.RepeatWrapping;
    const wallMat = new T.MeshStandardMaterial({ map: stripe, roughness: .6 });
    [[0, -RZ - .3, RX * 2 + 1.2, .5], [0, RZ + .3, RX * 2 + 1.2, .5]].forEach(([x, z, w, d]) => { const m = new T.Mesh(new T.BoxGeometry(w, .55, d), wallMat); m.position.set(x, .28, z); scene.add(m); });
    [[-RX - .3, 0], [RX + .3, 0]].forEach(([x, z]) => { const m = new T.Mesh(new T.BoxGeometry(.5, .55, RZ * 2 + 1.2), wallMat); m.position.set(x, .28, z); scene.add(m); });
    stripe.repeat.set(12, 1);
    const ceilY = 6.2;
    const net = new T.GridHelper(Math.max(RX, RZ) * 2.2, 26, 0x5a6aff, 0x34307a); net.position.y = ceilY; net.material.transparent = true; net.material.opacity = .35; scene.add(net);

    // ---- bombillas alrededor de la pista ----
    const bulbs = [], bulbCols = [0xff2a6a, 0xffd23f, 0x2ad8ff, 0x7dff6a, 0xff8a2a];
    const perim = [[-RX - .6, -RZ - .6], [RX + .6, -RZ - .6], [RX + .6, RZ + .6], [-RX - .6, RZ + .6]];
    const bulbGeo = new T.SphereGeometry(.13, 10, 10);
    for (let s = 0; s < 4; s++){
      const [x1, z1] = perim[s], [x2, z2] = perim[(s + 1) % 4], L = Math.hypot(x2 - x1, z2 - z1), n = Math.round(L / 1.1);
      for (let i = 0; i < n; i++){
        const k = i / n, b = new T.Mesh(bulbGeo, new T.MeshBasicMaterial({ color: bulbCols[bulbs.length % 5] }));
        b.position.set(x1 + (x2 - x1) * k, 2.6 + Math.sin(k * Math.PI) * -.35, z1 + (z2 - z1) * k); scene.add(b); bulbs.push(b);
      }
      const post = new T.Mesh(new T.CylinderGeometry(.08, .1, 2.6, 8), new T.MeshStandardMaterial({ color: 0xc9c9d9, metalness: .8, roughness: .3 })); post.position.set(x1, 1.3, z1); scene.add(post);
    }

    // ---- noria al fondo ----
    const wheel = new T.Group(); wheel.position.set(-RX * .7, 6, -26); scene.add(wheel);
    { const R = 8; wheel.add(new T.Mesh(new T.TorusGeometry(R, .12, 8, 64), new T.MeshBasicMaterial({ color: 0xff5ab8 })));
      const sp = []; for (let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2; sp.push(new T.Vector3(0, 0, 0), new T.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0)); }
      wheel.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(sp), new T.LineBasicMaterial({ color: 0x9a7aff })));
      for (let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2, b = new T.Mesh(new T.SphereGeometry(.3, 8, 8), new T.MeshBasicMaterial({ color: bulbCols[i % 5] })); b.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); wheel.add(b); } }
    const leg = new T.LineSegments(new T.BufferGeometry().setFromPoints([new T.Vector3(-RX * .7 - 5, -1, -26), new T.Vector3(-RX * .7, 6, -26), new T.Vector3(-RX * .7 + 5, -1, -26), new T.Vector3(-RX * .7, 6, -26)]), new T.LineBasicMaterial({ color: 0x9a7aff })); scene.add(leg);

    // ---- letrero de neón + foto del chico ----
    const signC = document.createElement('canvas'); signC.width = 1024; signC.height = 300;
    const drawSign = (l1, l2, on) => { const g = signC.getContext('2d'); g.clearRect(0, 0, 1024, 300); rrect(g, 8, 8, 1008, 284, 40); g.fillStyle = 'rgba(20,6,40,.85)'; g.fill(); g.lineWidth = 10; g.strokeStyle = on ? '#ff2a6a' : '#5a2040'; g.shadowColor = '#ff2a6a'; g.shadowBlur = on ? 30 : 0; g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic 900 104px Bungee, "Arial Black", sans-serif'; g.fillStyle = on ? '#fff59a' : '#6a5a2a'; g.shadowColor = '#ffd23f'; g.fillText(l1, 512, 120, 960);
      g.font = '800 54px "Plus Jakarta Sans", system-ui, sans-serif'; g.fillStyle = on ? '#7ff8ff' : '#2a5a6a'; g.shadowColor = '#2ad8ff'; g.fillText(l2, 512, 222, 940); };
    const signT = tex(signC);
    const sign = new T.Mesh(new T.PlaneGeometry(narrow ? 6.4 : 9, narrow ? 1.9 : 2.64), new T.MeshBasicMaterial({ map: signT, transparent: true }));
    sign.position.set(0, narrow ? 4.6 : 3.7, -RZ - 2); sign.rotation.x = -.12; scene.add(sign);
    const l1 = win ? A.winTitle : A.title, l2 = win ? teams[0].name : (teams.length === 2 ? `${teams[0].name} vs ${teams[1].name}` : teams.map(t => t.name).join(' · '));
    drawSign(l1, l2, false); signT.needsUpdate = true;
    let hero = null;
    if (!win && heroImg){ const ht = new T.Texture(heroImg); ht.encoding = T.sRGBEncoding; ht.needsUpdate = true;
      hero = new T.Group(); const fr = new T.Mesh(new T.PlaneGeometry(1.25, 2.1), new T.MeshBasicMaterial({ color: 0xffd23f })); const ph = new T.Mesh(new T.PlaneGeometry(1.125, 2), new T.MeshBasicMaterial({ map: ht, color: 0xdddddd })); ph.position.z = .01; hero.add(fr, ph);
      hero.position.set(0, (narrow ? 4.6 : 3.7) + (narrow ? 2.2 : 2.45), -RZ - 2.2); hero.scale.setScalar(.01); scene.add(hero); }

    // ---- coches ----
    const rubber = new T.MeshStandardMaterial({ color: 0x111116, roughness: .8 });
    const chrome = new T.MeshStandardMaterial({ color: 0xd8d8e8, metalness: .9, roughness: .2 });
    const sparkTex = tex(glowCanvas([[0, 'rgba(255,255,255,1)'], [.2, 'rgba(160,220,255,.9)'], [1, 'rgba(0,0,0,0)']]));
    const neutral = [0xff3b6b, 0x3bc8ff, 0xffd23f, 0x7dff6a, 0xff8a2a, 0xc46bff];
    let ii = 0;
    const cars = all.map((p, i) => {
      const g = new T.Group();
      const col = new T.Color(neutral[i % neutral.length]);
      const bodyMat = new T.MeshStandardMaterial({ color: col, metalness: .3, roughness: .3, emissive: col.clone().multiplyScalar(.06) });
      const base = new T.Mesh(new T.CylinderGeometry(rc * .92, rc * .98, rc * .42, 32), bodyMat); base.scale.z = 1.3; base.position.y = rc * .32; g.add(base);
      const bump = new T.Mesh(new T.TorusGeometry(rc * .97, rc * .17, 10, 36), rubber); bump.rotation.x = Math.PI / 2; bump.scale.set(1, 1.3, 1); bump.position.y = rc * .2; g.add(bump);
      const hood = new T.Mesh(new T.SphereGeometry(rc * .62, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat); hood.scale.set(1, .55, .9); hood.position.set(0, rc * .52, rc * .48); g.add(hood);
      const back = new T.Mesh(new T.BoxGeometry(rc * 1.2, rc * .8, rc * .22), bodyMat); back.position.set(0, rc * .85, -rc * .72); g.add(back);
      const pole = new T.Mesh(new T.CylinderGeometry(.035, .035, ceilY - rc * .6, 6), chrome); pole.position.set(0, (ceilY + rc * .6) / 2, -rc * .95); g.add(pole);
      const spark = new T.Sprite(new T.SpriteMaterial({ map: sparkTex, ...AB })); spark.position.set(0, ceilY - .05, -rc * .95); spark.scale.setScalar(.6); g.add(spark);
      const face = new T.Sprite(new T.SpriteMaterial({ map: tex(faceCanvas(p.m.name, '#ffffff', imgs[ii++], p.m.name)), transparent: true })); face.scale.set(rc * 1.7, rc * 1.7 * 300 / 256, 1); face.position.set(0, rc * 1.75, -rc * .15); g.add(face);
      const flag = new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas(p.team.name, { size: 80, w: 768, h: 150, glow: p.team.bar, weight: 800 })), transparent: true, depthTest: false, opacity: 0 }));
      flag.scale.set(rc * 3.2, rc * .62, 1); flag.position.set(0, rc * 2.75, 0); g.add(flag);
      // entrada por los laterales
      const side = i % 2 ? 1 : -1;
      const pos = new T.Vector3(side * (RX + 4), 0, (Math.random() - .5) * RZ * 1.4);
      g.position.copy(pos); scene.add(g);
      const a = Math.random() * Math.PI * 2;
      return { p, g, bodyMat, spark, flag, face, pos, vel: new T.Vector3(-side * 7, 0, Math.sin(a) * 3), mode: 'enter', heading: side > 0 ? -Math.PI / 2 : Math.PI / 2, bump: 0, squash: 0, target: null, slot: null, tRam: 0, entered: false, delay: .12 * i };
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
      const pts = new T.Points(g, new T.PointsMaterial({ color: col, size: .16, map: sparkTex, ...AB })); scene.add(pts);
      fxList.push({ o: pts, t: 0, d: .7, u: (o, k, dt) => { const a = o.geometry.attributes.position.array; for (let i = 0; i < n; i++){ a[i*3] += v[i*3] * dt; a[i*3+1] += v[i*3+1] * dt; a[i*3+2] += v[i*3+2] * dt; v[i*3+1] -= 18 * dt; } o.geometry.attributes.position.needsUpdate = true; o.material.opacity = 1 - k; } });
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
    const finish = et => { if (doneFired) return; doneFired = true; tDone = et; layer.classList.add('done'); S && S.chord(); later(closeVersus, A.hold || 4200); };
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
      bulbs.forEach((b, i) => { const lit = ((Math.floor(et / (beat || .37)) + i) % 3) !== 0; b.material.color.setHex(lit ? bulbCols[i % 5] : 0x222233); });
      wheel.rotation.z = et * .12;
      pls.forEach((l, i) => l.intensity = 1.2 + .8 * Math.sin(et * 3 + i * 1.7));

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
          if (rel > 2.5 && et - lastPum > .14){ lastPum = et; sparks(mid, 0xfff2b0, 40, 6); S && S.zap(180 + rand(200)); if (Math.random() < .5) pum(mid, false); shake = Math.max(shake, .18); }
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
        if (c.assigned) c.flag.material.opacity = Math.min(1, c.flag.material.opacity + dt * 3);
      }
      teamSigns.forEach((s, i) => { if (s.userData.on != null || win || tDone) s.material.opacity = Math.min(1, s.material.opacity + dt * 2); s.position.y = 3.4 + Math.sin(et * 2 + i) * .08; });
      if (vsS && teamSigns.some(s => s.material.opacity > .5)){ vsS.material.opacity = Math.min(1, vsS.material.opacity + dt * 2); vsS.material.rotation = Math.sin(et * 3) * .1; const k = 1 + Math.sin(et * 8) * .05; vsS.scale.set(2.6 * k, 1.42 * k, 1); }
      if (!doneFired && cars.every(c => c.mode === 'parked')) finish(et);
      if (win && tDone && et - lastFw > .45){ lastFw = et; fireworks(); }
      for (let i = fxList.length - 1; i >= 0; i--){ const f = fxList[i]; f.t += dt; const k = Math.min(1, f.t / f.d); f.u(f.o, k, dt); if (k >= 1){ scene.remove(f.o); f.o.geometry && f.o.geometry.dispose(); f.o.material.map && f.o.material.map !== sparkTex && f.o.material.map.dispose(); f.o.material.dispose(); fxList.splice(i, 1); } }
    });
    const st = fxStop; fxStop = () => { S && S.close(); st(); };
  }
