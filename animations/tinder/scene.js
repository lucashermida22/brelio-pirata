import { $, LANE_COLORS, emojiFor, faceCanvas, heartShape, loadImg, loadThree, photoFor, popSprite, rrect, shuffle, synth, textCanvas } from '@kit';


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


// ---- geometrías redondeadas y corazones hinchados ----
function rrShape(T, w, h, r){
  const s = new T.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
// plano de esquinas redondas con UV 0..1 (para pegarle un canvas)
function rrPlane(T, w, h, r){
  const g = new T.ShapeGeometry(rrShape(T, w, h, r), 8), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + .5, p.getY(i) / h + .5);
  return g;
}
// corazón "globo": extrusión con bisel generoso y normales suaves (solo quedan aristas vivas a partir de ~50°)
function heart3D(T, BGU, size, depth = 3, hi = true){
  const pf = 2.4, g = new T.ExtrudeGeometry(heartShape(T), { depth, bevelEnabled: true, bevelSegments: hi ? 8 : 4, steps: 1, bevelSize: pf, bevelThickness: pf * 1.1, curveSegments: hi ? 36 : 18 });
  g.center(); g.rotateZ(Math.PI); g.scale(size / 22, size / 22, size / 22);
  return BGU.toCreasedNormals(g, Math.PI * .28);
}
function phoneBackCanvas(){
  const c = document.createElement('canvas'); c.width = 540; c.height = 1100; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 540, 1100); gr.addColorStop(0, '#3a1030'); gr.addColorStop(.55, '#1c0a1c'); gr.addColorStop(1, '#2a1030'); g.fillStyle = gr; g.fillRect(0, 0, 540, 1100);
  const rg = g.createRadialGradient(270, 640, 10, 270, 640, 300); rg.addColorStop(0, 'rgba(255,79,123,.55)'); rg.addColorStop(1, 'rgba(255,79,123,0)'); g.fillStyle = rg; g.fillRect(0, 300, 540, 700);
  g.fillStyle = '#ff6f98'; g.font = '900 220px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥', 270, 640);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '800 40px "Plus Jakarta Sans", system-ui, sans-serif'; g.fillText('brinder', 270, 860);
  return c;
}
function starCanvas(){
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 30); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.25, 'rgba(255,225,240,.5)'); rg.addColorStop(1, 'rgba(255,200,230,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(32, 2); g.quadraticCurveTo(34, 30, 62, 32); g.quadraticCurveTo(34, 34, 32, 62); g.quadraticCurveTo(30, 34, 2, 32); g.quadraticCurveTo(30, 30, 32, 2); g.fill();
  return c;
}
// entorno de reflejos a medida: cúpula rosa y softboxes (los corazones y las cartas reflejan "estudio rosa")
function pinkEnv(T, renderer){
  const pm = new T.PMREMGenerator(renderer), sc = new T.Scene();
  sc.add(new T.Mesh(new T.SphereGeometry(50, 32, 16), new T.ShaderMaterial({ side: T.BackSide, uniforms: { a: { value: new T.Color(0x3a0a2a) }, b: { value: new T.Color(0xff5a8a) } },
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec3 p; uniform vec3 a, b; void main(){ gl_FragColor = vec4(mix(a, b, smoothstep(-.6, .9, p.y)) * .8, 1.); }' })));
  const box = (w, h, x, y, z, c, k) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(k), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
  box(18, 10, 12, 14, 18, 0xfff4f8, 6); box(10, 16, -20, 4, 10, 0xffa0c8, 4); box(16, 6, 0, -16, 12, 0xff7a4a, 3); box(26, 5, 0, 20, -10, 0xffd0e8, 5); box(8, 8, 22, -2, -8, 0x8a7aff, 2.5);
  const rt = pm.fromScene(sc, .02);
  sc.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return { rt, pm };
}

export async function playTinder(X){
  const { teams, win, A, later, opts } = X;
  const _vs = { get fxStop(){ return X.getStop(); }, set fxStop(f){ X.setStop(f); } };
  await loadThree(); if (!X.isOpen()) return;
  const BGU = await import('three/examples/jsm/utils/BufferGeometryUtils.js'); if (!X.isOpen()) return;
  const layer = $('#vsLayer');
  const imgs = await Promise.all([loadImg($('#vsHero').src), ...teams.flatMap(t => t.members.map(m => loadImg(photoFor(m.name))))]);
  if (!X.isOpen()) return;
  const heroImg = imgs.shift();
  const ctx = await X.three({
    clear: 0x2a0818, fov: 42, near: .5, far: 160, env: false, tone: 'neutral', clipping: true,
    bloom: { intensity: .85, threshold: .88, radius: .8, smoothing: .22 },
    ao: { radius: .7, intensity: 2.2, falloff: 1.2, color: 0x3a0018 },
    dof: { focusDistance: 16, focusRange: 16, bokehScale: 1.2, resolutionScale: .5 },   // fondo (corazones, bokeh) desenfocado; cartas y móvil nítidos
    vignette: { offset: .3, darkness: .5 }, grain: .035,
  });
  if (!ctx) return;
  const { T, scene, cam, tex } = ctx, QL = ctx.q, W = ctx.W, H = ctx.H, narrow = W / H < .8;
  const VH = 2 * 15 * Math.tan(T.MathUtils.degToRad(21)), VW = VH * W / H;
  cam.position.set(0, 0, 15); cam.lookAt(0, 0, 0);
  const S = synth(), beat = A.beat / 1000, sad = win && !opts.matchWin, love = win && opts.matchWin;
  const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };
  const hdr = (hex, k) => new T.Color(hex).multiplyScalar(k);
  // reflejos de estudio rosa (se libera al cerrar)
  const penv = pinkEnv(T, ctx.renderer); scene.environment = penv.rt.texture; scene.environmentIntensity = .85;

  // ---- fondo: degradado con halos y bokeh que suben (shader), luces físicas, sombras, corazones flotando ----
  const bgU = { cA: { value: new T.Color(0x5a0f3a) }, cB: { value: new T.Color(0xff6a7a) }, cC: { value: new T.Color(0xff9ab0) }, uT: { value: 0 }, uA: { value: W / H }, uK: { value: 1 } };
  const bg = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShaderMaterial({ uniforms: bgU, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 cA, cB, cC; uniform float uT, uA, uK;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main(){ vec2 p = vUv; vec3 c = mix(cB, cA, smoothstep(0., 1., p.y));
        vec2 q1 = (p - vec2(.22 + .06 * sin(uT * .21), .28 + .05 * cos(uT * .17))) * vec2(uA, 1.); c += cC * .5 * exp(-dot(q1, q1) * 7.) * uK;
        vec2 q2 = (p - vec2(.82 + .05 * cos(uT * .19), .72 + .06 * sin(uT * .23))) * vec2(uA, 1.); c += cC * .34 * exp(-dot(q2, q2) * 9.) * uK;
        for (int L = 0; L < 2; L++){ float sc = 5. + float(L) * 4.; vec2 g = vec2(p.x * uA, p.y - uT * (.012 + float(L) * .008)) * sc; vec2 id = floor(g), f = fract(g) - .5;
          float r = h21(id + float(L) * 17.); vec2 o = vec2(h21(id + 3.1), h21(id + 7.7)) - .5; float rad = .12 + .22 * h21(id + 1.3);
          float d = length(f - o * .5); float disc = smoothstep(rad, rad * .55, d) * step(.62, r);
          c += cC * disc * (.2 + .16 * h21(id + 5.5)) * (.5 + .5 * sin(uT * (.5 + r) + r * 20.)) * uK; }
        gl_FragColor = vec4(c, 1.); }` }));
  bg.position.z = -30; bg.scale.set(VH * 3.6 * (W / H), VH * 3.6, 1); scene.add(bg);
  // luces físicas: hemisférica rosa + principal con sombras suaves + contraluz + relleno rosa puntual
  scene.add(new T.HemisphereLight(0xffd0e4, 0x8a1040, 1.3));
  const dl = new T.DirectionalLight(0xfff0f4, 2.4); dl.position.set(3, 5, 10); scene.add(dl); ctx.sun(dl, { size: 15, res: QL.shadow, radius: 5, bias: -.0005, normalBias: .02, near: 1, far: 60 });
  const rimL = new T.DirectionalLight(0xffa0c0, 1.3); rimL.position.set(-5, 3, -7); scene.add(rimL);
  const pink = new T.PointLight(0xff4f7b, 70, 40, 2); pink.position.set(0, 2, 6); scene.add(pink);
  // corazones de fondo: globos brillantes con laca (instanciados, cada uno de su color)
  const HN = QL.mob ? 28 : 46, hm = new T.InstancedMesh(heart3D(T, BGU, .55, 3, QL.hi),
    new T.MeshPhysicalMaterial({ color: 0xffffff, metalness: .1, roughness: .2, clearcoat: 1, clearcoatRoughness: .06, emissive: 0x6a0020, emissiveIntensity: .45, envMapIntensity: 1.2 }), HN), hd = [];
  const dummy = new T.Object3D(), HC = [0xff4f7b, 0xff2a6a, 0xff8aa8, 0xffb0c8, 0xff6a3d, 0xe8206a];
  for (let i = 0; i < HN; i++){ hd.push({ p: new T.Vector3((Math.random() - .5) * VW * 1.4, (Math.random() - .5) * VH * 1.4, -4 - Math.random() * 12), s: .4 + Math.random() * 1.1, v: .4 + Math.random() * .9, r: Math.random() * 6, w: (Math.random() - .5) * 2 }); hm.setColorAt(i, new T.Color(HC[i % HC.length])); }
  scene.add(hm);
  // purpurina flotando (bloom)
  const SPN = QL.mob ? 70 : 140, spp = new Float32Array(SPN * 3), spd = [];
  for (let i = 0; i < SPN; i++){ spp.set([(Math.random() - .5) * VW * 1.5, (Math.random() - .5) * VH * 1.5, -9 + Math.random() * 11], i * 3); spd.push(.15 + Math.random() * .5); }
  const spg = new T.BufferGeometry(); spg.setAttribute('position', new T.BufferAttribute(spp, 3));
  const sparkles = new T.Points(spg, new T.PointsMaterial({ map: tex(starCanvas()), size: .5, color: hdr(0xffd8e8, 2.2), ...AB, opacity: .85 })); sparkles.frustumCulled = false; scene.add(sparkles);

  // ---- el chico (foto original) ----
  const meC = faceCanvas('tú', '#ff4f7b', heroImg, 'TÚ');
  const me = new T.Mesh(new T.PlaneGeometry(1, 300 / 256), new T.MeshBasicMaterial({ map: tex(meC), transparent: true }));
  scene.add(me);
  const q = new T.Sprite(new T.SpriteMaterial({ map: tex(textCanvas(win ? (love ? '¡Es un match!' : 'Sin match…') : '¿Con quién harás match?', { size: 96, w: 1024, h: 170, glow: '#ff4f7b', weight: 800 })), transparent: true, depthTest: false, opacity: 0 }));
  q.scale.set(Math.min(VW * .9, 9), Math.min(VW * .9, 9) * 170 / 1024, 1); q.position.set(0, VH * .36, 1); scene.add(q);

  // ---- móvil ----
  const ph = narrow ? VH * .44 : VH * .66, pw = ph * .49;
  const phone = new T.Group(); scene.add(phone);
  // cuerpo de titanio con esquinas redondas y bisel; marco negro, pantalla con cristal, isla, botones y trasera con cámaras
  const R0 = pw * .11, ti = new T.MeshPhysicalMaterial({ color: 0x4a4658, metalness: 1, roughness: .27, clearcoat: .5, clearcoatRoughness: .25, envMapIntensity: 1.3 });
  const bodyG = new T.ExtrudeGeometry(rrShape(T, pw * 1.04, ph * 1.02, R0), { depth: .26, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 4, curveSegments: 14 }); bodyG.translate(0, 0, -.13);
  const body = new T.Mesh(bodyG, ti); body.castShadow = body.receiveShadow = true;
  const bezel = new T.Mesh(rrPlane(T, pw * 1.0, ph * .98, R0 * .96), new T.MeshStandardMaterial({ color: 0x050407, roughness: .35, metalness: .2 })); bezel.position.z = .161;
  // pantalla: se ilumina sola (emisiva) pero recibe sombras de las cartas
  const scrMap = tex(phoneCanvas());
  const screen = new T.Mesh(rrPlane(T, pw * .96, ph * .96, R0 * .78), new T.MeshStandardMaterial({ map: scrMap, color: 0xb0b0b0, emissive: 0xffffff, emissiveMap: scrMap, emissiveIntensity: .42, roughness: .5, metalness: 0 })); screen.position.z = .17; screen.receiveShadow = true;
  const glass = new T.Mesh(rrPlane(T, pw * .96, ph * .96, R0 * .78), new T.MeshStandardMaterial({ color: 0x000000, roughness: .04, envMapIntensity: 1.6, ...AB })); glass.position.z = .175; glass.renderOrder = 2;
  const island = new T.Mesh(rrPlane(T, pw * .27, ph * .02, ph * .01), new T.MeshBasicMaterial({ color: 0x000000 })); island.position.set(0, ph * .455, .172);
  phone.add(body, bezel, screen, glass, island);
  [[-1, .22, .07], [-1, .12, .045], [-1, .05, .045], [1, .16, .1]].forEach(([sd, y, hh]) => { const b = new T.Mesh(new T.RoundedBoxGeometry(.05, ph * hh, .09, 2, .02), ti); b.position.set(sd * (pw * .5 + .06), ph * y, 0); phone.add(b); });
  const back = new T.Mesh(rrPlane(T, pw * .98, ph * .96, R0 * .9), new T.MeshPhysicalMaterial({ map: tex(phoneBackCanvas()), roughness: .2, clearcoat: 1, clearcoatRoughness: .1 })); back.position.z = -.165; back.rotation.y = Math.PI; phone.add(back);
  const cam3 = new T.Mesh(new T.RoundedBoxGeometry(pw * .36, pw * .36, .06, 3, .08), new T.MeshPhysicalMaterial({ color: 0x15121a, metalness: .6, roughness: .2, clearcoat: 1 })); cam3.position.set(-pw * .26, ph * .36, -.2); phone.add(cam3);
  [[-.075, .075], [.075, .075], [0, -.075]].forEach(([x, y]) => { const r = pw * .36 * .5; const ring = new T.Mesh(new T.TorusGeometry(pw * .06, .018, 10, 28), ti); ring.position.set(-pw * .26 + x * pw * 1.5 / 1.5 * 1, ph * .36 + y * pw * 1.5, -.235); phone.add(ring);
    const lens = new T.Mesh(new T.CircleGeometry(pw * .055, 24), new T.MeshPhysicalMaterial({ color: 0x06060c, roughness: .05, clearcoat: 1, metalness: .5 })); lens.position.copy(ring.position); lens.position.z -= .004; lens.rotation.y = Math.PI; phone.add(lens); });
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
  // carta física: cuerpo con grosor y bisel + cara con la foto (laca brillante y sombras) + sello
  const cr = cw * 40 / 512, cardBodyG = new T.ExtrudeGeometry(rrShape(T, cw * .985, chh * .99, cr), { depth: .04, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 3, curveSegments: 8 });
  cardBodyG.translate(0, 0, -.02); const cardFaceG = rrPlane(T, cw, chh, cr), cardBodyM = new T.MeshStandardMaterial({ color: 0xfff0f5, roughness: .5, metalness: 0 });
  const stampG = new T.PlaneGeometry(cw * .7, cw * .7 * 200 / 512);
  order.forEach((o, i) => {
    const photo = tex(profileCanvas(o.m, imgByKey.get(o.ti + ':' + o.k), o.team.bar));
    const mesh = new T.Group(), bodyM = cardBodyM.clone();
    const bd = new T.Mesh(cardBodyG, bodyM); bd.castShadow = bd.receiveShadow = true;
    const faceM = new T.MeshPhysicalMaterial({ map: photo, color: 0x9a9a9a, emissive: 0xffffff, emissiveMap: photo, emissiveIntensity: .7, roughness: .3, clearcoat: .75, clearcoatRoughness: .12, envMapIntensity: .9 });
    const face = new T.Mesh(cardFaceG, faceM); face.position.z = .0345; face.receiveShadow = true;
    mesh.add(bd, face);
    const [dx, dy, word, col] = DIRS[Math.min(o.ti, 3)];
    const st = new T.Mesh(stampG, new T.MeshBasicMaterial({ map: tex(stampCanvas(word, col)), transparent: true, opacity: 0, depthTest: false }));
    st.position.set(dx < 0 ? cw * .18 : -cw * .18, chh * .32, .06); st.rotation.z = dx < 0 ? -.3 : .3; mesh.add(st);
    mesh.visible = false; scene.add(mesh);
    cards.push({ ...o, mesh, st, dx, dy, word, col, slot: null, mats: [bodyM, faceM] });
  });
  const setOp = (c, v) => c.mats.forEach(m => { m.transparent = v < 1; m.opacity = v; m.needsUpdate = true; });
  // bandejas de cristal esmerilado bajo cada montón (reciben la sombra de las cartas)
  const panels = teams.map((t, ti) => { const P = t._pile, pw2 = P.cols * P.mw * 1.12 + .7, ph2 = P.rows * P.mh * 1.1 + .6;
    const m = new T.Mesh(rrPlane(T, pw2, ph2, .45), new T.MeshPhysicalMaterial({ color: ti === 0 ? 0xff7aa4 : 0xffffff, transparent: true, opacity: 0, roughness: .3, clearcoat: 1, clearcoatRoughness: .1, depthWrite: false }));
    m.position.set(P.c.x, P.c.y - .25, .06); m.receiveShadow = true; m.visible = !win; scene.add(m);
    const sh = rrShape(T, pw2, ph2, .45), ln = new T.LineLoop(new T.BufferGeometry().setFromPoints(sh.getPoints(10).map(p2 => new T.Vector3(p2.x, p2.y, 0))), new T.LineBasicMaterial({ color: hdr(ti === 0 ? 0xffb0cc : 0xffffff, 1.5), transparent: true, opacity: 0 }));
    ln.position.copy(m.position); ln.visible = !win; scene.add(ln); return { m, ln, k: ti === 0 ? .26 : .16 }; });
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
  // corazoncitos 3D de laca (rosas) y rotos (apagados, caen con peso); geometría y materiales compartidos
  const miniG = heart3D(T, BGU, .42, 2.4, false);
  const miniM = [0xff4f7b, 0xff2a6a, 0xff8aa8, 0xffc0d0, 0xff6a3d].map(c => new T.MeshPhysicalMaterial({ color: c, roughness: .18, clearcoat: 1, clearcoatRoughness: .05, emissive: c, emissiveIntensity: .35, envMapIntensity: 1.2 }));
  const brokeM = [0xb05a78, 0x8a6a9a].map(c => new T.MeshPhysicalMaterial({ color: c, roughness: .45, clearcoat: .5, emissive: c, emissiveIntensity: .25, envMapIntensity: .8 }));
  function heartsBurst(pos, n, broken){
    for (let i = 0; i < n; i++){ const m = new T.Mesh(miniG, (broken ? brokeM : miniM)[i % (broken ? 2 : 5)]), sc0 = .5 + Math.random() * .8; m.position.copy(pos); m.scale.setScalar(.01); m.castShadow = true; m.userData.shared = true; scene.add(m);
      const v = new T.Vector3((Math.random() - .5) * 5, 1.5 + Math.random() * 4, (Math.random() - .5) * 2), w = new T.Vector3((Math.random() - .5) * 6, (Math.random() - .5) * 8, (Math.random() - .5) * 5); m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      fxList.push({ o: m, t: 0, d: 1.1, u: (o, k, dt) => { o.position.addScaledVector(v, dt); v.y -= (broken ? 9 : 3) * dt; o.rotation.x += w.x * dt; o.rotation.y += w.y * dt; o.rotation.z += w.z * dt * (broken ? 1.6 : 1);
        o.scale.setScalar(sc0 * Math.min(1, k / .12) * (1 - Math.pow(Math.max(0, (k - .55) / .45), 2))); } }); }
  }
  function word(text, pos, grad){ const s = popSprite(ctx, text, pos, { h: .9, grad }); fxList.push({ o: s, t: 0, d: .9, u: (o, k) => { const e = Math.min(1, k / .2); o.scale.set(o.userData.h * 3.5 * (1.5 - .5 * e), o.userData.h * (1.5 - .5 * e), 1); o.position.y += .012; o.material.opacity = 1 - Math.max(0, (k - .6) / .4); } }); }

  // ---- final de ganador: amor o tristeza ----
  let bigHeart = null, halves = null, rain = null, capt = null, heartL = null;
  if (love){
    bigHeart = new T.Mesh(heart3D(T, BGU, Math.min(VH, VW) * .62, 4, true), new T.MeshPhysicalMaterial({ color: 0xff2a6a, metalness: .15, roughness: .14, clearcoat: 1, clearcoatRoughness: .04, emissive: 0xa00030, emissiveIntensity: .8, envMapIntensity: 1.4, sheen: 1, sheenColor: new T.Color(0xff9ab8), sheenRoughness: .4 }));
    bigHeart.castShadow = true; heartL = new T.PointLight(0xff3a7a, 240, 34, 2); heartL.position.set(0, 0, 1); scene.add(heartL);
    bigHeart.position.set(0, -VH * .02, -3); bigHeart.scale.setScalar(.01); scene.add(bigHeart);
    const lead = teams[0].members[0];
    capt = new T.Mesh(new T.PlaneGeometry(1, 300 / 256), new T.MeshBasicMaterial({ map: tex(faceCanvas(lead.name, teams[0].bar, imgByKey.get('0:0'), lead.name)), transparent: true }));
    capt.position.set(VW * .6, 0, .5); scene.add(capt);
  }
  if (sad){
    bgU.cA.value.set(0x1a2230); bgU.cB.value.set(0x48566a); bgU.cC.value.set(0x6a8aff); bgU.uK.value = .45; hm.material.color.set(0x5a6a80); hm.material.emissive.set(0x000000); pink.color.set(0x6a8aff); pink.intensity = 26; sparkles.material.color.set(hdr(0xaecbff, 1.4));
    const RN = 700, rp = new Float32Array(RN * 6), rd = [];
    for (let i = 0; i < RN; i++){ rd.push(new T.Vector3((Math.random() - .5) * VW * 1.4, (Math.random() - .5) * VH * 1.4, -6 + Math.random() * 10)); }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3));
    rain = { g: rg, p: rp, d: rd, n: RN }; scene.add(new T.LineSegments(rg, new T.LineBasicMaterial({ color: hdr(0xaecbff, 1.6), transparent: true, opacity: .45 })));
    const geo = heart3D(T, BGU, Math.min(VH, VW) * .42, 4, true), mk = sgn => { const pl = new T.Plane(new T.Vector3(sgn, 0, 0), 0); const m = new T.Mesh(geo, new T.MeshPhysicalMaterial({ color: 0xc23a5a, metalness: .15, roughness: .32, clearcoat: .8, clearcoatRoughness: .15, envMapIntensity: .9, clippingPlanes: [pl], side: T.DoubleSide })); m.position.set(0, VH * .05, -2.5); scene.add(m); return { m, pl, sgn }; };
    halves = [mk(1), mk(-1)];
    me.material.color.set(0x9aaabf);
    const snd = X.song; if (snd){ snd.preservesPitch = false; snd.playbackRate = .82; }
  }

  // ---- línea de tiempo ----
  const SW = cards.length > 10 ? beat : beat * 2, tPhone = 1.7, tSw = 2.9;
  cards.forEach((c, i) => { c.t0 = tSw + i * SW; });
  const tEnd = win ? 1.2 : tSw + cards.length * SW, tMe = tEnd + .2, tOut = tEnd + 1.2;
  const tDone = win ? 4.2 : tEnd + 1.9;
  later(() => { layer.classList.remove('intro'); layer.classList.add('up'); }, 1600);
  later(() => { X.done(); S && S.chord(); }, tDone * 1000);
  later(X.close, (tDone + (A.hold || 4200) / 1000) * 1000);
  if (win) teams[0].members.forEach((m, k) => { const c = cards.find(x => x.ti === 0 && x.k === k); if (c){ c.mesh.visible = true; c.done = true; } });

  const ease = k => k < .5 ? 4 * k ** 3 : 1 - Math.pow(-2 * k + 2, 3) / 2, outBack = k => { const c1 = 1.8, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  const meBig = Math.min(VH * .42, VW * .55), meSmall = narrow ? VH * .075 : VH * .15;
  const meTop = narrow ? new T.Vector3(-pw * .36, ph * .43, .9) : new T.Vector3(0, ph / 2 + meSmall * .62 - VH * .04, .6);
  let lastBurst = 0, lastLoveBurst = 0;
  ctx.start((et, dt) => {
    bgU.uT.value = et;
    // purpurina: sube despacio y titila
    { const p = spg.attributes.position; for (let i = 0; i < SPN; i++){ let y = p.getY(i) + spd[i] * dt; if (y > VH * .8) y = -VH * .8; p.setY(i, y); } p.needsUpdate = true; sparkles.material.opacity = .65 + Math.sin(et * 2.3) * .2; }
    // bandejas de cristal: aparecen cuando empiezan los swipes
    { const pk = win ? 0 : Math.min(1, Math.max(0, (et - tPhone) / 1.2)); panels.forEach(pn => { pn.m.material.opacity = pn.k * pk; pn.ln.material.opacity = .55 * pk; }); }
    if (heartL && bigHeart){ heartL.position.copy(bigHeart.position); heartL.position.z = 2.5; heartL.intensity = 200 + Math.max(0, Math.sin(et / beat * Math.PI)) * 120; bigHeart.material.emissiveIntensity = .7 + Math.max(0, Math.sin(et / beat * Math.PI)) * .5; }
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
        if (sad){ c.mesh.position.set((c.k - (teams[0].members.length - 1) / 2) * VW * .16, VH * .3, -3); c.mesh.scale.setScalar(Math.min(VH * .16, VW * .13) / cw); c.mesh.rotation.set(0, 0, 0); setOp(c, .75); }
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
    for (let i = fxList.length - 1; i >= 0; i--){ const f = fxList[i]; f.t += dt; const k = Math.min(1, f.t / f.d); f.u(f.o, k, dt); if (k >= 1){ scene.remove(f.o); if (!f.o.userData.shared){ f.o.material.map && f.o.material.map.dispose(); f.o.material.dispose(); } fxList.splice(i, 1); } }
    cam.position.x = Math.sin(et * .35) * .5; cam.position.y = Math.sin(et * .27) * .3; cam.lookAt(0, 0, 0);
  });
  const st = _vs.fxStop; _vs.fxStop = () => { S && S.close(); const snd = X.song; if (snd) snd.playbackRate = 1; st(); try { penv.rt.dispose(); penv.pm.dispose(); miniG.dispose(); miniM.concat(brokeM).forEach(m => m.dispose()); cardBodyG.dispose(); cardFaceG.dispose(); } catch (e) { /* nada */ } };
}
