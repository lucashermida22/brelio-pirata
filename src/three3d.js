
  // =====================================================================
  //  SINGULARIDAD 3D (Three.js): warp → Big Bang → agujero negro que
  //  escupe a cada jugador en espiral hasta su formación.
  // =====================================================================
  const threeOK = () => !!(window.THREE && window.THREE.WebGLRenderer);
  const loadImg = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

  function rrect(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x+r, y); g.arcTo(x+w, y, x+w, y+h, r); g.arcTo(x+w, y+h, x, y+h, r); g.arcTo(x, y+h, x, y, r); g.arcTo(x, y, x+w, y, r); g.closePath(); }
  function cardCanvas(m, color, img){
    const c = document.createElement('canvas'); c.width = 256; c.height = 340;
    const g = c.getContext('2d');
    g.shadowColor = color; g.shadowBlur = 26;
    rrect(g, 12, 12, 232, 316, 26); g.fillStyle = '#0c0620'; g.fill();
    g.shadowBlur = 0; g.lineWidth = 7; g.strokeStyle = color; g.stroke();
    g.save(); rrect(g, 26, 26, 204, 204, 18); g.clip();
    if (img){ const s = Math.min(img.width, img.height); g.drawImage(img, (img.width - s)/2, (img.height - s)/2, s, s, 26, 26, 204, 204); }
    else { g.fillStyle = '#fff'; g.fillRect(26, 26, 204, 204); g.font = '128px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emojiFor(m.name), 128, 136); }
    g.restore();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    let fs = 30; const font = s => `800 ${s}px Orbitron, "Plus Jakarta Sans", system-ui, sans-serif`;
    g.font = font(fs); while (g.measureText(m.name).width > 216 && fs > 14){ fs -= 2; g.font = font(fs); }
    g.fillText(m.name, 128, m.role ? 270 : 284);
    if (m.role){
      g.font = '700 18px Geist, system-ui, sans-serif';
      const w = g.measureText(m.role).width + 22;
      rrect(g, 128 - w/2, 288, w, 28, 8); g.fillStyle = LANE_COLORS[m.role] || '#71717a'; g.fill();
      g.fillStyle = '#fff'; g.fillText(m.role, 128, 308);
    }
    return c;
  }
  function textCanvas(text, { size = 64, w = 1024, h = 160, fill = '#fff', glow = '#3d8bff', font = 'Orbitron, "Plus Jakarta Sans", system-ui, sans-serif', weight = 900, italic = false, grad = null } = {}){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    let s = size; const f = () => `${italic ? 'italic ' : ''}${weight} ${s}px ${font}`;
    g.font = f(); while (g.measureText(text).width > w * .92 && s > 16){ s -= 4; g.font = f(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = glow; g.shadowBlur = s * .45;
    if (grad){ const gr = g.createLinearGradient(0, h*.2, 0, h*.8); grad.forEach((col, i) => gr.addColorStop(i / (grad.length - 1), col)); g.fillStyle = gr; } else g.fillStyle = fill;
    g.fillText(text, w/2, h/2); g.shadowBlur = 0; g.fillText(text, w/2, h/2);
    return c;
  }
  function glowCanvas(stops){
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return c;
  }

  // ---------- sonido sintetizado (Web Audio) ----------
  function synth(){
    let ctx; try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; }
    const master = ctx.createGain(); master.gain.value = .6; master.connect(ctx.destination);
    const out = ctx.createDynamicsCompressor(); out.connect(master);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const now = () => ctx.currentTime;
    const env = (g, a, peak, dur) => { g.gain.setValueAtTime(.0001, now()); g.gain.exponentialRampToValueAtTime(peak, now() + a); g.gain.exponentialRampToValueAtTime(.0001, now() + dur); };
    const live = [];
    return {
      riser(dur){
        const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 5;
        f.frequency.setValueAtTime(140, now()); f.frequency.exponentialRampToValueAtTime(7000, now() + dur);
        const g = ctx.createGain(); g.gain.setValueAtTime(.0001, now()); g.gain.exponentialRampToValueAtTime(.8, now() + dur); g.gain.setValueAtTime(0, now() + dur);
        s.connect(f).connect(g).connect(out); s.start(); s.stop(now() + dur + .05);
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(50, now()); o.frequency.exponentialRampToValueAtTime(900, now() + dur);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
        const og = ctx.createGain(); og.gain.setValueAtTime(.0001, now()); og.gain.exponentialRampToValueAtTime(.16, now() + dur); og.gain.setValueAtTime(0, now() + dur);
        o.connect(lp).connect(og).connect(out); o.start(); o.stop(now() + dur + .05);
      },
      boom(big){
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(big ? 160 : 240, now()); o.frequency.exponentialRampToValueAtTime(big ? 28 : 55, now() + (big ? 1.3 : .35));
        const g = ctx.createGain(); env(g, .005, big ? 1 : .45, big ? 1.8 : .45); o.connect(g).connect(out); o.start(); o.stop(now() + 2);
        const s = ctx.createBufferSource(); s.buffer = nb;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(big ? 4000 : 2000, now()); f.frequency.exponentialRampToValueAtTime(90, now() + (big ? 1.5 : .3));
        const ng = ctx.createGain(); env(ng, .005, big ? .9 : .22, big ? 1.6 : .35); s.connect(f).connect(ng).connect(out); s.start(); s.stop(now() + 2);
      },
      zap(p){
        const o = ctx.createOscillator(); o.type = 'square';
        o.frequency.setValueAtTime(p, now()); o.frequency.exponentialRampToValueAtTime(p / 5, now() + .2);
        const g = ctx.createGain(); env(g, .003, .1, .22); o.connect(g).connect(out); o.start(); o.stop(now() + .3);
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(p * 2, now() + .05);
        const g2 = ctx.createGain(); g2.gain.setValueAtTime(.0001, now()); g2.gain.exponentialRampToValueAtTime(.08, now() + .06); g2.gain.exponentialRampToValueAtTime(.0001, now() + .5);
        o2.connect(g2).connect(out); o2.start(); o2.stop(now() + .55);
      },
      drone(){
        [55, 82.41, 110, 164.8].forEach((fq, i) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq; o.detune.value = (i - 1.5) * 7;
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
          const l = ctx.createOscillator(); l.frequency.value = .12 + i * .06;
          const lg = ctx.createGain(); lg.gain.value = 240; l.connect(lg).connect(f.frequency);
          const g = ctx.createGain(); g.gain.setValueAtTime(0, now()); g.gain.linearRampToValueAtTime(.055, now() + 2.5);
          o.connect(f).connect(g).connect(out); o.start(); l.start(); live.push(o, l);
        });
      },
      chord(){
        [220, 277.18, 329.63, 440, 554.37, 659.25].forEach((fq, i) => {
          const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = fq;
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(220, now()); f.frequency.exponentialRampToValueAtTime(5200, now() + 1.6);
          const g = ctx.createGain(); g.gain.setValueAtTime(0, now()); g.gain.linearRampToValueAtTime(.05, now() + .35); g.gain.exponentialRampToValueAtTime(.0001, now() + 4.5);
          o.connect(f).connect(g).connect(out); o.start(); o.stop(now() + 4.6);
        });
      },
      close(){ try { master.gain.setTargetAtTime(0, now(), .12); setTimeout(() => { live.forEach(n => { try { n.stop(); } catch(e) {} }); ctx.close(); }, 600); } catch(e) {} }
    };
  }

  // ---------- escena ----------
  async function playThree(teams, A, win){
    const T = THREE, layer = $('#vsLayer'), fx = $('#vsFx');
    const imgs = await Promise.all([loadImg($('#vsHero').src), ...teams.flatMap(t => t.members.map(m => loadImg(photoFor(m.name))))]);
    if (!vsOpen) return;
    const heroImg = imgs.shift();
    const canvas = document.createElement('canvas'); canvas.className = 'three-cv'; fx.appendChild(canvas);
    const flash = document.createElement('div'); flash.className = 'three-flash'; fx.appendChild(flash);
    let W = innerWidth, H = innerHeight;
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
    catch(e) { canvas.remove(); flash.remove(); toast('Tu navegador no tiene WebGL. Va otra animación.'); vsOpen = false; layer.className = ''; playVersus(teams, vsPending, { win, anim: 'ggez' }); return; }
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(W, H, false);
    renderer.outputEncoding = T.sRGBEncoding; renderer.setClearColor(0x03000c, 1);
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(50, W / H, .1, 800); cam.position.set(0, 0, 14);
    const VH = 2 * 14 * Math.tan(T.MathUtils.degToRad(25)), VW = VH * W / H;
    const yAt = f => VH / 2 - f * VH;
    let composer = null;
    try {
      if (T.EffectComposer && T.UnrealBloomPass){
        composer = new T.EffectComposer(renderer);
        composer.addPass(new T.RenderPass(scene, cam));
        composer.addPass(new T.UnrealBloomPass(new T.Vector2(W, H), .9, .55, .82));
      }
    } catch(e) { composer = null; }
    const onResize = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); composer && composer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); };
    addEventListener('resize', onResize);
    const tex = c => { const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; };
    const add = (o) => (scene.add(o), o);
    const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };
    const dot = tex(glowCanvas([[0, 'rgba(255,255,255,1)'], [.35, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]));
    const PT = { ...AB, map: dot, alphaTest: .01 };

    // estrellas de fondo
    {
      const n = 2600, p = new Float32Array(n * 3), c = new Float32Array(n * 3), col = new T.Color();
      for (let i = 0; i < n; i++){
        const r = 90 + Math.random() * 220, th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
        p.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), -Math.abs(r * Math.cos(ph))], i * 3);
        col.setHSL(.55 + Math.random() * .35, .6, .6 + Math.random() * .4); c.set([col.r, col.g, col.b], i * 3);
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('color', new T.BufferAttribute(c, 3));
      add(new T.Points(g, new T.PointsMaterial({ size: .45, vertexColors: true, ...PT, opacity: .55 })));
    }

    // túnel de hiperespacio (estelas)
    const TN = 2200, tPos = new Float32Array(TN * 6), tCol = new Float32Array(TN * 6), tData = [];
    {
      const col = new T.Color();
      for (let i = 0; i < TN; i++){
        const a = Math.random() * Math.PI * 2, r = 2.2 + Math.random() * 7, z = -260 + Math.random() * 270;
        tData.push({ a, r, z });
        col.setHSL(.5 + Math.random() * .4, 1, .55 + Math.random() * .25);
        tCol.set([col.r, col.g, col.b, col.r * .1, col.g * .1, col.b * .1], i * 6);
      }
    }
    const tGeo = new T.BufferGeometry(); tGeo.setAttribute('position', new T.BufferAttribute(tPos, 3)); tGeo.setAttribute('color', new T.BufferAttribute(tCol, 3));
    const tMat = new T.LineBasicMaterial({ vertexColors: true, ...AB, opacity: 1 });
    const tunnel = add(new T.LineSegments(tGeo, tMat));

    // héroe (la foto) con marco brillante
    const heroGroup = add(new T.Group());
    const hT = heroImg ? new T.Texture(heroImg) : null; if (hT){ hT.encoding = T.sRGBEncoding; hT.needsUpdate = true; }
    const hero = new T.Mesh(new T.PlaneGeometry(.5625, 1), new T.MeshBasicMaterial({ map: hT, color: hT ? 0xd8d8d8 : 0xff55aa }));
    const halo = new T.Mesh(new T.PlaneGeometry(.5625 * 1.09, 1.05), new T.MeshBasicMaterial({ color: 0x66ccff, ...AB, opacity: .9 }));
    halo.position.z = -.01; heroGroup.add(halo, hero);
    const heroBig = VH * .6, heroSmall = VH * .2, heroTopY = yAt(.022) - heroSmall / 2;
    heroGroup.position.set(0, 0, -140); heroGroup.scale.setScalar(heroBig);
    heroGroup.visible = !win;

    // ---- distribución de equipos ----
    const narrow = W / H < .8, n = teams.length, per = Math.max(...teams.map(t => t.members.length));
    const aTop = yAt(.32), aBot = yAt(.9), arenaH = aTop - aBot, arenaCY = (aTop + aBot) / 2;
    const maxCols = narrow ? 4 : Math.max(1, Math.ceil(Math.sqrt(per * (n <= 2 ? 1.3 : .8))));
    const cols = Math.ceil(per / Math.ceil(per / maxCols)), rows = Math.ceil(per / cols);
    const vsGap = n > 1 ? (narrow ? arenaH * .14 : VW * .1) : 0;
    const centers = []; let teamW, teamH;
    if (narrow){ teamW = VW * .92; teamH = (arenaH - (n - 1) * vsGap) / n; for (let i = 0; i < n; i++) centers.push([0, aTop - teamH / 2 - i * (teamH + vsGap)]); }
    else { teamW = Math.min((VW * .92 - (n - 1) * vsGap) / n, n === 1 ? VW * .5 : 99); teamH = arenaH; const tot = n * teamW + (n - 1) * vsGap; for (let i = 0; i < n; i++) centers.push([-tot / 2 + teamW / 2 + i * (teamW + vsGap), arenaCY]); }
    const labelH = Math.min(teamH * .12, .8), GAP = 1.12;
    const cw = Math.min(teamW / (cols * GAP), (teamH - labelH) / (rows * GAP * 1.33)), ch = cw * 1.33;
    const diskPos = new T.Vector3(0, n > 1 ? (narrow ? (centers[0][1] + centers[1][1]) / 2 : arenaCY) : arenaCY, -2.5);

    // agujero negro + disco de acreción
    const disk = add(new T.Group()); disk.position.copy(diskPos); disk.scale.setScalar(.001);
    const DN = 7000, dPos = new Float32Array(DN * 3), dCol = new Float32Array(DN * 3), dData = [];
    {
      const cIn = new T.Color('#fff4c4'), cMid = new T.Color('#ff7a2e'), cOut = new T.Color('#7b2cff'), col = new T.Color();
      for (let i = 0; i < DN; i++){
        const r = .75 + Math.pow(Math.random(), 1.6) * 4.2;
        dData.push({ r, a: Math.random() * Math.PI * 2, y: (Math.random() - .5) * .12 * r });
        const t = (r - .75) / 4.2; t < .35 ? col.copy(cIn).lerp(cMid, t / .35) : col.copy(cMid).lerp(cOut, (t - .35) / .65);
        dCol.set([col.r, col.g, col.b], i * 3);
      }
    }
    const dGeo = new T.BufferGeometry(); dGeo.setAttribute('position', new T.BufferAttribute(dPos, 3)); dGeo.setAttribute('color', new T.BufferAttribute(dCol, 3));
    const diskPts = new T.Points(dGeo, new T.PointsMaterial({ size: .11, vertexColors: true, ...PT }));
    const diskTilt = new T.Group(); diskTilt.rotation.x = 1.18; diskTilt.rotation.z = .18; diskTilt.add(diskPts); disk.add(diskTilt);
    disk.add(new T.Mesh(new T.SphereGeometry(.62, 48, 48), new T.MeshBasicMaterial({ color: 0x000000 })));
    const ringMesh = new T.Mesh(new T.TorusGeometry(.7, .035, 12, 96), new T.MeshBasicMaterial({ color: 0xffd9a0, ...AB })); disk.add(ringMesh);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: tex(glowCanvas([[0, 'rgba(255,200,120,.9)'], [.25, 'rgba(255,110,40,.45)'], [.6, 'rgba(140,40,255,.18)'], [1, 'rgba(0,0,0,0)']])), ...AB }));
    glow.scale.setScalar(7); glow.position.z = -.5; disk.add(glow);

    // efectos: ondas, explosiones, fuegos artificiales
    const fxList = [];
    const ringGeo = new T.RingGeometry(.92, 1, 96);
    function shock(pos, color, maxR, dur, facing = true){
      const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color, ...AB, side: T.DoubleSide }));
      m.position.copy(pos); if (!facing) m.rotation.x = 1.18; add(m);
      fxList.push({ obj: m, t: 0, dur, upd: (o, k) => { o.scale.setScalar(.1 + maxR * (1 - Math.pow(1 - k, 3))); o.material.opacity = 1 - k; } });
    }
    function burst(pos, count, hue, speed, size = .09, life = 1.8){
      const p = new Float32Array(count * 3), c = new Float32Array(count * 3), v = [], col = new T.Color();
      for (let i = 0; i < count; i++){
        p.set([pos.x, pos.y, pos.z], i * 3);
        const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1), s = speed * (.3 + Math.random() * .7);
        v.push(Math.sin(ph) * Math.cos(th) * s, Math.sin(ph) * Math.sin(th) * s, Math.cos(ph) * s);
        col.setHSL(hue < 0 ? Math.random() : hue + (Math.random() - .5) * .08, 1, .6); c.set([col.r, col.g, col.b], i * 3);
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('color', new T.BufferAttribute(c, 3));
      const pts = add(new T.Points(g, new T.PointsMaterial({ size: size * 2, vertexColors: true, ...PT })));
      fxList.push({ obj: pts, t: 0, dur: life, upd: (o, k, dt) => {
        const a = o.geometry.attributes.position.array;
        for (let i = 0; i < count; i++){ a[i*3] += v[i*3] * dt; a[i*3+1] += v[i*3+1] * dt - k * .6 * dt; a[i*3+2] += v[i*3+2] * dt; v[i*3] *= .965; v[i*3+1] *= .965; v[i*3+2] *= .965; }
        o.geometry.attributes.position.needsUpdate = true; o.material.opacity = 1 - k * k;
      }});
    }

    // VS y nombres de equipo
    const sprites = [];
    const mkSprite = (c, h) => { const s = new T.Sprite(new T.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false })); s.scale.set(h * c.width / c.height, h, 1); s.userData.base = s.scale.clone(); s.scale.multiplyScalar(.001); add(s); sprites.push(s); return s; };
    const vsSprites = [];
    for (let i = 1; i < n; i++){
      const vs = mkSprite(textCanvas('VS', { size: 220, w: 512, h: 300, italic: true, grad: ['#ffffff', '#ffe08a', '#ff5bd2'], glow: '#ff3aa8' }), narrow ? vsGap * .95 : Math.min(vsGap * 1.1, VH * .16));
      const [x1, y1] = centers[i - 1], [x2, y2] = centers[i];
      vs.position.set((x1 + x2) / 2, (y1 + y2) / 2, .8); vsSprites.push(vs);
    }
    const labels = teams.map((t, i) => {
      const s = mkSprite(textCanvas((win ? '🏆 ' : '') + t.name, { size: 70, w: 1024, h: 130, glow: t.bar, weight: 800 }), labelH * .8);
      s.position.set(centers[i][0], centers[i][1] + teamH / 2 - labelH / 2, .3);
      return s;
    });

    // órbitas finales (una elipse por equipo)
    const orbRx = Math.min(teamW * .4, (n > 1 && !narrow ? teamW * .4 : VW * .3)), orbRy = (teamH - labelH) * .34;
    const orbits = centers.map(([x, y], i) => {
      const pts = new T.EllipseCurve(0, 0, orbRx, orbRy, 0, Math.PI * 2).getPoints(120).map(p => new T.Vector3(p.x, p.y, 0));
      const l = new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: new T.Color(teams[i].bar), ...AB, opacity: 0 }));
      l.position.set(x, y - labelH * .2, .2); add(l); return l;
    });
    // cartas
    const cards = [];
    let ci = 0;
    teams.forEach((t, ti) => {
      const [cx, cy] = centers[ti], rotY = n > 1 && !narrow ? -cx / (VW / 2) * .5 : 0;
      const inner = teamH - labelH, gridTop = cy + teamH / 2 - labelH;
      t.members.forEach((m, k) => {
        const r = Math.floor(k / cols), cInRow = Math.min(cols, t.members.length - r * cols), c = k % cols;
        const x = cx + (c - (cInRow - 1) / 2) * cw * GAP;
        const y = gridTop - inner / 2 + ((rows - 1) / 2 - r) * ch * GAP;
        const mesh = new T.Mesh(new T.PlaneGeometry(cw, ch), new T.MeshBasicMaterial({ map: tex(cardCanvas(m, t.bar, imgs[ci++])), color: 0xd2d2d2, transparent: true, side: T.DoubleSide }));
        mesh.position.copy(diskPos); mesh.scale.setScalar(.001); add(mesh);
        cards.push({ mesh, ti, k, end: new T.Vector3(x, y, 0), rotY, color: new T.Color(t.bar), launched: -1, landed: false, dir: ti % 2 ? -1 : 1 });
      });
    });
    // orden alternado entre equipos
    const order = []; for (let r = 0; r < per; r++) teams.forEach((t, ti) => { const c = cards.find(x => x.ti === ti && x.k === r); if (c) order.push(c); });

    // ---- línea de tiempo ----
    const S = synth(); S && S.riser(2.4); S && S.drone();
    const tBoom = 2.4, tUp = 3.0, tDisk = 3.2, tVs = 4.0, tCards = 4.5, FLY = 1.15;
    const step = Math.max(.17, Math.min(.32, 2.6 / order.length));
    order.forEach((c, i) => c.launched = tCards + i * step);
    const tDone = tCards + (order.length - 1) * step + FLY + .6;
    later(() => { layer.classList.remove('intro'); layer.classList.add('up'); }, tUp * 1000);
    later(() => { layer.classList.add('done'); }, tDone * 1000);
    later(closeVersus, (tDone + (A.hold || 4000) / 1000) * 1000);

    const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const outBack = k => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
    let shake = 0, boomed = false, vsShown = false, lastFw = 0, raf, t0 = performance.now(), prev = t0;

    function frame(now){
      const et = (now - t0) / 1000, dt = Math.min(.05, (now - prev) / 1000); prev = now;

      // túnel
      const speed = et < tBoom ? 40 + 260 * Math.pow(et / tBoom, 2) : Math.max(6, 300 * Math.exp(-(et - tBoom) * 2.2));
      const len = Math.min(16, speed * .05);
      for (let i = 0; i < TN; i++){
        const d = tData[i]; d.z += speed * dt; if (d.z > 16){ d.z -= 276; }
        const x = Math.cos(d.a + et * .35) * d.r, y = Math.sin(d.a + et * .35) * d.r;
        tPos.set([x, y, d.z, x, y, d.z - len], i * 6);
      }
      tGeo.attributes.position.needsUpdate = true;
      tMat.opacity = et < tBoom ? 1 : Math.max(0, 1 - (et - tBoom) / 1.4);
      tunnel.visible = tMat.opacity > 0;

      // cámara: dolly zoom durante el warp
      const fov = et < tBoom ? 50 + 55 * (1 - ease(Math.min(1, et / tBoom))) : 50;
      if (Math.abs(cam.fov - fov) > .01){ cam.fov = fov; cam.updateProjectionMatrix(); }
      cam.rotation.z = et < tBoom ? Math.sin(et * 2.2) * .12 * (1 - et / tBoom) : 0;

      // héroe
      if (et < tBoom){
        const k = ease(Math.min(1, et / tBoom));
        heroGroup.position.set(0, 0, -140 + 140 * k);
        heroGroup.rotation.set(0, (1 - k) * Math.PI * 4, (1 - k) * Math.PI * 2);
      } else if (et < tUp){
        heroGroup.position.set(0, 0, 0); heroGroup.rotation.set(0, 0, 0);
        heroGroup.scale.setScalar(heroBig * (1 + .06 * Math.sin((et - tBoom) * 20) * Math.exp(-(et - tBoom) * 6)));
      } else {
        const k = ease(Math.min(1, (et - tUp) / .9));
        heroGroup.position.set(0, heroTopY * k, 0);
        heroGroup.scale.setScalar(heroBig + (heroSmall - heroBig) * k);
        heroGroup.rotation.y = Math.sin(et * 1.3) * .25 * k; heroGroup.rotation.z = Math.sin(et * .9) * .04 * k;
      }
      halo.material.color.setHSL((et * .15) % 1, 1, .6);

      if (!boomed && et >= tBoom){
        boomed = true; shake = 1.1;
        burst(new T.Vector3(0, 0, .5), 2600, -1, 16, .12, 2.2);
        shock(new T.Vector3(0, 0, .2), 0xffffff, 22, 1.4); shock(new T.Vector3(0, 0, .1), 0xff5bd2, 14, 1.1);
        flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        S && S.boom(true);
      }

      // disco
      if (et >= tDisk){
        const k = Math.min(1, (et - tDisk) / 1.1);
        disk.scale.setScalar(outBack(k) * (narrow ? .65 : 1) * (n > 1 ? 1 : 1.3));
        for (let i = 0; i < DN; i++){
          const d = dData[i]; d.a += dt * 2.2 / Math.pow(d.r, 1.3);
          dPos[i*3] = Math.cos(d.a) * d.r; dPos[i*3+1] = d.y; dPos[i*3+2] = Math.sin(d.a) * d.r;
        }
        dGeo.attributes.position.needsUpdate = true;
        ringMesh.scale.setScalar(1 + Math.sin(et * 6) * .03);
        glow.material.opacity = .8 + Math.sin(et * 3) * .2;
      }

      // VS + nombres
      if (et >= tVs){
        if (!vsShown){ vsShown = true; S && S.boom(false); vsSprites.forEach(v => shock(v.position, 0xffe08a, 4, .8)); shake = Math.max(shake, .4); }
        const k = Math.min(1, (et - tVs) / .7);
        sprites.forEach((s, i) => { const kk = Math.max(0, Math.min(1, (et - tVs - i * .08) / .7)); s.scale.copy(s.userData.base).multiplyScalar(Math.max(.001, outBack(kk))); });
        vsSprites.forEach(v => { v.material.rotation = Math.sin(et * 2.2) * .08; v.scale.copy(v.userData.base).multiplyScalar(outBack(k) * (1 + Math.sin(et * 7) * .04)); });
      }

      // cartas
      const cDisk = diskPos;
      for (const c of cards){
        if (c.launched < 0 || et < c.launched) continue;
        const k = Math.min(1, (et - c.launched) / FLY), e = ease(k);
        if (!c.landed){
          const sw = Math.sin(e * Math.PI) * (narrow ? 1.4 : 2.6), ang = c.k * 1.7 + e * 7 * c.dir;
          c.mesh.position.set(
            cDisk.x + (c.end.x - cDisk.x) * e + Math.cos(ang) * sw,
            cDisk.y + (c.end.y - cDisk.y) * e + Math.sin(ang) * sw * .6,
            cDisk.z + (c.end.z - cDisk.z) * e + Math.sin(e * Math.PI) * 3.5);
          c.mesh.rotation.set(Math.sin(e * Math.PI) * .6, c.rotY + (1 - e) * Math.PI * 3 * c.dir, (1 - e) * Math.PI * 2 * c.dir);
          c.mesh.scale.setScalar(Math.max(.001, e));
          if (k >= 1){
            c.landed = true; c.landT = et;
            shock(c.end.clone().setZ(.05), c.color.getHex(), cw * 1.05, .6);
            burst(c.end.clone().setZ(.3), 160, c.color.getHSL({}).h, 5, .07, 1.1);
            shake = Math.max(shake, .22); S && S.zap(520 + (c.ti * 5 + c.k) % 8 * 90);
          }
        } else {
          const lk = Math.min(1, (et - c.landT) / .35), pulse = 1 + .28 * (1 - lk) * Math.cos(lk * Math.PI * 2.5);
          // al final cada equipo se convierte en una mini galaxia: las cartas orbitan su nombre
          const ob = et > tDone + .2 ? ease(Math.min(1, (et - tDone - .2) / 1.6)) : 0;
          const Nt = teams[c.ti].members.length, [tcx, tcy] = centers[c.ti];
          const ang = (c.k / Nt) * Math.PI * 2 - Math.PI / 2 + (et - tDone) * .42 * (c.ti % 2 ? -1 : 1);
          const ox = tcx + Math.cos(ang) * orbRx, oy = tcy - labelH * .2 + Math.sin(ang) * orbRy, oz = Math.sin(ang) * 1.8 + .6;
          c.mesh.position.set(c.end.x + (ox - c.end.x) * ob, c.end.y + (oy - c.end.y) * ob, c.end.z + (oz - c.end.z) * ob);
          c.mesh.scale.setScalar(pulse * (1 - ob * .18 + ob * .14 * Math.sin(ang)));
          c.mesh.rotation.set(0, c.rotY * (1 - ob) + Math.sin(et * .9 + c.k) * .1 * ob, Math.sin(et * 1.2 + c.k) * .05 * ob);
          c.mesh.renderOrder = Math.round(oz * 10);
        }
      }

      if (et > tDone){ const ob = Math.min(1, (et - tDone) / 1.6); orbits.forEach(o => o.material.opacity = .55 * ob); labels.forEach((l, i) => { l.position.y = (centers[i][1] + teamH / 2 - labelH / 2) * (1 - ob) + (centers[i][1] - labelH * .2) * ob; }); }
      // final: fuegos artificiales en modo ganador, acorde
      if (et >= tDone && !frame.chord){ frame.chord = true; S && S.chord(); shake = Math.max(shake, .3); cards.forEach(c => shock(c.end.clone().setZ(.02), c.color.getHex(), cw * .7, .8)); }
      if (win && et >= tDone && et - lastFw > .32){
        lastFw = et;
        const p = new T.Vector3((Math.random() - .5) * VW * .9, yAt(.35 + Math.random() * .5), -1 - Math.random() * 3);
        burst(p, 420, Math.random(), 7, .1, 1.6); S && S.boom(false);
      }

      // efectos temporales
      for (let i = fxList.length - 1; i >= 0; i--){
        const f = fxList[i]; f.t += dt; const k = Math.min(1, f.t / f.dur);
        f.upd(f.obj, k, dt);
        if (k >= 1){ scene.remove(f.obj); f.obj.geometry !== ringGeo && f.obj.geometry.dispose(); f.obj.material.dispose(); fxList.splice(i, 1); }
      }

      // cámara: temblor + paneo suave al final
      shake *= Math.pow(.02, dt);
      const pan = et > tDone ? Math.min(1, (et - tDone) / 1.5) : 0;
      cam.position.set((Math.random() - .5) * shake + Math.sin((et - tDone) * .6) * .9 * pan, (Math.random() - .5) * shake, 14);
      if (et > tBoom) cam.lookAt(0, 0, 0);

      composer ? composer.render() : renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    fxStop = () => {
      cancelAnimationFrame(raf); removeEventListener('resize', onResize);
      S && S.close();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material){ o.material.map && o.material.map.dispose(); o.material.dispose(); } });
      try { renderer.dispose(); renderer.forceContextLoss(); } catch(e) {}
      canvas.remove(); flash.remove();
    };
  }
