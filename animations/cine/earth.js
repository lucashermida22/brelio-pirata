// Tierra 3D para la intro de cine: textura procedural, nubes, atmósfera y amanecer.
let EARTH_TEX = null;
function earthTextures(){
  if (EARTH_TEX) return EARTH_TEX;
  const W = 720, H = 360, n1 = noiseFactory(7), n2 = noiseFactory(91), n3 = noiseFactory(33), n4 = noiseFactory(55);
  const mkC = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const col = mkC(), cld = mkC(), ngt = mkC(), spc = mkC();
  const ci = col.getContext('2d').createImageData(W, H), cl = cld.getContext('2d').createImageData(W, H), ni = ngt.getContext('2d').createImageData(W, H), si = spc.getContext('2d').createImageData(W, H);
  const fbm = (nz, x, y, z, o) => { let a = 0, f = 1, amp = .5; for (let i = 0; i < o; i++){ a += amp * nz(x * f, y * f, z * f); f *= 2.03; amp *= .5; } return a; };
  for (let j = 0; j < H; j++){
    const lat = (j / H - .5) * Math.PI, cy = Math.cos(lat), sy = Math.sin(lat);
    for (let i = 0; i < W; i++){
      const lon = (i / W) * Math.PI * 2, x = Math.cos(lon) * cy, z = Math.sin(lon) * cy, y = sy;
      const h = fbm(n1, x * 1.6 + 3, y * 1.6, z * 1.6, 6) + .08;
      const m = fbm(n3, x * 3, y * 3, z * 3, 4);
      const ice = Math.abs(sy) > .9 - fbm(n2, x * 4, y * 4, z * 4, 3) * .2;
      let r, g, b, sea = 0, city = 0;
      if (ice){ r = 236; g = 242; b = 248; }
      else if (h < 0){ const d = Math.min(1, -h * 3.5); r = 6 + 22 * (1 - d); g = 34 + 66 * (1 - d); b = 84 + 76 * (1 - d); sea = 1; }
      else if (h < .03){ r = 194; g = 178; b = 128; city = .6; }
      else { const dry = m > .08 && Math.abs(sy) < .5; r = dry ? 176 : 54 + h * 160; g = dry ? 150 : 110 + h * 90; b = dry ? 96 : 46 + h * 40; if (h > .32){ r = g = b = 210; } city = dry ? .25 : 1; }
      const o = (j * W + i) * 4;
      ci.data[o] = r; ci.data[o + 1] = g; ci.data[o + 2] = b; ci.data[o + 3] = 255;
      const c = fbm(n2, x * 2.6 + 9, y * 5.2, z * 2.6, 5), a = Math.max(0, Math.min(1, (c + .02) * 3.2));
      cl.data[o] = cl.data[o + 1] = cl.data[o + 2] = 255; cl.data[o + 3] = a * 235;
      // luces de ciudades: racimos en tierra templada
      const u = fbm(n4, x * 34, y * 34, z * 34, 2), v2 = fbm(n3, x * 6, y * 6, z * 6, 2), dens = city * Math.max(0, 1 - Math.abs(sy) * 1.3) * (v2 > -.02 ? 1 : .15);
      const lit = u > .22 - dens * .08 ? Math.min(1, (u - .18) * 7) * dens * .8 : 0;
      ni.data[o] = 255 * lit; ni.data[o + 1] = 190 * lit; ni.data[o + 2] = 110 * lit; ni.data[o + 3] = 255;
      si.data[o] = si.data[o + 1] = si.data[o + 2] = sea * 255; si.data[o + 3] = 255;
    }
  }
  col.getContext('2d').putImageData(ci, 0, 0); cld.getContext('2d').putImageData(cl, 0, 0);
  ngt.getContext('2d').putImageData(ni, 0, 0); spc.getContext('2d').putImageData(si, 0, 0);
  return (EARTH_TEX = { col, cld, ngt, spc });
}


export function cineEarth(ctx, canvas){
  const A = ctx.A, T = ctx.kit.threeNS(), glowCanvas = ctx.kit.glowCanvas; let W = innerWidth, H = innerHeight, renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false }); } catch(e) { return null; }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(W, H, false);
  renderer.setClearColor(0x010208, 1);
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(38, W / H, .1, 4000); scene.add(cam);
  let composer = null;
  try { if (T.EffectComposer && T.UnrealBloomPass){ composer = new T.EffectComposer(renderer); composer.addPass(new T.RenderPass(scene, cam)); composer.addPass(new T.UnrealBloomPass(new T.Vector2(W, H), 1.35, .85, .5)); } } catch(e) { composer = null; }
  const onResize = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); composer && composer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); };
  addEventListener('resize', onResize);
  const mk = c => { const t = new T.CanvasTexture(c); t.anisotropy = 8; return t; };
  const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };
  const { col, cld, ngt, spc } = earthTextures();

  // ---- estrellas: estelas durante el salto, deriva con paralaje después ----
  const SN = 3200, sPos = new Float32Array(SN * 6), sCol = new Float32Array(SN * 6), sD = [];
  for (let i = 0; i < SN; i++){
    const p = new T.Vector3((Math.random() - .5) * 900, (Math.random() - .5) * 900, -1600 + Math.random() * 1900);
    if (p.length() < 60) p.multiplyScalar(3);
    const k = .45 + Math.random() * .55, warm = Math.random();
    sD.push(p); sCol.set([k, k * (.9 + warm * .1), k * (.75 + (1 - warm) * .25), k * .2, k * .2, k * .2], i * 6);
  }
  const sGeo = new T.BufferGeometry(); sGeo.setAttribute('position', new T.BufferAttribute(sPos, 3)); sGeo.setAttribute('color', new T.BufferAttribute(sCol, 3));
  scene.add(new T.LineSegments(sGeo, new T.LineBasicMaterial({ vertexColors: true, ...AB })));
  const dGeo = new T.BufferGeometry(); dGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(sD.flatMap(p => [p.x, p.y, p.z])), 3));
  dGeo.setAttribute('color', new T.BufferAttribute(new Float32Array(sD.flatMap((_, i) => [sCol[i*6], sCol[i*6+1], sCol[i*6+2]])), 3));
  const dot = mk(glowCanvas([[0, 'rgba(255,255,255,1)'], [.3, 'rgba(255,255,255,.7)'], [1, 'rgba(255,255,255,0)']]));
  scene.add(new T.Points(dGeo, new T.PointsMaterial({ size: 3.2, map: dot, vertexColors: true, ...AB })));

  // ---- Tierra con día/noche, océanos que brillan, nubes y atmósfera ----
  const R = 10, sunDir = new T.Vector3(.05, .22, -1).normalize(), S = sunDir.clone().multiplyScalar(1800);
  const earth = new T.Group(); earth.rotation.z = -.32; scene.add(earth);
  const uni = { day: { value: mk(col) }, night: { value: mk(ngt) }, spec: { value: mk(spc) }, sun: { value: sunDir } };
  const globe = new T.Mesh(new T.SphereGeometry(R, 128, 128), new T.ShaderMaterial({ uniforms: uni,
    vertexShader: 'varying vec3 vN; varying vec3 vW; varying vec2 vU; void main(){ vU = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D day, night, spec; uniform vec3 sun; varying vec3 vN; varying vec3 vW; varying vec2 vU;
      void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW); float d = dot(N, sun);
        vec3 c = texture2D(day, vU).rgb; c = pow(c, vec3(2.2));
        vec3 col = c * (max(d, 0.) * 1.35 + .012);
        col += pow(texture2D(night, vU).rgb, vec3(1.8)) * smoothstep(.12, -.22, d) * 1.5;
        float s = texture2D(spec, vU).r; col += vec3(1., .86, .62) * pow(max(dot(reflect(-sun, N), V), 0.), 60.) * s * 2.2 * step(0., d);
        col += vec3(1., .42, .14) * pow(1. - abs(d), 10.) * .35 * step(-.08, d);
        float f = pow(1. - max(dot(N, V), 0.), 3.); col += vec3(.3, .6, 1.) * f * (max(d + .25, 0.)) * .9;
        gl_FragColor = vec4(pow(col, vec3(1. / 2.2)), 1.); }` }));
  const cloudUni = { map: { value: mk(cld) }, sun: { value: sunDir } };
  const clouds = new T.Mesh(new T.SphereGeometry(R * 1.013, 128, 128), new T.ShaderMaterial({ uniforms: cloudUni, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vN; varying vec2 vU; void main(){ vU = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform sampler2D map; uniform vec3 sun; varying vec3 vN; varying vec2 vU; void main(){ float a = texture2D(map, vU).a; float d = dot(normalize(vN), sun); vec3 c = mix(vec3(1., .62, .38), vec3(1.), smoothstep(0., .35, d)) * (max(d, 0.) * 1.05 + .02); gl_FragColor = vec4(c, a * .92); }' }));
  const atmo = new T.Mesh(new T.SphereGeometry(R * 1.16, 96, 96), new T.ShaderMaterial({ uniforms: { sun: { value: sunDir } }, side: T.BackSide, ...AB,
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 sun; varying vec3 vN; varying vec3 vW; void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
      float f = pow(max(0., 1. - abs(dot(N, V)) * 1.04), 4.); float d = dot(-N, sun); float lit = smoothstep(-.45, .5, d);
      vec3 c = mix(vec3(1., .5, .2), vec3(.35, .65, 1.), smoothstep(.1, .6, d)); gl_FragColor = vec4(c * f * (.08 + lit * 2.4), 1.); }` }));
  earth.add(globe, clouds, atmo);

  // ---- sol + destello de lente ----
  const sunSprites = [];
  const sunSp = (c, sc, op) => { const s = new T.Sprite(new T.SpriteMaterial({ map: mk(c), ...AB, depthTest: false, opacity: 0 })); s.position.copy(S); s.scale.setScalar(sc); s.userData = { sc, op }; scene.add(s); sunSprites.push(s); return s; };
  sunSp(glowCanvas([[0, 'rgba(255,255,255,1)'], [.08, 'rgba(255,250,235,1)'], [.25, 'rgba(255,210,150,.5)'], [1, 'rgba(0,0,0,0)']]), 420, 1);
  sunSp(glowCanvas([[0, 'rgba(255,190,120,.45)'], [.4, 'rgba(255,140,60,.15)'], [1, 'rgba(0,0,0,0)']]), 1500, 1);
  const burst = sunSp(flareCanvas('burst'), 1100, .9);
  const streakC = document.createElement('canvas'); streakC.width = 1024; streakC.height = 64;
  { const g = streakC.getContext('2d'), gr = g.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, 'rgba(120,170,255,0)'); gr.addColorStop(.5, 'rgba(235,245,255,1)'); gr.addColorStop(1, 'rgba(120,170,255,0)'); g.fillStyle = gr; g.fillRect(0, 29, 1024, 6); }
  const streak = sunSp(streakC, 1, 1); streak.userData.streak = true;
  const ghosts = [[.25, 'hex', '120,200,255', 1.1], [.45, 'ring', '255,180,120', 2.2], [.62, 'hex', '170,255,190', .7], [.9, 'hex', '255,150,220', 1.5], [1.25, 'ring', '140,170,255', 3.1], [1.5, 'hex', '255,220,140', .9]]
    .map(([f, k, rgb, s]) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: mk(flareCanvas(k, rgb)), ...AB, depthTest: false, opacity: 0 })); sp.userData = { f, s }; cam.add(sp); return sp; });

  // ---- cámara: salto entre estrellas → órbita → amanecer → horizonte ----
  const ease3 = k => 1 - Math.pow(1 - k, 3), inout = k => k < .5 ? 4 * k ** 3 : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const up = A.upAt / 1000, look = new T.Vector3(), tmp = new T.Vector3(), cp = new T.Vector3();
  const fwd = new T.Vector3(), side = new T.Vector3(), upv = new T.Vector3(), rel = new T.Vector3();
  const t0 = performance.now(); let raf, prevZ = null, sunSeen = -1, prev = t0;
  const frame = now => {
    const et = (now - t0) / 1000, dt = Math.min(.05, (now - prev) / 1000); prev = now;
    const kW = ease3(Math.min(1, et / 2.7)), kO = inout(Math.min(1, Math.max(0, (et - 1.6) / 2.6))), kU = inout(Math.min(1, Math.max(0, (et - up) / 1.8)));
    const D = 520 - 480 * kW - 6 * kO - 12 * kU + 0;
    const th = -.55 + .5 * kW + .62 * kO + .1 * kU + Math.max(0, et - up - 1.8) * .012;
    const hgt = .38 - .3 * kO - .02 * kU;
    cp.set(Math.sin(th) * D, hgt * D, Math.cos(th) * D);
    cam.position.copy(cp);
    look.set(0, R * (.62 + .2 * kO) * (1 - kU) + R * 1.18 * kU, 0);
    cam.lookAt(look); cam.rotateZ(Math.sin(et * .35) * .015 + (1 - kW) * .08);
    // estelas de estrellas según la velocidad de la cámara
    const speed = prevZ === null ? 0 : Math.abs(D - prevZ) / dt; prevZ = D;
    // al final: vuelo hacia delante, las estrellas pasan a toda velocidad junto a la cámara
    const kF = Math.min(1, Math.max(0, (et - up - .5) / 1.6)), flow = 520 * kF * kF * (3 - 2 * kF);
    let dir, len;
    if (flow > 1){
      fwd.copy(look).sub(cp).normalize(); side.crossVectors(fwd, cam.up).normalize(); upv.crossVectors(side, fwd);
      const dPts = dGeo.attributes.position.array;
      for (let i = 0; i < SN; i++){
        const p = sD[i]; p.addScaledVector(fwd, -flow * dt);
        if (rel.copy(p).sub(cp).dot(fwd) < 2){
          const a = Math.random() * Math.PI * 2, r = 25 + Math.pow(Math.random(), .6) * 380;
          p.copy(cp).addScaledVector(fwd, 600 + Math.random() * 900).addScaledVector(side, Math.cos(a) * r).addScaledVector(upv, Math.sin(a) * r);
        }
        dPts[i * 3] = p.x; dPts[i * 3 + 1] = p.y; dPts[i * 3 + 2] = p.z;
      }
      dGeo.attributes.position.needsUpdate = true;
      dir = fwd; len = flow * .09 + .4;
    } else { dir = tmp.copy(cp).normalize(); len = Math.min(160, speed * .06) + .4; }
    for (let i = 0; i < SN; i++){ const p = sD[i]; sPos.set([p.x, p.y, p.z, p.x + dir.x * len, p.y + dir.y * len, p.z + dir.z * len], i * 6); }
    sGeo.attributes.position.needsUpdate = true;
    globe.rotation.y = et * .03; clouds.rotation.y = et * .042;
    // visibilidad del sol: cuánto asoma por detrás del planeta
    const toS = tmp.copy(S).sub(cp).normalize(), tc = -cp.dot(toS), closest = Math.sqrt(Math.max(0, cp.lengthSq() - tc * tc));
    const vis = tc < 0 ? 1 : Math.min(1, Math.max(0, (closest - R * .985) / (R * .16)));
    if (vis > .05 && sunSeen < 0) sunSeen = et;
    const pop = sunSeen < 0 ? 0 : 1 + 2.2 * Math.exp(-(et - sunSeen) * 2.6);
    sunSprites.forEach(s => {
      s.material.opacity = s.userData.op * vis * Math.min(1, pop);
      if (s.userData.streak) s.scale.set(5200 * vis * pop, 110 * vis + 1, 1); else s.scale.setScalar(s.userData.sc * (.5 + .5 * vis) * Math.max(1, pop * .8));
    });
    burst.material.rotation = et * .05;
    // fantasmas de la lente en la línea sol → centro de pantalla
    const ndc = tmp.copy(S).project(cam), hh = Math.tan(T.MathUtils.degToRad(cam.fov / 2)) * 10, hw = hh * cam.aspect;
    const onScreen = ndc.z < 1 ? 1 : 0;
    ghosts.forEach(g => { const f = g.userData.f; g.position.set(ndc.x * hw * (1 - 2 * f), ndc.y * hh * (1 - 2 * f), -10); g.scale.setScalar(g.userData.s * (.6 + .4 * vis)); g.material.opacity = vis * onScreen * .55 * Math.min(1.6, pop); });
    composer ? composer.render() : renderer.render(scene, cam);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf); removeEventListener('resize', onResize);
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material){ o.material.map && o.material.map.dispose(); o.material.uniforms && Object.values(o.material.uniforms).forEach(u => u.value && u.value.dispose && u.value.dispose()); o.material.dispose(); } });
    try { renderer.dispose(); renderer.forceContextLoss(); } catch(e) {}
  };
}

// la textura se genera en segundo plano al cargar, para que la intro empiece al instante
addEventListener('load', () => setTimeout(() => { try { earthTextures(); } catch(e) {} }, 1200));

