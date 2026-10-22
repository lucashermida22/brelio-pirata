import { gg } from './gg.js';
import { $, cardCanvas, loadImg, loadThree, photoFor, rand, rrect, threeNS } from '@kit';


// =====================================================================
//  GG EZ 3D (Three.js): escenario esports en directo. Pantalla del
//  streamer, letras de vóxeles, túnel hexagonal al ritmo, podios en arco.
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
  const T = threeNS(), layer = $('#vsLayer'), fx = $('#vsFx'), beat = A.beat / 1000;
  const imgs = await Promise.all([loadImg($('#vsHero').src), ...teams.flatMap(t => t.members.map(m => loadImg(photoFor(m.name))))]);
  if (!X.isOpen()) return;
  const heroImg = imgs.shift();
  const canvas = document.createElement('canvas'); canvas.className = 'three-cv'; fx.prepend(canvas);
  const flash = document.createElement('div'); flash.className = 'three-flash gg'; fx.appendChild(flash);
  let W = innerWidth, H = innerHeight, renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch(e) { canvas.remove(); flash.remove(); return false; }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(W, H, false);
  renderer.outputEncoding = T.sRGBEncoding; renderer.setClearColor(0x05010d, 1);
  const scene = new T.Scene(); scene.fog = new T.Fog(0x05010d, 18, 95);
  const cam = new T.PerspectiveCamera(50, W / H, .1, 400); cam.position.set(0, 0, 15);
  const VH = 2 * 15 * Math.tan(T.MathUtils.degToRad(25)), VW = VH * W / H, narrow = W / H < .8;
  let composer = null;
  try { if (T.EffectComposer && T.UnrealBloomPass){ composer = new T.EffectComposer(renderer); composer.addPass(new T.RenderPass(scene, cam)); composer.addPass(new T.UnrealBloomPass(new T.Vector2(W, H), .85, .5, .8)); } } catch(e) { composer = null; }
  const onResize = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); composer && composer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); };
  addEventListener('resize', onResize);
  const tex = c => { const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; };
  const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };
  const CY = new T.Color('#00f0ff'), MG = new T.Color('#ff2bd6'), BL = new T.Color('#3d8bff');
  const world = new T.Group(); scene.add(world);
  const offX = !narrow && W >= 900 ? -VW * .095 : 0; world.position.x = offX;   // deja hueco al chat

  // luces
  scene.add(new T.AmbientLight(0x6070a0, .55));
  const key = new T.DirectionalLight(0xffffff, .9); key.position.set(3, 6, 10); scene.add(key);
  const pl1 = new T.PointLight(0x00f0ff, 2.2, 40), pl2 = new T.PointLight(0xff2bd6, 2.2, 40); scene.add(pl1, pl2);

  // suelo y techo de rejilla + túnel hexagonal
  const floorY = narrow ? -6.4 : -5.2;
  const grid = new T.GridHelper(240, 120, 0xff2bd6, 0x00c8ff); grid.position.y = floorY; grid.material.transparent = true; grid.material.opacity = .55; scene.add(grid);
  const grid2 = grid.clone(); grid2.position.y = 11; grid2.material = grid.material.clone(); grid2.material.opacity = .18; scene.add(grid2);
  const hexes = [];
  for (let i = 0; i < 18; i++){
    const g = new T.BufferGeometry().setFromPoints(Array.from({ length: 7 }, (_, k) => new T.Vector3(Math.cos(k / 6 * Math.PI * 2 + Math.PI / 6), Math.sin(k / 6 * Math.PI * 2 + Math.PI / 6), 0)));
    const l = new T.Line(g, new T.LineBasicMaterial({ color: i % 2 ? 0xff2bd6 : 0x00f0ff, ...AB, opacity: .8 }));
    l.position.set(0, 1, -12 - i * 9); l.scale.setScalar(13); scene.add(l); hexes.push(l);
  }

  // pantalla del streamer (la foto) con badge LIVE
  const hT = heroImg ? new T.Texture(heroImg) : null; if (hT){ hT.encoding = T.sRGBEncoding; hT.needsUpdate = true; }
  const metal = new T.MeshStandardMaterial({ color: 0x14102a, metalness: .8, roughness: .3, emissive: 0x220a44, emissiveIntensity: .6 });
  const monitor = new T.Group(); world.add(monitor);
  const scr = new T.Mesh(new T.BoxGeometry(.5625, 1, .06), [metal, metal, metal, metal, new T.MeshBasicMaterial({ map: hT, color: 0xd6d6d6 }), metal]);
  const bezel = new T.Mesh(new T.BoxGeometry(.5625 * 1.08, 1.06, .04), new T.MeshBasicMaterial({ color: 0x00f0ff }));
  bezel.position.z = -.04; monitor.add(bezel, scr);
  const liveC = document.createElement('canvas'); liveC.width = 256; liveC.height = 80;
  { const g = liveC.getContext('2d'); rrect(g, 4, 8, 248, 64, 14); g.fillStyle = '#ff2a4f'; g.fill(); g.fillStyle = '#fff'; g.font = '900 40px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('● LIVE', 128, 42); }
  const live = new T.Mesh(new T.PlaneGeometry(.3, .094), new T.MeshBasicMaterial({ map: tex(liveC), transparent: true }));
  live.position.set(-.13, .43, .045); monitor.add(live);
  const monBig = VH * .55, monSmall = VH * (narrow ? .17 : .2), monTopY = VH / 2 - VH * .03 - monSmall / 2;
  monitor.scale.setScalar(monBig); monitor.position.set(0, 0, -90);
  monitor.visible = !win;

  // letras de vóxeles
  const vGeo = new T.BoxGeometry(1, 1, 1);
  const vMat = new T.MeshStandardMaterial({ color: 0xffffff, metalness: .3, roughness: .35, emissive: 0x1840a0, emissiveIntensity: .55 });
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
  const dummy = new T.Object3D();
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
  const side = new T.MeshStandardMaterial({ color: 0x0b0620, metalness: .7, roughness: .3 });
  const cards = [], pedestals = [], spots = [];
  const spotC = document.createElement('canvas'); spotC.width = 4; spotC.height = 256;
  { const g = spotC.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); }
  const spotTex = tex(spotC);
  let ci = 0;
  teams.forEach((t, ti) => {
    const [cx, cy] = centers[ti], col = new T.Color(t.bar);
    const grp = new T.Group(); grp.position.set(cx, cy, 0);
    grp.rotation.y = n > 1 && !narrow ? -cx / (usableW / 2) * .32 : 0; world.add(grp);
    // foco
    const spot = new T.Mesh(new T.ConeGeometry(teamW * .48, 16, 40, 1, true), new T.MeshBasicMaterial({ map: spotTex, color: col, ...AB, opacity: 0, side: T.DoubleSide }));
    spot.position.set(0, 8 - teamH / 2 + .2, -1.2); grp.add(spot); spots.push(spot);
    t.members.forEach((m, k) => {
      const tier = Math.floor(k / perRow), inTier = Math.min(perRow, t.members.length - tier * perRow), idx = k % perRow;
      const spread = Math.min(1.1, (narrow ? .12 : .26) * (inTier - 1)), th = inTier > 1 ? -spread + (2 * spread) * idx / (inTier - 1) : 0;
      const R = cw * inTier * .55 / Math.max(.4, spread);
      const x = Math.sin(th) * Math.min(R, 40), z = (Math.cos(th) - 1) * Math.min(R, 40) - tier * cw * .9;
      const baseY = -teamH / 2 + .25 + tier * ch * .62;
      const ped = new T.Mesh(new T.CylinderGeometry(cw * .52, cw * .6, .3, 6), new T.MeshStandardMaterial({ color: 0x120a26, metalness: .7, roughness: .25, emissive: col, emissiveIntensity: .15 }));
      ped.position.set(x, baseY - 6, z); ped.rotation.y = th; grp.add(ped);
      pedestals.push({ mesh: ped, y: baseY, t0: 0 });
      const mats = [side, side, side, side, new T.MeshBasicMaterial({ map: tex(cardCanvas(m, t.bar, imgs[ci++])), color: 0xd4d4d4, transparent: true }), new T.MeshBasicMaterial({ map: backTex, color: 0xcccccc })];
      const card = new T.Mesh(new T.BoxGeometry(cw, ch, .07), mats);
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

  // efectos
  const fxList = [];
  const ringGeo = new T.RingGeometry(.9, 1, 64);
  function floorRing(parent, pos, color, maxR, dur){
    const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color, ...AB, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); parent.add(m);
    fxList.push({ obj: m, parent, t: 0, dur, upd: (o, k) => { o.scale.setScalar(.1 + maxR * (1 - Math.pow(1 - k, 3))); o.material.opacity = 1 - k; } });
  }
  // confeti de cubitos
  const CN = 420, conf = new T.InstancedMesh(new T.BoxGeometry(.14, .14, .03), new T.MeshBasicMaterial({ color: 0xffffff }), CN), cData = [];
  for (let i = 0; i < CN; i++){ cData.push({ p: new T.Vector3((Math.random() - .5) * VW, VH / 2 + Math.random() * VH, (Math.random() - .5) * 6), v: .8 + Math.random() * 1.6, r: Math.random() * 6, s: (Math.random() - .5) * 8 }); conf.setColorAt(i, new T.Color().setHSL(Math.random(), 1, .6)); }
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
  let raf, t0 = performance.now(), prev = t0, punch = 0, lastBeat = -1, flashed = false;
  function frame(now){
    const et = (now - t0) / 1000, dt = Math.min(.05, (now - prev) / 1000); prev = now;
    const bi = Math.floor(et / beat), bk = (et % beat) / beat, pulse = Math.pow(1 - bk, 3);
    if (bi !== lastBeat){ lastBeat = bi; punch = 1; }
    punch *= Math.pow(.001, dt);

    // túnel y rejillas al ritmo
    const spd = 30 + (et < tUp ? 60 * (et / tUp) : 0);
    hexes.forEach((h, i) => { h.position.z += spd * dt; if (h.position.z > 2) h.position.z -= 18 * 9; h.rotation.z = et * .3 + i * .08; h.scale.setScalar(13 + pulse * 1.4); h.material.opacity = .25 + .6 * pulse * (i % 2 ? 1 : .6); });
    grid.position.z = (et * spd * .5) % 2; grid2.position.z = grid.position.z;
    grid.material.opacity = .35 + .35 * pulse;
    pl1.position.set(Math.sin(et * 1.3) * 9, 3, 6); pl2.position.set(Math.cos(et * 1.1) * 9, -2, 6);
    pl1.intensity = 1.6 + 1.6 * pulse; pl2.intensity = 1.6 + 1.6 * pulse;

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
    bezel.material.color.copy(CY).lerp(MG, .5 + .5 * Math.sin(et * 4));

    updVoxels(title, et, pulse);
    vsList.forEach(v => { updVoxels(v, et, pulse); v.grp.rotation.y = et > tVs ? (et - tVs) * Math.PI / (beat * 4) : 0; v.grp.scale.setScalar(1 + pulse * .12); });

    // podios
    pedestals.forEach(p => {
      const k = Math.max(0, Math.min(1, (et - p.t0) / (beat * 1.5)));
      p.mesh.position.y = p.y - 6 * (1 - outBack(k)) - .15;
      p.mesh.material.emissiveIntensity = .15 + .5 * pulse * k + (et > tDone ? .4 : 0);
    });
    spots.forEach(s => { s.material.opacity = et > tPeds ? Math.min(.22, (et - tPeds) * .3) * (.75 + .25 * pulse) + (et > tDone ? .08 : 0) : 0; s.rotation.y = et * .4; });

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
      const f = fxList[i]; f.t += dt; const k = Math.min(1, f.t / f.dur); f.upd(f.obj, k);
      if (k >= 1){ f.parent.remove(f.obj); f.obj.material.dispose(); fxList.splice(i, 1); }
    }

    // cámara: golpe de zoom en cada beat + barrido orbital al final
    const fov = 50 - punch * 1.6;
    if (Math.abs(cam.fov - fov) > .01){ cam.fov = fov; cam.updateProjectionMatrix(); }
    const sweep = et > tDone ? Math.min(1, (et - tDone) / 1.5) : 0;
    cam.position.set(Math.sin((et - tDone) * .55) * 3.2 * sweep, Math.sin(et * .7) * .25 + sweep * 1.2, 15 - sweep * 1.2);
    cam.lookAt(offX * .3 * sweep, -sweep * .6, 0);

    composer ? composer.render() : renderer.render(scene, cam);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  _vs.fxStop = () => {
    cancelAnimationFrame(raf); removeEventListener('resize', onResize);
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { m.map && m.map.dispose(); m.dispose(); }); });
    try { renderer.dispose(); renderer.forceContextLoss(); } catch(e) {}
    canvas.remove(); flash.remove();
  };
  return true;
}
