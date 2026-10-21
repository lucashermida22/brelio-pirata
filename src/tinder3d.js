
  // =====================================================================
  //  TINDER 3D ("brinder"): el chico hace swipe a cada jugador.
  //  Derecha = LIKE → su equipo (Matches). Izquierda = NOPE → el otro.
  //  Ganador: si ganan sus matches se enamoran; si no, se queda triste.
  // =====================================================================
  function profileCanvas(m, img, color){
    const c = document.createElement('canvas'); c.width = 512; c.height = 720; const g = c.getContext('2d');
    g.save(); rrect(g, 0, 0, 512, 720, 40); g.clip();
    if (img){ const r = Math.max(512 / img.width, 720 / img.height), w = img.width * r, h = img.height * r; g.drawImage(img, (512 - w) / 2, (720 - h) / 2, w, h); }
    else { const gr = g.createLinearGradient(0, 0, 512, 720); gr.addColorStop(0, '#ffd1e3'); gr.addColorStop(1, '#ff8ab8'); g.fillStyle = gr; g.fillRect(0, 0, 512, 720); g.font = '300px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emojiFor(m.name), 256, 320); }
    const gr = g.createLinearGradient(0, 380, 0, 720); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = gr; g.fillRect(0, 380, 512, 340);
    g.fillStyle = '#fff'; g.font = '800 58px "Plus Jakarta Sans", system-ui, sans-serif'; g.textBaseline = 'alphabetic';
    g.fillText(m.name + ', ' + (19 + (m.name.length * 7) % 12), 32, 618, 448);
    g.font = '500 28px Geist, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText('📍 a ' + (1 + m.name.length % 9) + ' km · busca pachanga', 32, 664, 448);
    if (m.role){ g.font = '700 24px Geist, sans-serif'; const w = g.measureText(m.role).width + 24; rrect(g, 32, 540, w, 36, 10); g.fillStyle = LANE_COLORS[m.role] || '#71717a'; g.fill(); g.fillStyle = '#fff'; g.fillText(m.role, 44, 566); }
    g.restore(); g.lineWidth = 6; g.strokeStyle = color || 'rgba(255,255,255,.9)'; rrect(g, 3, 3, 506, 714, 38); g.stroke();
    return c;
  }
  function stampCanvas(text, col){
    const c = document.createElement('canvas'); c.width = 512; c.height = 200; const g = c.getContext('2d');
    g.translate(256, 100); g.lineWidth = 12; g.strokeStyle = col; rrect(g, -230, -78, 460, 156, 20); g.stroke();
    g.fillStyle = col; g.font = '900 104px "Plus Jakarta Sans", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 6, 430);
    return c;
  }
  function phoneCanvas(){
    const c = document.createElement('canvas'); c.width = 540; c.height = 1100; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 1100); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#fdf2f6'); g.fillStyle = gr; rrect(g, 0, 0, 540, 1100, 56); g.fill();
    g.fillStyle = '#ff4f7b'; g.font = '900 52px "Plus Jakarta Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥ brinder', 270, 78);
    [['✕', '#ff4f6d', 150], ['★', '#3d8bff', 270], ['♥', '#22c55e', 390]].forEach(([t, col, x]) => { g.beginPath(); g.arc(x, 1000, 52, 0, 7); g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.2)'; g.shadowBlur = 18; g.fill(); g.shadowBlur = 0; g.lineWidth = 4; g.strokeStyle = col; g.stroke(); g.fillStyle = col; g.font = '900 54px system-ui, sans-serif'; g.fillText(t, x, 1003); });
    return c;
  }

  async function playTinder(teams, A, win, opts = {}){
    const layer = $('#vsLayer');
    const imgs = await Promise.all([loadImg($('#vsHero').dataset.orig || $('#vsHero').src), ...teams.flatMap(t => t.members.map(m => loadImg(photoFor(m.name))))]);
    if (!vsOpen) return;
    const heroImg = imgs.shift();
    const ctx = glInit({ clear: 0x2a0818, fov: 42, bloom: [.75, .6, .8], clipping: true });
    if (!ctx) return;
    const { T, scene, cam, tex } = ctx, W = ctx.W, H = ctx.H, narrow = W / H < .8;
    const VH = 2 * 15 * Math.tan(T.MathUtils.degToRad(21)), VW = VH * W / H;
    cam.position.set(0, 0, 15); cam.lookAt(0, 0, 0);
    const S = synth(), beat = A.beat / 1000, sad = win && !opts.matchWin, love = win && opts.matchWin;
    const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };

    // ---- fondo, luces, corazones flotando ----
    const bgC = document.createElement('canvas'); bgC.width = 4; bgC.height = 256;
    const paintBg = (a, b) => { const g = bgC.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); };
    paintBg('#5a0f3a', '#ff6a7a'); const bgT = tex(bgC);
    const bg = new T.Mesh(new T.PlaneGeometry(VW * 3, VH * 3), new T.MeshBasicMaterial({ map: bgT, depthWrite: false })); bg.position.z = -20; scene.add(bg);
    scene.add(new T.AmbientLight(0xffd0e0, .6));
    const dl = new T.DirectionalLight(0xffffff, .9); dl.position.set(3, 5, 10); scene.add(dl);
    const pink = new T.PointLight(0xff4f7b, 2, 30); pink.position.set(0, 2, 6); scene.add(pink);
    const HN = 46, hm = new T.InstancedMesh(heartGeo(T, .55, 3), new T.MeshStandardMaterial({ color: 0xff4f7b, metalness: .2, roughness: .25, emissive: 0x6a0020, emissiveIntensity: .4 }), HN), hd = [];
    const dummy = new T.Object3D();
    for (let i = 0; i < HN; i++){ hd.push({ p: new T.Vector3((Math.random() - .5) * VW * 1.4, (Math.random() - .5) * VH * 1.4, -4 - Math.random() * 12), s: .4 + Math.random() * 1.1, v: .4 + Math.random() * .9, r: Math.random() * 6, w: (Math.random() - .5) * 2 }); }
    scene.add(hm);

    // ---- el chico (foto original) ----
    const meC = faceCanvas('tú', '#ff4f7b', heroImg, 'TÚ');
    const me = new T.Mesh(new T.PlaneGeometry(1, 300 / 256), new T.MeshBasicMaterial({ map: tex(meC), transparent: true }));
    scene.add(me);
    const q = new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas(win ? (love ? '¡Es un match!' : 'Sin match…') : '¿Con quién harás match?', { size: 96, w: 1024, h: 170, glow: '#ff4f7b', weight: 800 })), transparent: true, depthTest: false, opacity: 0 }));
    q.scale.set(Math.min(VW * .9, 9), Math.min(VW * .9, 9) * 170 / 1024, 1); q.position.set(0, VH * .36, 1); scene.add(q);

    // ---- móvil ----
    const ph = narrow ? VH * .44 : VH * .66, pw = ph * .49;
    const phone = new T.Group(); scene.add(phone);
    const body = new T.Mesh(new T.BoxGeometry(pw * 1.06, ph * 1.04, .32), new T.MeshStandardMaterial({ color: 0x17151f, metalness: .85, roughness: .25 }));
    const screen = new T.Mesh(new T.PlaneGeometry(pw * .96, ph * .96), new T.MeshBasicMaterial({ map: tex(phoneCanvas()), color: 0xbdbdbd })); screen.position.z = .17;
    phone.add(body, screen);
    const cw = pw * .84, chh = cw * 720 / 512, cardY = ph * .03;
    phone.position.set(0, narrow ? 0 : -VH * .04, -40); phone.visible = !win;

    // ---- montones (equipos) ----
    const n = teams.length;
    const pileC = ti => {
      if (narrow) return new T.Vector3(0, (ti % 2 ? -1 : 1) * VH * .345 - (ti >= 2 ? (ti % 2 ? -1 : 1) * VH * .12 : 0), 0);
      const side = ti % 2 ? -1 : 1, row = Math.floor(ti / 2), rows = Math.ceil(n / 2), x = side * (pw / 2 + (VW / 2 - pw / 2) * .5 + .2);
      return new T.Vector3(x, -VH * .03 - (row - (rows - 1) / 2) * VH * .42, 0);
    };
    const pileW = narrow ? VW * .9 : (VW / 2 - pw / 2) * .86, pileH = narrow ? VH * .22 : VH * (n > 2 ? .38 : .62);
    const cards = [], allM = teams.flatMap((t, ti) => t.members.map((m, k) => ({ m, ti, k, team: t })));
    const order = shuffle(allM);
    const DIRS = [[1, 0, 'LIKE', '#22c55e'], [-1, 0, 'NOPE', '#ff4f6d'], [0, 1, 'SUPER LIKE', '#3d8bff'], [0, -1, 'BLOCK', '#71717a']];
    let ci = 0;
    const imgByKey = new Map(); teams.forEach((t, ti) => t.members.forEach((m, k) => imgByKey.set(ti + ':' + k, imgs[ci++])));
    teams.forEach((t, ti) => {
      const mem = t.members.length + (ti === 0 && !win ? 1 : 0);
      const cols = narrow ? Math.min(mem, 6) : Math.max(1, Math.ceil(Math.sqrt(mem * pileW / pileH * .75))), rows = Math.ceil(mem / cols);
      const mw = Math.min(pileW / (cols * 1.12), (pileH - .6) / (rows * 1.45)), mh = mw * 720 / 512;
      t._pile = { c: pileC(ti), cols, rows, mw, mh, n: mem };
    });
    const slotOf = (ti, k) => { const P = teams[ti]._pile, r = Math.floor(k / P.cols), inRow = Math.min(P.cols, P.n - r * P.cols), c = k % P.cols;
      return new T.Vector3(P.c.x + (c - (inRow - 1) / 2) * P.mw * 1.12, P.c.y + ((P.rows - 1) / 2 - r) * P.mh * 1.1 - .25, .3 + k * .01); };
    order.forEach((o, i) => {
      const mesh = new T.Mesh(new T.PlaneGeometry(cw, chh), new T.MeshBasicMaterial({ map: tex(profileCanvas(o.m, imgByKey.get(o.ti + ':' + o.k), o.team.bar)), transparent: true, side: T.DoubleSide }));
      const [dx, dy, word, col] = DIRS[Math.min(o.ti, 3)];
      const st = new T.Mesh(new T.PlaneGeometry(cw * .7, cw * .7 * 200 / 512), new T.MeshBasicMaterial({ map: tex(stampCanvas(word, col)), transparent: true, opacity: 0, depthTest: false }));
      st.position.set(dx < 0 ? cw * .18 : -cw * .18, chh * .32, .02); st.rotation.z = dx < 0 ? -.3 : .3; mesh.add(st);
      mesh.visible = false; scene.add(mesh);
      cards.push({ ...o, mesh, st, dx, dy, word, col, slot: null });
    });
    // en orden de llegada a cada montón
    const cnt = teams.map(() => 0);
    cards.forEach(c => { c.slot = slotOf(c.ti, cnt[c.ti]++); });
    const meSlot = !win ? slotOf(0, cnt[0]) : null;
    const labels = teams.map((t, ti) => { const s = new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas(t.name, { size: 96, w: 1024, h: 170, glow: ti === 0 ? '#ff4f7b' : '#6a6a8a', weight: 800 })), transparent: true, opacity: 0, depthTest: false }));
      const P = t._pile; s.position.set(P.c.x, P.c.y + P.rows * P.mh * .55 + .35, 1); const w = Math.min(pileW * 1.1, 5); s.scale.set(w, w * 170 / 1024, 1); scene.add(s); return s; });
    const thumb = new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas('👆', { size: 150, w: 256, h: 256, glow: 'rgba(0,0,0,0)' })), transparent: true, depthTest: false, opacity: 0 }));
    thumb.scale.setScalar(narrow ? .7 : 1); scene.add(thumb);

    // ---- efectos ----
    const fxList = [];
    const heartTex = tex(textCanvas('💖', { size: 150, w: 256, h: 256, glow: 'rgba(0,0,0,0)' })), brokenTex = tex(textCanvas('💔', { size: 150, w: 256, h: 256, glow: 'rgba(0,0,0,0)' }));
    function heartsBurst(pos, n, broken){
      for (let i = 0; i < n; i++){ const s = new T.Sprite(new T.SpriteMaterial({ map: broken ? brokenTex : heartTex, transparent: true, depthTest: false })); s.position.copy(pos); s.scale.setScalar(.35 + Math.random() * .4); scene.add(s);
        const v = new T.Vector3((Math.random() - .5) * 5, 1.5 + Math.random() * 4, (Math.random() - .5) * 2);
        fxList.push({ o: s, t: 0, d: 1.1, u: (o, k, dt) => { o.position.addScaledVector(v, dt); v.y -= (broken ? 9 : 3) * dt; o.material.opacity = 1 - k; o.material.rotation += dt * (broken ? 3 : 1); } }); }
    }
    function word(text, pos, grad){ const s = popSprite(ctx, text, pos, { h: .9, grad }); fxList.push({ o: s, t: 0, d: .9, u: (o, k) => { const e = Math.min(1, k / .2); o.scale.set(o.userData.h * 3.5 * (1.5 - .5 * e), o.userData.h * (1.5 - .5 * e), 1); o.position.y += .012; o.material.opacity = 1 - Math.max(0, (k - .6) / .4); } }); }

    // ---- final de ganador: amor o tristeza ----
    let bigHeart = null, halves = null, rain = null, capt = null;
    if (love){
      bigHeart = new T.Mesh(heartGeo(T, Math.min(VH, VW) * .62, 4), new T.MeshStandardMaterial({ color: 0xff2a6a, metalness: .3, roughness: .2, emissive: 0x8a0030, emissiveIntensity: .6 }));
      bigHeart.position.set(0, -VH * .02, -3); bigHeart.scale.setScalar(.01); scene.add(bigHeart);
      const lead = teams[0].members[0];
      capt = new T.Mesh(new T.PlaneGeometry(1, 300 / 256), new T.MeshBasicMaterial({ map: tex(faceCanvas(lead.name, teams[0].bar, imgByKey.get('0:0'), lead.name)), transparent: true }));
      capt.position.set(VW * .6, 0, .5); scene.add(capt);
    }
    if (sad){
      paintBg('#1a2230', '#48566a'); bgT.needsUpdate = true; hm.material.color.set(0x5a6a80); hm.material.emissive.set(0x000000); pink.color.set(0x6a8aff); pink.intensity = .8;
      const RN = 700, rp = new Float32Array(RN * 6), rd = [];
      for (let i = 0; i < RN; i++){ rd.push(new T.Vector3((Math.random() - .5) * VW * 1.4, (Math.random() - .5) * VH * 1.4, -6 + Math.random() * 10)); }
      const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3));
      rain = { g: rg, p: rp, d: rd, n: RN }; scene.add(new T.LineSegments(rg, new T.LineBasicMaterial({ color: 0xaecbff, transparent: true, opacity: .5 })));
      const geo = heartGeo(T, Math.min(VH, VW) * .42, 4), mk = sgn => { const pl = new T.Plane(new T.Vector3(sgn, 0, 0), 0); const m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xc23a5a, metalness: .2, roughness: .4, clippingPlanes: [pl], side: T.DoubleSide })); m.position.set(0, VH * .05, -2.5); scene.add(m); return { m, pl, sgn }; };
      halves = [mk(1), mk(-1)];
      me.material.color.set(0x9aaabf);
      const snd = $('#drownSound'); if (snd){ snd.preservesPitch = false; snd.playbackRate = .82; }
    }

    // ---- línea de tiempo ----
    const SW = cards.length > 10 ? beat : beat * 2, tPhone = 1.7, tSw = 2.9;
    cards.forEach((c, i) => { c.t0 = tSw + i * SW; });
    const tEnd = win ? 1.2 : tSw + cards.length * SW, tMe = tEnd + .2, tOut = tEnd + 1.2;
    const tDone = win ? 4.2 : tEnd + 1.9;
    later(() => { layer.classList.remove('intro'); layer.classList.add('up'); }, 1600);
    later(() => { layer.classList.add('done'); S && S.chord(); }, tDone * 1000);
    later(closeVersus, (tDone + (A.hold || 4200) / 1000) * 1000);
    if (win) teams[0].members.forEach((m, k) => { const c = cards.find(x => x.ti === 0 && x.k === k); if (c){ c.mesh.visible = true; c.done = true; } });

    const ease = k => k < .5 ? 4 * k ** 3 : 1 - Math.pow(-2 * k + 2, 3) / 2, outBack = k => { const c1 = 1.8, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
    const meBig = Math.min(VH * .42, VW * .55), meSmall = narrow ? VH * .075 : VH * .15;
    const meTop = narrow ? new T.Vector3(-pw * .36, ph * .43, .9) : new T.Vector3(0, ph / 2 + meSmall * .62 - VH * .04, .6);
    let lastBurst = 0, lastLoveBurst = 0;
    ctx.start((et, dt) => {
      // corazones de fondo
      hd.forEach((h, i) => { h.p.y += h.v * dt; if (h.p.y > VH * .8) h.p.y = -VH * .8; h.r += h.w * dt; dummy.position.copy(h.p); dummy.position.x += Math.sin(et * .8 + i) * .3; dummy.rotation.set(Math.sin(h.r) * .4, h.r, 0); dummy.scale.setScalar(h.s * (1 + Math.max(0, Math.sin(et / beat * Math.PI)) * .08)); dummy.updateMatrix(); hm.setMatrixAt(i, dummy.matrix); });
      hm.instanceMatrix.needsUpdate = true;
      q.material.opacity = et < .3 ? et / .3 : (!win && et > 1.6) ? Math.max(0, 1 - (et - 1.6) / .4) : Math.min(1, q.material.opacity + dt * 2);

      // el chico: grande al principio, luego arriba del móvil, luego a su equipo
      if (!win){
        if (et < tPhone){ const k = outBack(Math.min(1, et / .7)); me.scale.setScalar(Math.max(.01, meBig * k)); me.position.set(0, -VH * .02, .6); me.rotation.z = Math.sin(et * 3) * .05; }
        else if (et < tMe){ const k = ease(Math.min(1, (et - tPhone) / .8)); me.scale.setScalar(meBig + (meSmall - meBig) * k); me.position.lerpVectors(new T.Vector3(0, -VH * .02, .6), meTop, k); me.rotation.z = Math.sin(et * 2) * .04; }
        else { const k = ease(Math.min(1, (et - tMe) / .9)); const P = teams[0]._pile; me.scale.setScalar(meSmall + (P.mw * 1.05 - meSmall) * k); me.position.lerpVectors(meTop, meSlot, k); me.position.z = .6 + Math.sin(k * Math.PI) * 2; me.rotation.z = k * Math.PI * 2 * (1 - k) * .3;
          if (k >= 1 && !me.userData.joined){ me.userData.joined = true; heartsBurst(meSlot, 14); word('¡TÚ!', meSlot.clone().add(new T.Vector3(0, .9, 1)), ['#fff', '#ffd1e3', '#ff4f7b']); S && S.zap(1320); } }
      } else if (love){
        const k = ease(Math.min(1, et / 1.6));
        me.scale.setScalar(meBig * .75); me.position.set(-VW * .6 + (VW * .6 - meBig * .34) * k, 0, .5);
        capt.scale.setScalar(meBig * .75); capt.position.set(VW * .6 - (VW * .6 - meBig * .34) * k, 0, .5);
        const kiss = et > 1.8 ? Math.sin(Math.min(1, (et - 1.8) / .5) * Math.PI) : 0;
        me.rotation.z = -.12 * k - kiss * .1; capt.rotation.z = .12 * k + kiss * .1; me.position.x += kiss * .25; capt.position.x -= kiss * .25;
        if (et > 1.8 && !capt.userData.k){ capt.userData.k = true; heartsBurst(new T.Vector3(0, .5, 1), 30); word('💋', new T.Vector3(0, meBig * .45, 1.2)); S && S.chord(); }
        bigHeart.scale.setScalar(Math.max(.01, outBack(Math.min(1, Math.max(0, (et - .6) / .9)))) * (1 + Math.max(0, Math.sin(et / beat * Math.PI)) * .07)); bigHeart.rotation.y = Math.sin(et * .8) * .35;
        if (et - lastLoveBurst > .35 && et > 2){ lastLoveBurst = et; heartsBurst(new T.Vector3((Math.random() - .5) * VW * .8, -VH * .3, 0), 4); }
      } else if (sad){
        me.scale.setScalar(meBig * .7); me.position.set(0, -VH * .12 - Math.min(1, et / 3) * .3, .5); me.rotation.z = -.08 * Math.min(1, et / 2);
        const k = Math.min(1, Math.max(0, (et - 1.2) / 2.2)), e = k * k;
        halves.forEach(h => { h.m.position.x = h.sgn * e * 1.6; h.m.position.y = VH * .1 - e * VH * .5; h.m.rotation.z = -h.sgn * e * .9; h.pl.constant = -h.sgn * h.m.position.x + h.sgn * 0; h.pl.normal.set(h.sgn * Math.cos(h.m.rotation.z), h.sgn * Math.sin(h.m.rotation.z), 0); h.pl.constant = -h.pl.normal.dot(h.m.position); });
        for (let i = 0; i < rain.n; i++){ const p = rain.d[i]; p.y -= 14 * dt; p.x -= 2 * dt; if (p.y < -VH * .75){ p.y = VH * .75; p.x = (Math.random() - .5) * VW * 1.4; } rain.p.set([p.x, p.y, p.z, p.x + .12, p.y + .7, p.z], i * 6); }
        rain.g.attributes.position.needsUpdate = true;
      }

      // móvil: entra girando, sale al acabar
      if (!win){
        const kIn = ease(Math.min(1, Math.max(0, (et - tPhone) / 1)));
        const kOut = ease(Math.min(1, Math.max(0, (et - tOut) / .9)));
        phone.position.z = -40 + 40 * kIn; phone.rotation.y = (1 - kIn) * Math.PI * 2;
        phone.position.y = (narrow ? 0 : -VH * .04) - kOut * VH * 1.1; phone.rotation.x = kOut * .8;
        phone.visible = kOut < 1;
      }

      // cartas: aparecen, swipe, vuelan a su montón
      for (const c of cards){
        if (c.done){ c.mesh.visible = true; const P = teams[c.ti]._pile, s = P.mw / cw;
          if (!c.parkedInit){ c.parkedInit = true; c.mesh.position.copy(c.slot); c.mesh.scale.setScalar(s); c.mesh.rotation.set(0, 0, (Math.random() - .5) * .16); c.st.material.opacity = 0; }
          const dn = et > tDone ? 1 : 0; c.mesh.position.y = c.slot.y + Math.sin(et * 2 + c.k) * .05 * dn; c.mesh.rotation.y = (c.ti % 2 ? .25 : -.25) * (narrow ? 0 : 1) + Math.sin(et * 1.3 + c.k) * .06 * dn;
          if (love){ const a = (c.k / teams[0].members.length) * Math.PI * 2 + et * .4; c.mesh.position.set(Math.cos(a) * VW * .38, Math.sin(a) * VH * .36, -1); c.mesh.rotation.set(0, 0, Math.sin(a) * .1); c.mesh.scale.setScalar(Math.min(VH * .16, VW * .12) / cw); }
          if (sad){ c.mesh.position.set((c.k - (teams[0].members.length - 1) / 2) * VW * .16, VH * .3, -3); c.mesh.scale.setScalar(Math.min(VH * .16, VW * .13) / cw); c.mesh.rotation.set(0, 0, 0); c.mesh.material.opacity = .75; }
          continue; }
        const t = et - c.t0; if (t < 0) continue;
        const k = t / SW; c.mesh.visible = true;
        const deck = new T.Vector3(phone.position.x, phone.position.y + cardY, phone.position.z + .3);
        if (k < .25){ const e = ease(k / .25); c.mesh.position.copy(deck); c.mesh.position.z += .02 + e * .04; c.mesh.scale.setScalar(.9 + .1 * e); c.mesh.rotation.set(0, 0, 0);
          thumb.material.opacity = Math.min(1, thumb.material.opacity + dt * 6); thumb.position.set(deck.x + cw * .1, deck.y - chh * .3, 2); }
        else if (k < .55){ const e = ease((k - .25) / .3); c.mesh.position.set(deck.x + c.dx * cw * .35 * e, deck.y + c.dy * chh * .2 * e, deck.z + .06); c.mesh.rotation.z = -c.dx * .18 * e; c.st.material.opacity = e;
          thumb.position.set(c.mesh.position.x + cw * .1, c.mesh.position.y - chh * .3, 2); }
        else if (k < 1){ const e = ease((k - .55) / .45), P = teams[c.ti]._pile, s = P.mw / cw;
          const from = new T.Vector3(deck.x + c.dx * cw * .35, deck.y + c.dy * chh * .2, deck.z + .06);
          c.mesh.position.lerpVectors(from, c.slot, e); c.mesh.position.z += Math.sin(e * Math.PI) * 2.5;
          c.mesh.scale.setScalar(1 + (s - 1) * e); c.mesh.rotation.z = -c.dx * .18 * (1 - e) + c.dx * Math.sin(e * Math.PI) * -.6; c.mesh.rotation.y = c.dx * Math.sin(e * Math.PI) * .8;
          c.st.material.opacity = 1 - e * .8; thumb.material.opacity = Math.max(0, thumb.material.opacity - dt * 5); }
        else { c.done = true;
          if (c.ti === 0){ heartsBurst(c.slot, 10); word('¡MATCH!', c.slot.clone().add(new T.Vector3(0, .8, 1)), ['#fff', '#ffd1e3', '#ff4f7b']); S && S.zap(880); S && S.zap(1320); }
          else { heartsBurst(c.slot, 6, true); word(c.word, c.slot.clone().add(new T.Vector3(0, .8, 1)), ['#fff', '#d4d4d8', c.col]); S && S.zap(200); } }
      }
      labels.forEach((l, i) => { const show = win ? (i === 0 && !love && !sad) : et > tEnd - 1; l.material.opacity = Math.max(0, Math.min(1, l.material.opacity + (show ? dt * 2 : -dt * 2))); });
      if (sad && !labels.sadOne){ labels.sadOne = true; const s = new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas('Ganan: ' + teams[0].name + ' · tú, sin match 💔', { size: 70, w: 1200, h: 150, glow: '#6a8aff', weight: 800 })), transparent: true, depthTest: false })); s.position.set(0, VH * .42, 1); const w = Math.min(VW * .92, 8); s.scale.set(w, w * 150 / 1200, 1); scene.add(s); q.visible = false; }
      for (let i = fxList.length - 1; i >= 0; i--){ const f = fxList[i]; f.t += dt; const k = Math.min(1, f.t / f.d); f.u(f.o, k, dt); if (k >= 1){ scene.remove(f.o); f.o.material.map && f.o.material.map !== heartTex && f.o.material.map !== brokenTex && f.o.material.map.dispose(); f.o.material.dispose(); fxList.splice(i, 1); } }
      cam.position.x = Math.sin(et * .35) * .5; cam.position.y = Math.sin(et * .27) * .3; cam.lookAt(0, 0, 0);
    });
    const st = fxStop; fxStop = () => { S && S.close(); const snd = $('#drownSound'); if (snd) snd.playbackRate = 1; st(); };
  }
