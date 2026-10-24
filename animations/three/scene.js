import { $, GLSL_SRGB, cardCanvas, glowCanvas, loadImg, loadThree, photoFor, rrect, synth, textCanvas, toast } from '@kit';

// Ruido 3D y fbm compartidos por los shaders (nebulosa y disco de acreción)
const GLSL_NOISE = `
float h31(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.03 + vec3(7.1, 3.3, 5.2); a *= .5; } return s; }
`;
// Lente gravitatoria (pantalla): θ = posición aparente, β = posición real de la fuente.
const GLSL_LENS = `
uniform vec2 uLC; uniform float uLR; uniform float uLK; uniform float uAsp;
// desvía el píxel (uv de pantalla) → de dónde sale realmente la luz (inversa, para fragmentos)
vec2 lensBack(vec2 uv){
  vec2 d = uv - uLC; d.x *= uAsp; float th = length(d); if (th < 1e-5 || uLK <= 0.) return uv;
  float e2 = uLR * uLR * uLK; float b = th * (1. - e2 / (th * th + e2 * .64));
  b = mix(th, b, 1. - smoothstep(uLR * 2.5, uLR * 6., th));
  vec2 nd = d / th * b; nd.x /= uAsp; return uLC + nd;
}
// directa (para vértices): dónde se ve una fuente situada en uv
vec2 lensFwd(vec2 uv){
  vec2 d = uv - uLC; d.x *= uAsp; float b = length(d); if (b < 1e-5 || uLK <= 0.) return uv;
  float e = uLR * sqrt(uLK); float th = (b + sqrt(b * b + 4. * e * e)) * .5;
  th = mix(th, b, smoothstep(uLR * 2.5, uLR * 7., b));
  vec2 nd = d / b * th; nd.x /= uAsp; return uLC + nd;
}
`;

export async function playThree(X){
  const { teams, win, A, later } = X;
  await loadThree(); if (!X.isOpen()) return;
  const layer = $('#vsLayer'), fx = $('#vsFx');
  const imgs = await Promise.all([loadImg($('#vsHero').src), ...teams.flatMap(t => t.members.map(m => loadImg(photoFor(m.name))))]);
  if (!X.isOpen()) return;
  const heroImg = imgs.shift();
  // motor común: bloom HDR, aberración cromática, viñeta y grano (sin sombras: no hay suelo que las reciba)
  const g = await X.three({ clear: 0x02000a, fov: 50, near: .1, far: 900, tone: 'neutral', envIntensity: .38,
    bloom: { intensity: .85, threshold: 1.0, radius: .72, smoothing: .18 }, ao: false, shadows: false,
    ca: .0011, grain: .035, vignette: { offset: .3, darkness: .62 } });
  if (!g){ toast('Tu navegador no tiene WebGL. Va otra animación.'); X.fallback('ggez'); return; }
  if (!X.isOpen()){ const st = X.getStop(); st && st(); return; }
  const { T, scene, cam, post, tex, q } = g;
  const flash = document.createElement('div'); flash.className = 'three-flash'; fx.appendChild(flash);
  const W = g.W, H = g.H;
  cam.position.set(0, 0, 14);
  const VH = 2 * 14 * Math.tan(T.MathUtils.degToRad(25)), VW = VH * W / H;
  const yAt = f => VH / 2 - f * VH;
  const add = (o) => (scene.add(o), o);
  const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };
  const dot = tex(glowCanvas([[0, 'rgba(255,255,255,1)'], [.3, 'rgba(255,255,255,.75)'], [.7, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]));
  const PT = { ...AB, map: dot, alphaTest: .01 };
  const hdr = (c, k) => new T.Color(c).multiplyScalar(k);

  // luces: relleno frío, empuje cálido del agujero y contraluz violeta (el entorno PBR hace el resto)
  add(new T.HemisphereLight(0x8aa4ff, 0x2a0f4a, .35));
  const key = add(new T.DirectionalLight(0xfff0dd, 1.2)); key.position.set(-5, 8, 12);
  const rimL = add(new T.PointLight(0xa070ff, 90, 40, 2)); rimL.position.set(9, 4, 5);
  const holeL = add(new T.PointLight(0xff9040, 0, 26, 2));

  // ---- uniformes de lente gravitatoria (los comparten estrellas y nebulosa) ----
  const lens = { uLC: { value: new T.Vector2(.5, .5) }, uLR: { value: .1 }, uLK: { value: 0 }, uAsp: { value: W / H }, uTime: { value: 0 } };

  // ---- nebulosa de fondo (fbm con dominio deformado, tonos violeta / azul / magenta) ----
  const nebU = { ...lens, uO: { value: 0 }, uScr: { value: new T.Vector2(1, 1) }, uRes: { value: new T.Vector2(W, H) } };
  const nebula = new T.Mesh(new T.PlaneGeometry(1300, 800), new T.ShaderMaterial({ uniforms: nebU, ...AB, depthTest: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: GLSL_SRGB + GLSL_NOISE + GLSL_LENS + `uniform float uTime; uniform float uO; uniform vec2 uScr; uniform vec2 uRes; varying vec2 vUv;
      void main(){
        vec2 su = gl_FragCoord.xy / uRes; vec2 sb = lensBack(su); vec2 p = vUv + (sb - su) * uScr;
        vec3 q = vec3(p * vec2(3.2, 2.1), uTime * .018);
        vec3 w = vec3(fbm3(q + 3.1), fbm3(q + 7.7), fbm3(q * 1.7 + 1.3));
        float d = fbm3(q * 1.3 + w * 1.7);
        float m = smoothstep(.36, .82, d);
        float lane = smoothstep(.42, .62, fbm3(q * 2.6 - w));
        vec3 c = mix(s2l(vec3(.30, .09, .70)), s2l(vec3(.08, .36, 1.)), w.x);
        c = mix(c, s2l(vec3(1., .22, .62)), smoothstep(.5, .95, w.y) * .85);
        c += s2l(vec3(1., .82, .55)) * pow(m, 4.) * .35;
        float vig = smoothstep(1.1, .15, length(vUv - .5) * 1.5);
        gl_FragColor = vec4(c * m * (1. - lane * .5) * vig * .62, uO);
      }` }));
  nebula.position.z = -330; nebula.renderOrder = -20; add(nebula);

  // ---- estrellas de fondo: puntos con titileo, tamaños variados, desviadas por la lente ----
  {
    const n = q.mob ? 1700 : 3800, p = new Float32Array(n * 3), c = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n), col = new T.Color();
    for (let i = 0; i < n; i++){
      const r = 90 + Math.random() * 220, th = Math.random() * Math.PI * 2, phi = Math.acos(Math.random() * 2 - 1);
      p.set([r * Math.sin(phi) * Math.cos(th), r * Math.sin(phi) * Math.sin(th), -Math.abs(r * Math.cos(phi))], i * 3);
      const warm = Math.random(); col.setHSL(warm < .3 ? .07 + Math.random() * .05 : .58 + Math.random() * .1, .15 + Math.random() * .4, .66 + Math.random() * .3);
      const big = Math.random() < .03, k = big ? 2.6 : .55 + Math.random() * .8;
      c.set([col.r * k, col.g * k, col.b * k], i * 3); sz[i] = big ? 3.4 + Math.random() * 2 : .9 + Math.random() * 1.5; ph[i] = Math.random() * 6.28;
    }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(p, 3)); sg.setAttribute('color', new T.BufferAttribute(c, 3));
    sg.setAttribute('aSize', new T.BufferAttribute(sz, 1)); sg.setAttribute('aPh', new T.BufferAttribute(ph, 1));
    const stars = new T.Points(sg, new T.ShaderMaterial({ uniforms: { ...lens, uPx: { value: g.renderer.getPixelRatio() * Math.max(.7, H / 720) }, uO: { value: 0 } }, ...AB, depthTest: false, vertexColors: true,
      vertexShader: GLSL_LENS + `attribute float aSize; attribute float aPh; uniform float uTime; uniform float uPx; varying vec3 vC;
        void main(){ vC = color; vec4 cp = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          vec2 uv = cp.xy / cp.w * .5 + .5; uv = lensFwd(uv); cp.xy = (uv * 2. - 1.) * cp.w; gl_Position = cp;
          gl_PointSize = aSize * uPx * (1. + .28 * sin(uTime * (1.4 + aPh * .35) + aPh * 40.)); }`,
      fragmentShader: `uniform float uO; varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = exp(-d * d * 4.2) * (1. - smoothstep(.85, 1., d)); gl_FragColor = vec4(vC * a * uO, 1.); }` }));
    stars.renderOrder = -15; stars.frustumCulled = false; add(stars); g.stars = stars;
  }
  // estrellas brillantes con espículas de difracción
  const spikeC = document.createElement('canvas'); spikeC.width = spikeC.height = 256;
  { const x = spikeC.getContext('2d'); x.translate(128, 128);
    [0, Math.PI / 2].forEach(a => { x.save(); x.rotate(a); const gr = x.createLinearGradient(-128, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(-128, -1.4, 256, 2.8); x.restore(); });
    const r = x.createRadialGradient(0, 0, 0, 0, 0, 34); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(-128, -128, 256, 256); }
  const spikeT = tex(spikeC), twinkles = [];
  for (let i = 0; i < (q.mob ? 14 : 30); i++){
    const s = new T.Sprite(new T.SpriteMaterial({ map: spikeT, color: hdr(new T.Color().setHSL(Math.random() < .5 ? .6 : .08, .5, .8), 1.8), ...AB, opacity: 0 }));
    const r = 110 + Math.random() * 180, th = Math.random() * 6.28, ph = Math.acos(Math.random() * 2 - 1);
    s.position.set(r * Math.sin(ph) * Math.cos(th) * .9, r * Math.sin(ph) * Math.sin(th) * .6, -Math.abs(r * Math.cos(ph)) - 30); s.scale.setScalar(7 + Math.random() * 10); s.userData = { ph: Math.random() * 6.28, sc: s.scale.x };
    add(s); twinkles.push(s);
  }

  // ---- túnel de hiperespacio (estelas HDR) ----
  const TN = q.mob ? 1400 : 2600, tPos = new Float32Array(TN * 6), tCol = new Float32Array(TN * 6), tData = [];
  {
    const col = new T.Color();
    for (let i = 0; i < TN; i++){
      const a = Math.random() * Math.PI * 2, r = 2.2 + Math.random() * 7, z = -260 + Math.random() * 270;
      tData.push({ a, r, z });
      col.setHSL(.5 + Math.random() * .4, 1, .55 + Math.random() * .25); col.multiplyScalar(2.3);
      tCol.set([col.r, col.g, col.b, col.r * .08, col.g * .08, col.b * .08], i * 6);
    }
  }
  const tGeo = new T.BufferGeometry(); tGeo.setAttribute('position', new T.BufferAttribute(tPos, 3)); tGeo.setAttribute('color', new T.BufferAttribute(tCol, 3));
  const tMat = new T.LineBasicMaterial({ vertexColors: true, ...AB, opacity: 1 });
  const tunnel = add(new T.LineSegments(tGeo, tMat)); tunnel.frustumCulled = false;
  // punto de fuga luminoso al fondo del túnel
  const vanish = add(new T.Sprite(new T.SpriteMaterial({ map: tex(glowCanvas([[0, 'rgba(255,255,255,1)'], [.2, 'rgba(160,200,255,.6)'], [.55, 'rgba(120,70,255,.2)'], [1, 'rgba(0,0,0,0)']])), color: hdr(0xffffff, 2.2), ...AB })));
  vanish.position.z = -230; vanish.scale.setScalar(150);

  // ---- héroe: cartón biselado con marco de color y cristal brillante ----
  const heroGroup = add(new T.Group());
  const hT = heroImg ? tex(new T.Texture(heroImg)) : null;
  const HW = .5625;
  const heroFrame = new T.Mesh(new T.RoundedBoxGeometry(HW * 1.085, 1.085, .05, 4, .024), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0x66ccff, emissiveIntensity: 1.6, metalness: .9, roughness: .25 }));
  const hero = new T.Mesh(new T.PlaneGeometry(HW, 1), new T.MeshPhysicalMaterial({ map: hT, color: hT ? 0x555555 : 0xff55aa, emissive: hT ? 0xffffff : 0x000000, emissiveMap: hT, emissiveIntensity: .72, roughness: .38, clearcoat: 1, clearcoatRoughness: .12 }));
  hero.position.z = .027;
  const halo = new T.Sprite(new T.SpriteMaterial({ map: tex(glowCanvas([[0, 'rgba(255,255,255,.85)'], [.45, 'rgba(255,255,255,.28)'], [1, 'rgba(255,255,255,0)']])), color: hdr(0x66ccff, .8), ...AB }));
  halo.scale.set(HW * 1.28, 1.2, 1); halo.position.z = -.06; heroGroup.add(halo, heroFrame, hero);
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
  const diskScale = (narrow ? .65 : 1) * (n > 1 ? 1 : 1.3);
  holeL.position.set(diskPos.x, diskPos.y, diskPos.z + 2.5);

  // =====================================================================
  //  AGUJERO NEGRO: sombra del horizonte, disco de acreción con Doppler,
  //  anillo de fotones y arcos del disco trasero curvados por la lente.
  // =====================================================================
  const disk = add(new T.Group()); disk.position.copy(diskPos); disk.scale.setScalar(.001);
  const R_IN = 1.7, R_OUT = 5.3, R_SH = .9;
  const diskU = { uTime: { value: 0 }, uIn: { value: R_IN }, uOut: { value: R_OUT }, uO: { value: 1 } };
  const diskMat = new T.ShaderMaterial({ uniforms: diskU, ...AB, side: T.DoubleSide,
    vertexShader: 'varying vec3 vL; varying vec3 vW; varying vec3 vT; void main(){ vL = position; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vT = mat3(modelMatrix) * vec3(-position.y, position.x, 0.); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GLSL_SRGB + GLSL_NOISE + `uniform float uTime; uniform float uIn; uniform float uOut; uniform float uO; varying vec3 vL; varying vec3 vW; varying vec3 vT;
      vec3 ramp(float t){ // t: 0 = borde exterior frío, 1 = borde interior blanco-azulado
        vec3 c0 = s2l(vec3(.30, .06, .55)), c1 = s2l(vec3(.85, .16, .12)), c2 = s2l(vec3(1., .52, .12)), c3 = s2l(vec3(1., .86, .5)), c4 = s2l(vec3(1., .97, .92));
        return t < .3 ? mix(c0, c1, t / .3) : t < .6 ? mix(c1, c2, (t - .3) / .3) : t < .85 ? mix(c2, c3, (t - .6) / .25) : mix(c3, c4, (t - .85) / .15); }
      void main(){
        float r = length(vL.xy), a = atan(vL.y, vL.x);
        float t = clamp((r - uIn) / (uOut - uIn), 0., 1.);
        float temp = pow(1. - t, 1.35);
        float om = 2.1 / pow(r, 1.5);                       // rotación kepleriana: el interior gira más rápido
        float ar = a - om * uTime;
        vec3 np = vec3(cos(ar) * 5.5, sin(ar) * 5.5, r * 7.5);
        float n1 = fbm3(np), n2 = fbm3(np * 2.3 + vec3(0., 0., uTime * .25));
        float dens = (.35 + 1.15 * n1) * (.55 + .9 * n2);
        float rings = .75 + .25 * sin(r * 22. + n1 * 6.);
        vec3 tv = normalize(vT); vec3 v = normalize(cameraPosition - vW);
        float dop = clamp(dot(tv, v) * 1.5, -1., 1.);        // lado que se acerca: más brillo y azulado
        float beam = pow(1. + .62 * dop, 2.6);
        vec3 col = ramp(clamp(temp + dop * .12, 0., 1.));
        col = mix(col, col * vec3(.8, .92, 1.25), max(dop, 0.) * .5);
        dens = pow(dens, 1.45) * 1.5;
        float I = (.1 + 2.2 * pow(1. - t, 2.4)) * dens * rings * beam;
        float edge = smoothstep(0., .035, t) * (1. - smoothstep(.72, 1., t));
        gl_FragColor = vec4(col * I * edge * uO, 1.);
      }` });
  const diskMesh = new T.Mesh(new T.RingGeometry(R_IN * .93, R_OUT, 160, 2), diskMat);
  // chispas calientes del disco (partículas en la misma órbita)
  const DN = q.mob ? 2200 : 5200, dPos = new Float32Array(DN * 3), dCol = new Float32Array(DN * 3), dData = [];
  {
    const cIn = new T.Color('#fff4c4'), cMid = new T.Color('#ff7a2e'), cOut = new T.Color('#7b2cff'), col = new T.Color();
    for (let i = 0; i < DN; i++){
      const r = R_IN + Math.pow(Math.random(), 1.6) * (R_OUT - R_IN - .6);
      dData.push({ r, a: Math.random() * Math.PI * 2, y: (Math.random() - .5) * .1 * r });
      const t = (r - R_IN) / (R_OUT - R_IN); t < .35 ? col.copy(cIn).lerp(cMid, t / .35) : col.copy(cMid).lerp(cOut, (t - .35) / .65);
      col.multiplyScalar(2.1); dCol.set([col.r, col.g, col.b], i * 3);
    }
  }
  const dGeo = new T.BufferGeometry(); dGeo.setAttribute('position', new T.BufferAttribute(dPos, 3)); dGeo.setAttribute('color', new T.BufferAttribute(dCol, 3));
  const diskPts = new T.Points(dGeo, new T.PointsMaterial({ size: .075, vertexColors: true, ...PT })); diskPts.frustumCulled = false;
  const diskTilt = new T.Group(), diskRoll = new T.Group();
  diskTilt.rotation.x = 1.08; diskRoll.rotation.z = .2; diskTilt.add(diskMesh, diskPts); diskRoll.add(diskTilt); disk.add(diskRoll);
  const shadow = new T.Mesh(new T.SphereGeometry(R_SH, 48, 48), new T.MeshBasicMaterial({ color: 0x000000 })); disk.add(shadow);
  // billboard con los arcos lenteados (disco trasero doblado sobre el horizonte) y el anillo de fotones
  const lensU = { uTime: diskU.uTime, uK: { value: 0 }, uRoll: { value: -.2 }, uO: { value: 1 } };
  const lensBb = new T.Mesh(new T.PlaneGeometry(16, 16), new T.ShaderMaterial({ uniforms: lensU, ...AB,
    vertexShader: 'varying vec2 vP; void main(){ vP = (uv - .5) * 16.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: GLSL_SRGB + GLSL_NOISE + `uniform float uTime; uniform float uRoll; uniform float uO; varying vec2 vP;
      vec3 ramp(float t){ vec3 c1 = s2l(vec3(.85, .16, .12)), c2 = s2l(vec3(1., .52, .12)), c3 = s2l(vec3(1., .86, .5)), c4 = s2l(vec3(1., .97, .92)); return t < .4 ? mix(c1, c2, t / .4) : t < .75 ? mix(c2, c3, (t - .4) / .35) : mix(c3, c4, (t - .75) / .25); }
      void main(){
        float rho = length(vP); vec2 pr = mat2(cos(uRoll), -sin(uRoll), sin(uRoll), cos(uRoll)) * vP; float phi = atan(pr.y, pr.x);
        float topW = pow(max(sin(phi), 0.), 1.4), botW = pow(max(-sin(phi), 0.), 1.6) * .55;
        float side = .22 + .78 * (topW + botW);
        float tt = clamp((rho - .95) / 1.9, 0., 1.);
        float prof = exp(-(rho - 1.0) * 1.9) * smoothstep(.9, 1.02, rho);
        float tn = fbm3(vec3(cos(phi - uTime * .9) * 4., sin(phi - uTime * .9) * 4., rho * 4.)) * 1.3 + .45;
        float dop = cos(phi - .3) * .5 + .5;
        vec3 arc = ramp(.4 + (1. - tt) * .6) * prof * side * tn * (.6 + 1.1 * dop) * 1.7;
        // anillo de fotones: delgado y muy brillante, con un halo suave
        float ring = exp(-pow((rho - 1.1) / .03, 2.)) * 3.4 + exp(-pow((rho - 1.15) / .16, 2.)) * .32;
        vec3 rc = s2l(vec3(1., .93, .8)) * ring * (.55 + .8 * dop);
        float mask = smoothstep(.88, .94, rho);
        gl_FragColor = vec4((arc + rc) * mask * uO * smoothstep(0., .6, uTime + .6), 1.);
      }` }));
  lensBb.position.z = -.35; lensBb.renderOrder = 2; disk.add(lensBb);
  const glow = new T.Sprite(new T.SpriteMaterial({ map: tex(glowCanvas([[0, 'rgba(255,200,120,.8)'], [.2, 'rgba(255,120,50,.4)'], [.6, 'rgba(140,40,255,.14)'], [1, 'rgba(0,0,0,0)']])), color: hdr(0xffffff, .55), ...AB }));
  glow.scale.setScalar(12); glow.position.z = -.7; disk.add(glow);

  // ---- efectos: ondas, explosiones, fuegos artificiales ----
  const fxList = [];
  const ringGeo = new T.RingGeometry(.965, 1, 96);
  function shock(pos, color, maxR, dur, facing = true){
    const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: hdr(color, 2.6), ...AB, side: T.DoubleSide }));
    m.position.copy(pos); if (!facing) m.rotation.x = 1.08; add(m);
    fxList.push({ obj: m, t: 0, dur, upd: (o, k) => { o.scale.setScalar(.1 + maxR * (1 - Math.pow(1 - k, 3))); o.material.opacity = 1 - k; } });
  }
  function burst(pos, count, hue, speed, size = .09, life = 1.8){
    const p = new Float32Array(count * 3), c = new Float32Array(count * 3), v = [], col = new T.Color();
    for (let i = 0; i < count; i++){
      p.set([pos.x, pos.y, pos.z], i * 3);
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1), s = speed * (.3 + Math.random() * .7);
      v.push(Math.sin(ph) * Math.cos(th) * s, Math.sin(ph) * Math.sin(th) * s, Math.cos(ph) * s);
      col.setHSL(hue < 0 ? Math.random() : hue + (Math.random() - .5) * .08, 1, .6).multiplyScalar(1.7); c.set([col.r, col.g, col.b], i * 3);
    }
    const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(p, 3)); gg.setAttribute('color', new T.BufferAttribute(c, 3));
    const pts = add(new T.Points(gg, new T.PointsMaterial({ size: size * 2, vertexColors: true, ...PT }))); pts.frustumCulled = false;
    fxList.push({ obj: pts, t: 0, dur: life, upd: (o, k, dt) => {
      const a = o.geometry.attributes.position.array;
      for (let i = 0; i < count; i++){ a[i*3] += v[i*3] * dt; a[i*3+1] += v[i*3+1] * dt - k * .6 * dt; a[i*3+2] += v[i*3+2] * dt; v[i*3] *= .965; v[i*3+1] *= .965; v[i*3+2] *= .965; }
      o.geometry.attributes.position.needsUpdate = true; o.material.opacity = 1 - k * k;
    }});
  }

  // estela de partículas de las cartas lanzadas (anillo de búfer, una sola malla)
  const TRN = q.mob ? 360 : 900, trPos = new Float32Array(TRN * 3), trCol = new Float32Array(TRN * 3), trAge = new Float32Array(TRN).fill(1), trSz = new Float32Array(TRN);
  const trGeo = new T.BufferGeometry(); trGeo.setAttribute('position', new T.BufferAttribute(trPos, 3)); trGeo.setAttribute('color', new T.BufferAttribute(trCol, 3));
  trGeo.setAttribute('aAge', new T.BufferAttribute(trAge, 1)); trGeo.setAttribute('aSize', new T.BufferAttribute(trSz, 1));
  const trail = new T.Points(trGeo, new T.ShaderMaterial({ uniforms: { uPx: { value: g.renderer.getPixelRatio() * Math.max(.7, H / 720) } }, ...AB, vertexColors: true,
    vertexShader: `attribute float aAge; attribute float aSize; uniform float uPx; varying vec3 vC; varying float vA; void main(){ vC = color; vA = 1. - aAge; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * vA * uPx * (60. / -mv.z) * 5.; }`,
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = exp(-d * d * 3.5) * (1. - smoothstep(.8, 1., d)); gl_FragColor = vec4(vC * a * vA * vA, 1.); }' }));
  trail.frustumCulled = false; add(trail);
  let trI = 0;
  const trEmit = (pos, col) => { const i = trI++ % TRN; trPos.set([pos.x + (Math.random() - .5) * .12, pos.y + (Math.random() - .5) * .12, pos.z - .05], i * 3); trCol.set([col.r, col.g, col.b], i * 3); trAge[i] = 0; trSz[i] = .6 + Math.random() * .7; };

  // VS y nombres de equipo
  const sprites = [];
  const mkSprite = (c, h) => { const s = new T.Sprite(new T.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false, color: 0xe6e6e6 })); s.scale.set(h * c.width / c.height, h, 1); s.userData.base = s.scale.clone(); s.scale.multiplyScalar(.001); add(s); sprites.push(s); return s; };
  const vsSprites = [];
  for (let i = 1; i < n; i++){
    const vs = mkSprite(textCanvas('VS', { size: 220, w: 512, h: 300, italic: true, grad: ['#ffffff', '#ffe08a', '#ff5bd2'], glow: '#ff3aa8' }), narrow ? vsGap * .6 : Math.min(vsGap * .8, VH * .11));
    const [x1, y1] = centers[i - 1], [x2, y2] = centers[i];
    vs.position.set((x1 + x2) / 2 + (narrow ? VW * .36 : 0), (y1 + y2) / 2 + (narrow ? 0 : arenaH * .36), .8); vsSprites.push(vs);
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
    const l = new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: hdr(teams[i].bar, 1.05), ...AB, opacity: 0 }));
    l.position.set(x, y - labelH * .2, .2); add(l); return l;
  });

  // ---- cartas: placa biselada (extrusión redondeada) con cara de cristal, dorso y destello de barrido ----
  // proporciones de cardCanvas: la ficha ocupa 232x316 de 256x340, esquinas de 26
  const fw = cw * 232 / 256, fh = ch * 316 / 340, fr = cw * 26 / 256, bs = cw * .012, dep = cw * .07;
  const bodyShape = new T.Shape(), bw = fw - 2 * bs, bh = fh - 2 * bs, br = fr - bs;
  bodyShape.moveTo(-bw / 2 + br, -bh / 2); bodyShape.lineTo(bw / 2 - br, -bh / 2); bodyShape.absarc(bw / 2 - br, -bh / 2 + br, br, -Math.PI / 2, 0, false);
  bodyShape.lineTo(bw / 2, bh / 2 - br); bodyShape.absarc(bw / 2 - br, bh / 2 - br, br, 0, Math.PI / 2, false);
  bodyShape.lineTo(-bw / 2 + br, bh / 2); bodyShape.absarc(-bw / 2 + br, bh / 2 - br, br, Math.PI / 2, Math.PI, false);
  bodyShape.lineTo(-bw / 2, -bh / 2 + br); bodyShape.absarc(-bw / 2 + br, -bh / 2 + br, br, Math.PI, Math.PI * 1.5, false);
  const bodyGeo = new T.ExtrudeGeometry(bodyShape, { depth: dep, bevelEnabled: true, bevelThickness: bs, bevelSize: bs, bevelSegments: 3, curveSegments: q.mob ? 6 : 12 });
  bodyGeo.translate(0, 0, -dep / 2);
  const faceGeo = new T.PlaneGeometry(cw, ch);
  const zF = dep / 2 + bs + .0015;
  const sweepU = { uTime: { value: 0 } };
  const backC = {};
  const backCanvas = col => backC[col] || (backC[col] = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 340; const x = c.getContext('2d');
    x.shadowColor = col; x.shadowBlur = 26; rrect(x, 12, 12, 232, 316, 26); x.fillStyle = '#0c0620'; x.fill(); x.shadowBlur = 0; x.lineWidth = 7; x.strokeStyle = col; x.stroke();
    x.save(); rrect(x, 12, 12, 232, 316, 26); x.clip(); x.strokeStyle = col; x.globalAlpha = .55; x.lineWidth = 2;
    for (let i = 0; i < 9; i++){ x.beginPath(); x.arc(128, 170, 22 + i * 17, 0, 7); x.stroke(); }
    x.globalAlpha = .25; for (let i = -6; i < 8; i++){ x.beginPath(); x.moveTo(i * 40, 0); x.lineTo(i * 40 + 340, 340); x.stroke(); }
    x.restore(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 30px Orbitron, system-ui, sans-serif'; x.shadowColor = col; x.shadowBlur = 14; x.fillText('LERELIO', 128, 170);
    return tex(c);
  })());
  const cards = [];
  let ci = 0;
  teams.forEach((t, ti) => {
    const [cx, cy] = centers[ti], rotY = n > 1 && !narrow ? -cx / (VW / 2) * .5 : 0;
    const inner = teamH - labelH, gridTop = cy + teamH / 2 - labelH;
    const frameMat = new T.MeshStandardMaterial({ color: t.bar, emissive: t.bar, emissiveIntensity: .3, metalness: .85, roughness: .28 });
    const bk = new T.MeshPhysicalMaterial({ map: backCanvas(t.bar), alphaTest: .3, roughness: .45, clearcoat: .8, clearcoatRoughness: .2, emissive: 0xffffff, emissiveMap: backCanvas(t.bar), emissiveIntensity: .6 });
    t.members.forEach((m, k) => {
      const r = Math.floor(k / cols), cInRow = Math.min(cols, t.members.length - r * cols), c = k % cols;
      const x = cx + (c - (cInRow - 1) / 2) * cw * GAP;
      const y = gridTop - inner / 2 + ((rows - 1) / 2 - r) * ch * GAP;
      const map = tex(cardCanvas(m, t.bar, imgs[ci++]));
      const mesh = new T.Group();
      const body = new T.Mesh(bodyGeo, frameMat);
      const front = new T.Mesh(faceGeo, new T.MeshStandardMaterial({ map, color: 0x000000, alphaTest: .35, roughness: .7, metalness: 0, envMapIntensity: .25, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .9 }));
      front.position.z = zF;
      const back = new T.Mesh(faceGeo, bk); back.rotation.y = Math.PI; back.position.z = -zF;
      const sheen = new T.Mesh(faceGeo, new T.ShaderMaterial({ uniforms: { map: { value: map }, uT: sweepU.uTime }, ...AB, side: T.FrontSide,
        vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: 'uniform sampler2D map; uniform float uT; varying vec2 vUv; varying vec3 vW; void main(){ float a = texture2D(map, vUv).a; if (a < .35) discard; float ph = fract(vW.x * .045 - vW.y * .03 - uT * .22); float band = exp(-pow((ph - .5) / .045, 2.)) * .8 + exp(-pow((ph - .5) / .2, 2.)) * .12; float edge = pow(1. - abs(vUv.x - .5) * 1.6, 2.); gl_FragColor = vec4(vec3(.8, .9, 1.) * band * (.6 + edge * .5) * .45, 1.); }' }));
      sheen.position.z = zF + .002;
      mesh.add(body, front, back, sheen);
      mesh.position.copy(diskPos); mesh.scale.setScalar(.001); add(mesh);
      cards.push({ mesh, ti, k, end: new T.Vector3(x, y, 0), rotY, color: new T.Color(t.bar), launched: -1, landed: false, dir: ti % 2 ? -1 : 1 });
    });
  });
  // orden alternado entre equipos
  const order = []; for (let r = 0; r < per; r++) teams.forEach((t, ti) => { const c = cards.find(x => x.ti === ti && x.k === r); if (c) order.push(c); });

  // ---- línea de tiempo ----
  const S = synth(); S && S.riser(2.4); S && S.drone();
  const prevStop = X.getStop();
  X.setStop(() => { S && S.close(); prevStop && prevStop(); });
  const tBoom = 2.4, tUp = 3.0, tDisk = 3.2, tVs = 4.0, tCards = 4.5, FLY = 1.15;
  const step = Math.max(.17, Math.min(.32, 2.6 / order.length));
  order.forEach((c, i) => c.launched = tCards + i * step);
  const tDone = tCards + (order.length - 1) * step + FLY + .6;
  later(() => { layer.classList.remove('intro'); layer.classList.add('up'); }, tUp * 1000);
  later(() => { X.done(); }, tDone * 1000);
  later(X.close, (tDone + (A.hold || 4000) / 1000) * 1000);

  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const outBack = k => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  let shake = 0, boomed = false, vsShown = false, lastFw = 0, pulse = 0;
  const tmpV = new T.Vector3(), launchCol = new T.Color();
  const bloomBase = post.bloom ? post.bloom.intensity : 0, caBase = .0011;
  const stActive = nebU.uO;

  g.start((et, dt) => {
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
    vanish.visible = tunnel.visible; vanish.material.opacity = tMat.opacity * (.55 + .45 * Math.min(1, et / tBoom));
    vanish.scale.setScalar(110 + 90 * Math.min(1, et / tBoom));

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
    const hc = new T.Color().setHSL((et * .15) % 1, 1, .6);
    heroFrame.material.emissive.copy(hc); halo.material.color.copy(hc).multiplyScalar(.8);

    if (!boomed && et >= tBoom){
      boomed = true; shake = 1.1; pulse = 1;
      burst(new T.Vector3(0, 0, .5), q.mob ? 1500 : 2800, -1, 16, .08, 2.2);
      shock(new T.Vector3(0, 0, .2), 0xffffff, 22, 1.4); shock(new T.Vector3(0, 0, .1), 0xff5bd2, 14, 1.1);
      flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
      S && S.boom(true);
    }

    // fondo: nebulosa y estrellas aparecen tras el Big Bang
    const bgK = et < tBoom - .2 ? .12 : Math.min(1, .12 + (et - tBoom + .2) / 1.6);
    nebU.uO.value = Math.max(0, bgK - .12) * 1.0; g.stars.material.uniforms.uO.value = .35 + .65 * bgK;
    lens.uTime.value = et;
    twinkles.forEach(s => { s.material.opacity = bgK * (.5 + .5 * Math.sin(et * 1.3 + s.userData.ph)) * .9; s.scale.setScalar(s.userData.sc * (.85 + .25 * Math.sin(et * 2 + s.userData.ph))); });

    // disco
    let kd = 0;
    if (et >= tDisk){
      kd = Math.min(1, (et - tDisk) / 1.1);
      disk.scale.setScalar(outBack(kd) * diskScale);
      diskU.uTime.value = et - tDisk;
      for (let i = 0; i < DN; i++){
        const d = dData[i]; d.a += dt * 2.1 / Math.pow(d.r, 1.5) * 1.6;
        dPos[i*3] = Math.cos(d.a) * d.r; dPos[i*3+1] = Math.sin(d.a) * d.r; dPos[i*3+2] = d.y;
      }
      dGeo.attributes.position.needsUpdate = true;
      glow.material.opacity = .78 + Math.sin(et * 3) * .22;
      lensU.uTime.value = et - tDisk;
      holeL.intensity = 70 * kd * (.85 + .15 * Math.sin(et * 5));
    }
    disk.visible = et >= tDisk;
    // lente: desvío de estrellas y nebulosa alrededor del agujero (se relaja cuando acaban de nacer los equipos)
    {
      const pr = cam.position.z - diskPos.z, ph = 1 / (2 * pr * Math.tan(T.MathUtils.degToRad(cam.fov / 2)));
      tmpV.copy(diskPos).project(cam);
      lens.uLC.value.set(tmpV.x * .5 + .5, tmpV.y * .5 + .5); lens.uAsp.value = g.W / g.H;
      lens.uLR.value = 3.1 * diskScale * Math.min(1, kd * 1.4) * ph;
      lens.uLK.value = kd > 0 ? 1 : 0;
      const sc = 2 * Math.tan(T.MathUtils.degToRad(25)) * 344; nebU.uScr.value.set(sc * g.W / g.H / 1300, sc / 800); nebU.uRes.value.set(g.renderer.domElement.width, g.renderer.domElement.height);
      // la billboard del agujero mira siempre a cámara
      lensBb.quaternion.copy(cam.quaternion).premultiply(disk.quaternion.clone().invert());
    }

    // VS + nombres
    if (et >= tVs){
      if (!vsShown){ vsShown = true; S && S.boom(false); vsSprites.forEach(v => shock(v.position, 0xffe08a, 4, .8)); shake = Math.max(shake, .4); }
      const k = Math.min(1, (et - tVs) / .7);
      sprites.forEach((s, i) => { const kk = Math.max(0, Math.min(1, (et - tVs - i * .08) / .7)); s.scale.copy(s.userData.base).multiplyScalar(Math.max(.001, outBack(kk))); });
      vsSprites.forEach(v => { v.material.rotation = Math.sin(et * 2.2) * .08; v.scale.copy(v.userData.base).multiplyScalar(outBack(k) * (1 + Math.sin(et * 7) * .04)); });
    }

    // cartas
    sweepU.uTime.value = et;
    const cDisk = diskPos;
    for (const c of cards){
      if (c.launched < 0 || et < c.launched) continue;
      const k = Math.min(1, (et - c.launched) / FLY), e = ease(k);
      if (!c.landed){
        if (!c.fired){ c.fired = true; pulse = Math.max(pulse, .55); shock(cDisk.clone().setZ(cDisk.z + .6), c.color.getHex(), 2.2, .5, false); }
        const sw = Math.sin(e * Math.PI) * (narrow ? 1.4 : 2.6), ang = c.k * 1.7 + e * 7 * c.dir;
        c.mesh.position.set(
          cDisk.x + (c.end.x - cDisk.x) * e + Math.cos(ang) * sw,
          cDisk.y + (c.end.y - cDisk.y) * e + Math.sin(ang) * sw * .6,
          cDisk.z + (c.end.z - cDisk.z) * e + Math.sin(e * Math.PI) * 3.5);
        c.mesh.rotation.set(Math.sin(e * Math.PI) * .6, c.rotY + (1 - e) * Math.PI * 3 * c.dir, (1 - e) * Math.PI * 2 * c.dir);
        c.mesh.scale.setScalar(Math.max(.001, e));
        if (e > .03 && e < .97){ launchCol.copy(c.color).multiplyScalar(3.2); trEmit(c.mesh.position, launchCol); trEmit(c.mesh.position, launchCol); }
        if (k >= 1){
          c.landed = true; c.landT = et;
          shock(c.end.clone().setZ(.05), c.color.getHex(), cw * 1.05, .6);
          burst(c.end.clone().setZ(.3), q.mob ? 90 : 170, c.color.getHSL({}).h, 5, .07, 1.1);
          shake = Math.max(shake, .22); S && S.zap(520 + (c.ti * 5 + c.k) % 8 * 90);
        }
      } else {
        const lk = Math.min(1, (et - c.landT) / .35), pl = 1 + .28 * (1 - lk) * Math.cos(lk * Math.PI * 2.5);
        // al final cada equipo se convierte en una mini galaxia: las cartas orbitan su nombre
        const ob = et > tDone + .2 ? ease(Math.min(1, (et - tDone - .2) / 1.6)) : 0;
        const Nt = teams[c.ti].members.length, [tcx, tcy] = centers[c.ti];
        const ang = (c.k / Nt) * Math.PI * 2 - Math.PI / 2 + (et - tDone) * .42 * (c.ti % 2 ? -1 : 1);
        const ox = tcx + Math.cos(ang) * orbRx, oy = tcy - labelH * .2 + Math.sin(ang) * orbRy, oz = Math.sin(ang) * 1.8 + .6;
        c.mesh.position.set(c.end.x + (ox - c.end.x) * ob, c.end.y + (oy - c.end.y) * ob, c.end.z + (oz - c.end.z) * ob);
        c.mesh.scale.setScalar(pl * (1 - ob * .18 + ob * .14 * Math.sin(ang)));
        // ligero vaivén de «flotar» y la cara se inclina hacia el eje del equipo
        c.mesh.rotation.set(Math.sin(et * 1.1 + c.k * 2) * .05, c.rotY * (1 - ob) + Math.sin(et * .9 + c.k) * .1 * ob + Math.sin(et * .8 + c.k * 1.3) * .06 * (1 - ob), Math.sin(et * 1.2 + c.k) * .05 * ob);
      }
    }
    // estela
    for (let i = 0; i < TRN; i++){ if (trAge[i] < 1){ trAge[i] += dt * 1.9; if (trAge[i] > 1) trAge[i] = 1; } }
    trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true; trGeo.attributes.aAge.needsUpdate = true; trGeo.attributes.aSize.needsUpdate = true;

    if (et > tDone){ const ob = Math.min(1, (et - tDone) / 1.6); orbits.forEach(o => o.material.opacity = .55 * ob); labels.forEach((l, i) => { l.position.y = (centers[i][1] + teamH / 2 - labelH / 2) * (1 - ob) + (centers[i][1] - labelH * .2) * ob; }); }
    // final: fuegos artificiales en modo ganador, acorde
    if (et >= tDone && !g.chord){ g.chord = true; pulse = 1; S && S.chord(); shake = Math.max(shake, .3); cards.forEach(c => shock(c.end.clone().setZ(.02), c.color.getHex(), cw * .7, .8)); }
    if (win && et >= tDone && et - lastFw > .32){
      lastFw = et;
      const p = new T.Vector3((Math.random() - .5) * VW * .9, yAt(.35 + Math.random() * .5), -1 - Math.random() * 3);
      burst(p, q.mob ? 220 : 420, Math.random(), 7, .1, 1.6); S && S.boom(false);
    }

    // efectos temporales
    for (let i = fxList.length - 1; i >= 0; i--){
      const f = fxList[i]; f.t += dt; const k = Math.min(1, f.t / f.dur);
      f.upd(f.obj, k, dt);
      if (k >= 1){ scene.remove(f.obj); f.obj.geometry !== ringGeo && f.obj.geometry.dispose(); f.obj.material.dispose(); fxList.splice(i, 1); }
    }

    // lente de cámara: aberración cromática ∝ velocidad del warp y a cada golpe; el bloom late con la música
    pulse *= Math.pow(.04, dt);
    if (post.ca){ const v = caBase + (et < tBoom ? .0042 * Math.pow(et / tBoom, 2) : 0) + pulse * .0034 + shake * .0012; post.ca.offset.set(v, v); }
    if (post.bloom) post.bloom.intensity = bloomBase * (1 + pulse * .55 + (et < tBoom ? .35 * (et / tBoom) : 0));

    // cámara: temblor + paneo suave al final
    shake *= Math.pow(.02, dt);
    const pan = et > tDone ? Math.min(1, (et - tDone) / 1.5) : 0;
    cam.position.set((Math.random() - .5) * shake + Math.sin((et - tDone) * .6) * .9 * pan, (Math.random() - .5) * shake, 14);
    if (et > tBoom) cam.lookAt(0, 0, 0);
  });
}
