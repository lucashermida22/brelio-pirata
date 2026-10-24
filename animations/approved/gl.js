// =====================================================================
//  APPROVED · capa WebGL (motor común r185: PBR lineal/HDR + sombras + AO + bloom)
//  - fondo: el despacho en 3D (madera con relieve, diplomas con cristal, apliques,
//    sombras reales, haces de luz y polvo en suspensión)
//  - delante: papelitos, confeti dorado y gotas de tinta que saltan en cada sellazo
//  - easter egg: Álvaro se va en moto hacia el sol (atardecer completo: cielo, nubes,
//    sierras con bruma, carretera, postes, cactus, godrays y moto con sombra larga)
//  Todo procedural; si no hay WebGL, la animación sigue con su versión CSS.
// =====================================================================

export async function setupGL(ctx, root) {
  let base = null;
  try {
    base = await ctx.three({
      clear: 0x1a0a05, fov: 38, near: .3, far: 4200, tone: 'neutral', env: true, envIntensity: .32,
      bloom: { intensity: .85, threshold: .8, radius: .75, smoothing: .25 },
      ao: { radius: 1.1, intensity: 3, falloff: 1.6, color: 0x120400 },
      godrays: true, vignette: { offset: .3, darkness: .55 }, grain: .045, ca: .0005,
    });
  } catch (e) { base = null; }
  if (!base) return null;
  const { T, scene, cam, tex, q, renderer, post } = base;
  root.classList.add('ap-gl');

  // ---------- utilidades ----------
  const rng = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);   // aleatorio con semilla (texturas estables)
  const rnd = rng(20260);
  const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const soft = tex(cv(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,240,210,.55)'); gr.addColorStop(1, 'rgba(255,220,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }));
  const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };
  const hdr = (hex, k) => new T.Color(hex).multiplyScalar(k);
  const lin = (c) => { const t = tex(c, { linear: true }); return t; };
  const rep = (t, x, y) => { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(x, y); return t; };
  // cilindro/varilla entre dos puntos
  const rod = (parent, a, b, r, m, r2 = r) => {
    const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), len = d.length();
    const o = new T.Mesh(new T.CylinderGeometry(r2, r, len, 12), m); o.position.copy(A).add(B).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  };
  const tube = (parent, pts, r, m, seg = 28) => {
    const o = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p))), seg, r, 10, false), m);
    o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  };
  const put = (parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true) => {
    const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o;
  };

  // =====================================================================
  //  EL DESPACHO
  // =====================================================================
  const office = new T.Group(); scene.add(office);

  // --- madera: color + relieve + rugosidad generados a la vez (vetas, poros y anillos) ---
  function woodMaps(W, H, seed) {
    const sn = new T.SimplexNoise({ random: rng(seed) });
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); return [c, g, g.createImageData(W, H)]; };
    const [cA, gA, iA] = mk(), [cB, gB, iB] = mk(), [cR, gR, iR] = mk();
    const D = [[38, 15, 6], [92, 42, 18], [150, 82, 38]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H, k = (y * W + x) * 4;
      const warp = sn.noise(u * 2.2, v * 1.1) * 1.4 + sn.noise(u * 6 + 3, v * 2.5) * .35;
      const ring = u * 7 + warp, band = Math.pow(Math.sin((ring - Math.floor(ring)) * Math.PI), 1.3);
      const fib = sn.noise(u * 150, v * 5) * .5 + sn.noise(u * 320, v * 14) * .25;
      const pr = sn.noise(u * 260 + 7, v * 30), pore = pr > .6 ? (pr - .6) * 2.6 : 0;
      const t = clamp(.5 + (band - .5) * .55 + fib * .5 - pore * .55);
      const a = t < .5 ? D[0] : D[1], b = t < .5 ? D[1] : D[2], kk = t < .5 ? t * 2 : (t - .5) * 2;
      iA.data[k] = lerp(a[0], b[0], kk); iA.data[k + 1] = lerp(a[1], b[1], kk); iA.data[k + 2] = lerp(a[2], b[2], kk); iA.data[k + 3] = 255;
      const hh = 255 * clamp(.6 - band * .22 + fib * .22 - pore * .55);
      iB.data[k] = iB.data[k + 1] = iB.data[k + 2] = hh; iB.data[k + 3] = 255;
      const rr = 255 * clamp(.62 + fib * .28 + pore * .4 - (1 - band) * .1);
      iR.data[k] = iR.data[k + 1] = iR.data[k + 2] = rr; iR.data[k + 3] = 255;
    }
    gA.putImageData(iA, 0, 0); gB.putImageData(iB, 0, 0); gR.putImageData(iR, 0, 0);
    return { map: tex(cA), bump: lin(cB), rough: lin(cR) };
  }
  const WS = q.mob ? [256, 512] : [384, 768];
  const wood = woodMaps(WS[0], WS[1], 31);
  const woodM = new T.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 2.2, roughnessMap: wood.rough, roughness: 1, metalness: 0, vertexColors: true });

  // paredes: tablones verticales con bisel y junta (sombras reales entre tablas)
  {
    const PW = .5, gs = [];
    for (let i = -32; i < 32; i++) {
      const g = new T.RoundedBoxGeometry(PW - .028, 9.4, .12, 2, .014);
      const uv = g.attributes.uv, uo = rnd() * .6, vo = rnd() * .5, flip = rnd() > .5;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, (flip ? 1 - uv.getX(j) : uv.getX(j)) * .4 + uo, uv.getY(j) * .5 + vo);
      const tint = .78 + rnd() * .38, hue = (rnd() - .5) * .1, n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let j = 0; j < n; j++) { col[j * 3] = tint * (1 + hue); col[j * 3 + 1] = tint; col[j * 3 + 2] = tint * (1 - hue * 1.4); }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.translate(i * PW + PW / 2, .3, -1.94); gs.push(g);
    }
    const wall = new T.Mesh(T.mergeGeometries(gs, false), woodM); wall.castShadow = true; wall.receiveShadow = true; office.add(wall);
    const back = new T.Mesh(new T.PlaneGeometry(40, 14), new T.MeshStandardMaterial({ color: 0x0c0402, roughness: 1 })); back.position.set(0, 0, -2.02); back.receiveShadow = true; office.add(back);
  }
  // zócalo oscuro con molduras (la parte alta queda en pantalla en pantallas anchas)
  const darkM = new T.MeshPhysicalMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 1.6, roughnessMap: wood.rough, roughness: .8, color: 0x7a4a3a, clearcoat: .35, clearcoatRoughness: .4 });
  {
    const rail = new T.Mesh(new T.RoundedBoxGeometry(40, .2, .3, 3, .06), new T.MeshPhysicalMaterial({ color: 0xa5602f, roughness: .38, clearcoat: .8, clearcoatRoughness: .2, map: wood.map, bumpMap: wood.bump, bumpScale: 1 }));
    rail.position.set(0, -1.1, -1.8); rail.castShadow = rail.receiveShadow = true; office.add(rail);
    const cap = new T.Mesh(new T.RoundedBoxGeometry(40, .09, .36, 2, .03), darkM); cap.position.set(0, -.93, -1.78); cap.castShadow = cap.receiveShadow = true; office.add(cap);
    const crown = new T.Mesh(new T.RoundedBoxGeometry(40, .26, .34, 3, .08), darkM); crown.position.set(0, 4.38, -1.8); crown.castShadow = crown.receiveShadow = true; office.add(crown);
    const crown2 = new T.Mesh(new T.RoundedBoxGeometry(40, .14, .2, 2, .05), darkM); crown2.position.set(0, 4.18, -1.86); office.add(crown2);
    // paneles resaltados bajo el zócalo
    const pm = new T.MeshPhysicalMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 1.6, roughnessMap: wood.rough, color: 0x9a6a55, roughness: .75, clearcoat: .3 });
    for (let i = -9; i <= 9; i++) { const p = new T.Mesh(new T.RoundedBoxGeometry(1.6, 1.5, .1, 3, .035), pm); p.position.set(i * 2.1, -2.0, -1.84); p.castShadow = p.receiveShadow = true; office.add(p); }
  }

  // --- marcos con cristal reflectante (aditivo: solo suma el reflejo del entorno) ---
  const gold = new T.MeshPhysicalMaterial({ color: 0xc99a34, metalness: 1, roughness: .3, clearcoat: .5, clearcoatRoughness: .2, envMapIntensity: 1.1 });
  const brass = new T.MeshStandardMaterial({ color: 0xb98a3c, metalness: 1, roughness: .32, envMapIntensity: 1.3 });
  const matM = new T.MeshStandardMaterial({ color: 0xf1e6cb, roughness: .95 });
  const glareT = tex(cv(256, 256, (g) => { const gr = g.createLinearGradient(0, 256, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.38, 'rgba(255,240,215,0)'); gr.addColorStop(.46, 'rgba(255,240,215,.55)'); gr.addColorStop(.52, 'rgba(255,240,215,.0)'); gr.addColorStop(.6, 'rgba(255,240,215,.28)'); gr.addColorStop(.66, 'rgba(255,240,215,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }));
  const glassM = new T.MeshStandardMaterial({ color: 0x000000, roughness: .03, metalness: 0, emissive: 0xffffff, emissiveMap: glareT, emissiveIntensity: .35, envMapIntensity: 1.6, ...AB });
  const frameGeo = (w, h, bw, depth = .07) => {
    const s = new T.Shape(); s.moveTo(-w / 2 - bw, -h / 2 - bw); s.lineTo(w / 2 + bw, -h / 2 - bw); s.lineTo(w / 2 + bw, h / 2 + bw); s.lineTo(-w / 2 - bw, h / 2 + bw); s.closePath();
    const hole = new T.Path(); hole.moveTo(-w / 2, -h / 2); hole.lineTo(-w / 2, h / 2); hole.lineTo(w / 2, h / 2); hole.lineTo(w / 2, -h / 2); hole.closePath(); s.holes.push(hole);
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 4, curveSegments: 4 }); g.translate(0, 0, -depth / 2); return g;
  };
  // diplomas dibujados: orla, título, texto y sello de lacre con cinta
  const dipCanvas = (w, h, variant) => cv(w, h, (g) => {
    g.fillStyle = '#f4ead0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(120,90,40,${rnd() * .05})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    g.strokeStyle = 'rgba(120,80,30,.75)'; g.lineWidth = w * .014; g.strokeRect(w * .06, h * .05, w * .88, h * .9);
    g.strokeStyle = 'rgba(160,110,40,.55)'; g.lineWidth = w * .005; g.strokeRect(w * .085, h * .075, w * .83, h * .85);
    g.fillStyle = '#5a3a16'; g.textAlign = 'center'; g.font = `600 ${w * .12}px Cinzel, Georgia, serif`; g.fillText(['DIPLOMA', 'MÉRITO', 'LICENCIA'][variant % 3], w / 2, h * .26);
    g.font = `italic ${w * .055}px Georgia, serif`; g.fillStyle = 'rgba(90,60,20,.8)'; g.fillText('se concede a', w / 2, h * .36);
    g.fillStyle = 'rgba(90,60,20,.6)'; for (let i = 0; i < 5; i++) g.fillRect(w * (.2 + (i % 2) * .05), h * (.44 + i * .065), w * (.6 - (i % 2) * .1), h * .014);
    g.strokeStyle = 'rgba(60,110,40,.75)'; g.lineWidth = w * .02; g.beginPath(); g.arc(w * .5, h * .82, w * .13, Math.PI * .65, Math.PI * 2.35); g.stroke();
    const gr = g.createRadialGradient(w * .5, h * .8, 2, w * .5, h * .82, w * .09); gr.addColorStop(0, '#ff6a8f'); gr.addColorStop(1, '#a3123f'); g.fillStyle = gr; g.beginPath(); g.arc(w * .5, h * .82, w * .085, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(w * .47, h * .8, w * .02, 0, 7); g.fill();
    g.fillStyle = '#a3123f'; g.fillRect(w * .44, h * .88, w * .045, h * .08); g.fillRect(w * .515, h * .88, w * .045, h * .08);
  });
  function frame(x, y, w, h, variant, tilt = 0, parent = office) {
    const f = new T.Group(); f.position.set(x, y, -1.86); f.rotation.z = tilt;
    const paperM = new T.MeshStandardMaterial({ map: tex(dipCanvas(256, Math.round(256 * h / w), variant)), roughness: .9 });
    put(f, new T.PlaneGeometry(w + .34, h + .34), matM, 0, 0, .012, 0, 0, 0, false);
    put(f, new T.PlaneGeometry(w, h), paperM, 0, 0, .02, 0, 0, 0, false);
    put(f, new T.PlaneGeometry(w + .02, h + .02), glassM, 0, 0, .055, 0, 0, 0, false).renderOrder = 3;
    put(f, frameGeo(w + .36, h + .36, .16), gold, 0, 0, .04);
    put(f, new T.PlaneGeometry(w + .4, h + .4), new T.MeshStandardMaterial({ color: 0x120804, roughness: 1 }), 0, 0, -.02, 0, 0, 0, false);
    // cordel y clavo
    const nail = put(f, new T.SphereGeometry(.035, 10, 8), brass, 0, h / 2 + .62, -.02); nail.castShadow = false;
    const ln = new T.BufferGeometry().setFromPoints([new T.Vector3(-w / 2, h / 2 + .17, .05), new T.Vector3(0, h / 2 + .62, -.02), new T.Vector3(w / 2, h / 2 + .17, .05)]);
    f.add(new T.Line(ln, new T.LineBasicMaterial({ color: 0x3a2610 })));
    parent.add(f); return f;
  }
  frame(-6.55, 3.05, 1.2, 1.55, 0, .02);
  frame(-4.55, 2.55, 1.2, 1.55, 1, -.015);
  frame(5.0, 2.7, 1.9, 1.3, 2, .01);
  frame(6.9, 3.0, 1.1, 1.45, 0, -.02);
  frame(-2.1, 3.5, .8, .8, 1, .0);   // pequeño, bajo el marco del vídeo en pantallas muy anchas
  // placa de latón
  {
    const plc = cv(256, 96, (g) => { g.fillStyle = '#b98a3c'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#3a2208'; g.font = '700 30px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.fillText('APROBADO', 128, 44); g.font = '500 17px Georgia, serif'; g.fillText('Sección de pachangas', 128, 72); });
    const plq = new T.Mesh(new T.RoundedBoxGeometry(1.2, .45, .05, 2, .02), new T.MeshStandardMaterial({ map: tex(plc), metalness: .8, roughness: .35, envMapIntensity: 1.2 })); plq.position.set(-4.55, 1.35, -1.88); plq.castShadow = plq.receiveShadow = true; office.add(plq);
  }

  // --- apliques de latón con pantalla de cristal esmerilado (luz puntual cálida) ---
  const sconceL = [];
  function sconce(x, y) {
    const g = new T.Group(); g.position.set(x, y, -1.86);
    put(g, new T.CylinderGeometry(.13, .16, .05, 28), brass, 0, 0, .02, Math.PI / 2);
    tube(g, [[0, 0, .03], [0, 0, .16], [0, .09, .3], [0, .22, .34]], .016, brass);
    put(g, new T.CylinderGeometry(.075, .045, .05, 20), brass, 0, .24, .34);
    const lampM = new T.MeshBasicMaterial({ color: hdr(0xffc27a, 6) });
    put(g, new T.SphereGeometry(.065, 16, 12), lampM, 0, .34, .34, 0, 0, 0, false).scale.y = 1.4;
    put(g, new T.LatheGeometry([[.05, 0], [.1, .08], [.12, .2], [.1, .3], [.07, .34]].map(([a, b]) => new T.Vector2(a, b)), 24), new T.MeshPhysicalMaterial({ color: 0xffe8c4, roughness: .45, transparent: true, opacity: .32, side: T.DoubleSide, depthWrite: false, clearcoat: 1 }), 0, .22, .34, 0, 0, 0, false);
    const l = new T.PointLight(0xffb15a, 4.5, 11, 2); l.position.set(0, .35, .6); g.add(l); sconceL.push(l);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: soft, color: hdr(0xffb05a, 1.1), ...AB })); halo.scale.setScalar(1.6); halo.position.set(0, .34, .5); g.add(halo);
    office.add(g); return g;
  }
  sconce(-3.35, 1.55); sconce(3.45, 1.55);

  // --- luces: foco de techo con sombra, relleno hemisférico y calidez de rebote ---
  office.add(new T.HemisphereLight(0xffd0a0, 0x2a0e04, .55));
  const key = new T.SpotLight(0xffc48a, 340, 60, .6, .6, 2); key.position.set(-3.5, 7.5, 6.5); key.target.position.set(0, 1, -2);
  key.castShadow = true; key.shadow.mapSize.set(q.mob ? 1024 : 2048, q.mob ? 1024 : 2048); key.shadow.camera.near = 2; key.shadow.camera.far = 30;
  key.shadow.bias = -.0004; key.shadow.normalBias = .03; key.shadow.radius = 4; key.shadow.blurSamples = 12;
  office.add(key, key.target);
  const rim = new T.DirectionalLight(0xff8a50, .6); rim.position.set(6, 2, 4); office.add(rim);

  // --- haces de luz (shader aditivo con vetas suaves) y polvo ---
  const shaftMat = (c, k, seed) => new T.ShaderMaterial({ ...AB, side: T.DoubleSide, uniforms: { uT: { value: 0 }, uC: { value: new T.Color(c) }, uK: { value: k }, uS: { value: seed } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uT, uK, uS; uniform vec3 uC;
      void main(){ float x = abs(vUv.x - .5) * 2.; float edge = pow(max(1. - x, 0.), 1.7); float along = smoothstep(0., .2, vUv.y) * pow(max(1. - vUv.y, 0.), .9);
        float st = .62 + .38 * sin(vUv.x * 21. + uS + uT * .14) * sin(vUv.x * 7. - uT * .08 + uS * 2.);
        float a = edge * along * st * uK; gl_FragColor = vec4(uC * 1.3, a); }` });
  const shafts = [[-1.8, 2.6, -1.1, -.52, 3.2, 17, 0xffd49a, .5], [-.2, 3, -1.2, -.58, 2.2, 16, 0xffc78a, .34], [2.2, 3.1, -1.3, -.47, 2.6, 15, 0xffb97a, .28]].map(([x, y, z, rz, w, h, c, k], i) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), shaftMat(c, k, i * 1.7)); m.position.set(x, y, z); m.rotation.z = rz; m.renderOrder = 5; office.add(m); return m;
  });
  const DN = q.mob ? 140 : 280, dpos = new Float32Array(DN * 3), dsp = [];
  for (let i = 0; i < DN; i++) { dpos.set([(Math.random() - .5) * 14, (Math.random() - .5) * 9 + 1, Math.random() * 5 - 1.5], i * 3); dsp.push(Math.random() * 6.28); }
  const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dpos, 3));
  const dust = new T.Points(dg, new T.PointsMaterial({ map: soft, size: .075, color: hdr(0xffd6a0, 1.6), ...AB, opacity: .6 })); office.add(dust);
  // bokeh de polvo cercano (grande y tenue)
  const BN = q.mob ? 10 : 22, bpos = new Float32Array(BN * 3);
  for (let i = 0; i < BN; i++) bpos.set([(Math.random() - .5) * 10, (Math.random() - .5) * 5 + .8, 4 + Math.random() * 2.5], i * 3);
  const bg2 = new T.BufferGeometry(); bg2.setAttribute('position', new T.BufferAttribute(bpos, 3));
  const bokeh = new T.Points(bg2, new T.PointsMaterial({ map: soft, size: .55, color: hdr(0xffcf96, 1.3), ...AB, opacity: .1 })); office.add(bokeh);

  // =====================================================================
  //  CAPA DELANTERA: papelitos, confeti dorado y tinta (renderer transparente aparte)
  // =====================================================================
  const fcv = document.createElement('canvas'); fcv.className = 'ap-glfx'; root.appendChild(fcv);
  let fr = null, fenvRT = null, fpm = null;
  try { fr = new T.WebGLRenderer({ canvas: fcv, alpha: true, antialias: true, powerPreference: 'high-performance' }); } catch (e) { fr = null; fcv.remove(); }
  const fscene = new T.Scene(), fcam = new T.PerspectiveCamera(50, 1, .1, 100); fcam.position.z = 10;
  if (fr) {
    fr.setClearColor(0x000000, 0); fr.outputColorSpace = T.SRGBColorSpace; fr.toneMapping = T.NeutralToneMapping;
    try { fpm = new T.PMREMGenerator(fr); fenvRT = fpm.fromScene(new T.RoomEnvironment(), .04); fscene.environment = fenvRT.texture; fscene.environmentIntensity = .9; } catch (e) { fpm = null; }
  }
  fscene.add(new T.HemisphereLight(0xffffff, 0xb59a80, 1.4)); const fl = new T.DirectionalLight(0xfff0dc, 2.4); fl.position.set(2, 4, 6); fscene.add(fl);
  // papel curvado, con rayas impresas; confeti rectangular; gota de tinta con volumen
  const paperG = (() => { const g = new T.PlaneGeometry(.2, .26, 4, 5), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.cos(x * 12) * .018 + Math.sin(y * 9) * .01); } g.computeVertexNormals(); return g; })();
  const paperT = tex(cv(64, 80, (g) => { g.fillStyle = '#fffdf6'; g.fillRect(0, 0, 64, 80); g.fillStyle = 'rgba(70,80,120,.35)'; for (let i = 0; i < 7; i++) g.fillRect(8, 12 + i * 9, 48 - (i % 3) * 10, 2); g.fillStyle = 'rgba(200,40,70,.5)'; g.fillRect(8, 6, 18, 3); }));
  const flakeG = new T.PlaneGeometry(.1, .055, 1, 1), dropG = new T.SphereGeometry(.05, 12, 8);
  const parts = [];
  let fW = 0, fH = 0, fRaf = 0, fPrev = 0;
  function fSize() { fW = root.clientWidth; fH = root.clientHeight; if (!fr) return; fr.setPixelRatio(Math.min(q.dpr, 2)); fr.setSize(fW, fH, false); fcam.aspect = fW / Math.max(1, fH); fcam.updateProjectionMatrix(); }
  fSize(); addEventListener('resize', fSize);
  const toWorld = (px, py) => { const vh = 2 * Math.tan(T.MathUtils.degToRad(25)) * 10, r = root.getBoundingClientRect(); return new T.Vector3(((px - r.left) / fW - .5) * vh * fcam.aspect, (.5 - (py - r.top) / fH) * vh, 0); };
  function fLoop(now) {
    const dt = Math.min(.05, (now - fPrev) / 1000 || .016); fPrev = now;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      if (p.t > p.life) { fscene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); continue; }
      p.v.y -= p.g * dt; p.v.multiplyScalar(1 - p.drag * dt); p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += p.w.x * dt; p.m.rotation.y += p.w.y * dt; p.m.rotation.z += p.w.z * dt;
      const o = Math.min(1, (p.life - p.t) / .35); p.m.material.opacity = o;
      if (p.drop) p.m.scale.set(p.s0 * (1 + p.v.length() * .012), p.s0 * (1 + p.v.length() * .03), p.s0 * (1 + p.v.length() * .012));
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
      const isDrop = kind !== 'gold' && i % 3 === 0, flake = kind === 'gold';
      let mat, geo;
      if (flake) { geo = flakeG; mat = new T.MeshStandardMaterial({ color: new T.Color().setHSL(.1 + Math.random() * .04, .85, .5 + Math.random() * .15), metalness: .95, roughness: .22 + Math.random() * .2, side: T.DoubleSide, transparent: true, envMapIntensity: 1.6 }); }
      else if (isDrop) { geo = dropG; mat = new T.MeshPhysicalMaterial({ color: inkC, roughness: .18, clearcoat: 1, clearcoatRoughness: .05, transparent: true }); }
      else { geo = paperG; mat = new T.MeshStandardMaterial({ map: paperT, color: new T.Color(0xffffff).lerp(new T.Color(0xe9dfc8), Math.random()), roughness: .85, side: T.DoubleSide, transparent: true }); }
      const m = new T.Mesh(geo, mat);
      m.position.copy(P).add(new T.Vector3((Math.random() - .5) * .6, (Math.random() - .5) * .4, Math.random() * .5));
      const s = flake ? .5 + Math.random() * .6 : big ? .7 + Math.random() * 1.1 : .45 + Math.random() * .5; m.scale.setScalar(s);
      const a = Math.random() * Math.PI * 2, sp = flake ? 4 + Math.random() * 7 : big ? 5 + Math.random() * 9 : 2 + Math.random() * 3.5;
      parts.push({ m, t: 0, life: (flake ? 2.6 : big ? 2 : 1.1) + Math.random() * .6, g: flake ? 5 : isDrop ? 14 : 7, drag: isDrop ? .6 : 1.8, drop: isDrop, s0: s,
        v: new T.Vector3(Math.cos(a) * sp, Math.sin(a) * sp * .8 + (flake ? 4 : 2.5), (Math.random() - .3) * sp),
        w: new T.Vector3((Math.random() - .5) * 14, (Math.random() - .5) * 14, (Math.random() - .5) * 10) });
      fscene.add(m);
    }
    if (!fRaf) { fPrev = performance.now(); fRaf = requestAnimationFrame(fLoop); }
  }

  // =====================================================================
  //  EASTER EGG: carretera al atardecer
  // =====================================================================
  let mode = 'office', bumpK = 0, egg = null;
  const mouse = { x: 0, y: 0 };
  const onMove = (e) => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; };
  addEventListener('pointermove', onMove);

  // fuente de godrays "apagada" mientras estamos en el despacho
  const idleSrc = new T.Mesh(new T.SphereGeometry(.01, 4, 4), new T.MeshBasicMaterial()); idleSrc.visible = false; idleSrc.position.set(0, 0, -60); scene.add(idleSrc);
  if (post.godrays) { post.godrays.lightSource = idleSrc; post.godrays.blendMode.opacity.value = 0; }
  const officeEnv = scene.environment, officeEnvK = scene.environmentIntensity;

  // paleta del atardecer (sRGB; los uniformes Color ya pasan a lineal)
  const PAL = { c0: 0xff9a52, c1: 0xf0603a, c2: 0xb83a62, c3: 0x522a72, c4: 0x120d33, ground: 0x3a1c2a, glow: 0xffb454, lit: 0xff7a40, dark: 0x4a2a6a, gold: 0xffd27a };
  const SUN_EL = .062;     // elevación del sol en radianes (~3.5°)
  const sunDir = new T.Vector3(0, Math.sin(SUN_EL), -Math.cos(SUN_EL)), lightDir = new T.Vector3(.12, Math.sin(.17), -Math.cos(.17)).normalize();

  const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uT: { value: 0 }, uSun: { value: sunDir.clone() }, c0: { value: new T.Color(PAL.c0) }, c1: { value: new T.Color(PAL.c1) }, c2: { value: new T.Color(PAL.c2) }, c3: { value: new T.Color(PAL.c3) }, c4: { value: new T.Color(PAL.c4) },
      cG: { value: new T.Color(PAL.ground) }, cGlow: { value: new T.Color(PAL.glow) }, cLit: { value: new T.Color(PAL.lit) }, cDark: { value: new T.Color(PAL.dark) }, cGold: { value: new T.Color(PAL.gold) }, uClouds: { value: 1 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec3 vD; uniform float uT, uClouds; uniform vec3 uSun, c0, c1, c2, c3, c4, cG, cGlow, cLit, cDark, cGold;
      float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f); return mix(mix(hs(i), hs(i + vec2(1,0)), f.x), mix(hs(i + vec2(0,1)), hs(i + vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * nz(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
      void main(){
        vec3 d = normalize(vD); float h = d.y;
        float t = pow(max(h, 0.), .55);
        vec3 c = mix(c0, c1, smoothstep(0., .13, t)); c = mix(c, c2, smoothstep(.1, .34, t)); c = mix(c, c3, smoothstep(.3, .6, t)); c = mix(c, c4, smoothstep(.52, 1., t));
        c = mix(cG, c, smoothstep(-.18, .0, h));
        float s = max(dot(d, uSun), 0.), band = 1. - smoothstep(0., .4, h);
        vec3 glow = cGlow * (pow(s, 3.) * .06 + pow(s, 14.) * .36 * (.35 + .65 * band) + pow(s, 90.) * 1.4) * smoothstep(-.05, .02, h + .03);
        c += glow;
        if (uClouds > 0. && h > .0){
          vec2 p = d.xz / (h + .1); vec2 q = vec2(p.x * .42 + uT * .006, p.y * 1.0);
          float f1 = fbm(q * 1.5), cov = smoothstep(.47, .8, f1);
          float f2 = fbm(vec2(q.x * .45, q.y * 3.2) + 4.), cir = smoothstep(.5, .92, f2) * .55 * smoothstep(.12, .5, h);
          float a = max(cov, cir);
          float f3 = fbm((q + vec2(0., -.08)) * 1.5), edge = clamp((f1 - f3) * 9. + .5, 0., 1.);
          float sa = pow(max(dot(d, uSun), 0.), 2.5);
          vec3 cc = mix(cDark, cLit * 1.5, edge); cc = mix(cc, cGold * (1.5 + 5. * pow(s, 8.)), edge * sa);
          cc = mix(cc, cDark * .55, smoothstep(.28, .85, h) * (1. - edge));
          c = mix(c, cc, a * smoothstep(.0, .09, h) * .92 * uClouds);
        }
        gl_FragColor = vec4(c, 1.);
      }` });

  // un poco de "bruma" de color de horizonte: lo usa la niebla de la escena
  const FOG = new T.Color(0xd9703f).multiplyScalar(.5);

  function buildSunset(faceImg) {
    const g = new T.Group(); scene.add(g);
    scene.fog = new T.FogExp2(FOG, innerWidth / innerHeight < .8 ? .0011 : .00085);

    // cielo (domo que sigue a la cámara) + disco solar HDR (fuente de godrays) + halo
    const sky = new T.Mesh(new T.SphereGeometry(1, 40, 24), skyMat); sky.scale.setScalar(3600); sky.renderOrder = -10; sky.frustumCulled = false; g.add(sky);
    const sunDisc = new T.Mesh(new T.CircleGeometry(1, 56), new T.MeshBasicMaterial({ color: hdr(0xffc878, 7.5), fog: false, transparent: true, depthWrite: false }));
    sunDisc.position.copy(sunDir).multiplyScalar(3500); sunDisc.scale.setScalar(110); g.add(sunDisc);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: soft, color: hdr(0xff9a4a, .9), ...AB, fog: false, depthTest: false })); halo.position.copy(sunDir).multiplyScalar(3400); halo.scale.setScalar(620); halo.renderOrder = -5; g.add(halo);

    // entorno: el propio cielo filtrado (reflejos naranjas en cromo y pintura)
    let pm = null, envRT = null;
    try {
      pm = new T.PMREMGenerator(renderer); const es = new T.Scene();
      const sk2 = new T.Mesh(sky.geometry, skyMat); sk2.scale.setScalar(3600); es.add(sk2);
      const sd2 = new T.Mesh(sunDisc.geometry, sunDisc.material); sd2.position.copy(sunDisc.position); sd2.scale.copy(sunDisc.scale); es.add(sd2);
      envRT = pm.fromScene(es, 0, 1, 4000); scene.environment = envRT.texture; scene.environmentIntensity = .55;
    } catch (e) { pm = null; }

    // --- terreno: malla no uniforme (densa cerca, rala lejos), un hueco central para la carretera ---
    const sn = new T.SimplexNoise({ random: rng(77) });
    const rid = (x, y) => 1 - Math.abs(sn.noise(x, y));
    const HW = 5.5;
    const heightAt = (x, z) => {
      const d = Math.abs(x) - HW, near = clamp(d / 14);
      let h = (sn.noise(x * .012 + 11, z * .012) * 1.3 + sn.noise(x * .045, z * .045 + 5) * .45) * near;
      const m = smooth(210, 900, d), r1 = rid(x * .0031, z * .0031 + 7), r2 = rid(x * .011 + 3, z * .011);
      h += m * (Math.pow(r1, 2.0) * 210 + r2 * r2 * 36) + smooth(40, 220, d) * rid(x * .02 + 9, z * .02) * 9;
      return h - .02;
    };
    const cSand = new T.Color(0x6e4a3a), cRock = new T.Color(0x3a2038), cDust = new T.Color(0x88604a), tc = new T.Color();
    const terrain = (side) => {
      const NX = q.mob ? 44 : 78, NZ = q.mob ? 150 : 250, pos = [], col = [], idx = [], uvs = [];
      for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
        const u = i / NX, w = j / NZ, x = side * (HW - .1 + Math.pow(u, 2.7) * 1700), z = 160 - Math.pow(w, 2.4) * 3900, y = heightAt(x, z);
        pos.push(x, y, z); uvs.push(x / 7, z / 7);
        tc.copy(cSand).lerp(cDust, clamp(sn.noise(x * .02, z * .02) * .5 + .5)).lerp(cRock, smooth(4, 110, y)); col.push(tc.r, tc.g, tc.b);
      }
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const m = new T.Mesh(geo, terrainM); m.receiveShadow = true; m.frustumCulled = false; g.add(m);
    };
    const sandT = rep(tex(cv(256, 256, (gg) => { gg.fillStyle = '#fff'; gg.fillRect(0, 0, 256, 256); for (let i = 0; i < 4000; i++) { const v = 200 + rnd() * 55; gg.fillStyle = `rgb(${v},${v - 14},${v - 30})`; gg.fillRect(rnd() * 256, rnd() * 256, 2, 2); } })), 1, 1);
    const terrainM = new T.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, bumpMap: sandT, bumpScale: 1.4, map: sandT });
    terrain(1); terrain(-1);

    // --- carretera: asfalto con grano, arcenes de grava, líneas pintadas y brillo húmedo ---
    const roadC = cv(256, 1024, (gg, w, h) => {
      gg.fillStyle = '#34282d'; gg.fillRect(0, 0, w, h);
      for (let i = 0; i < 14000; i++) { const v = 30 + rnd() * 50 | 0; gg.fillStyle = `rgba(${v + 14},${v + 8},${v + 8},${.25 + rnd() * .4})`; gg.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
      for (let i = 0; i < 7; i++) { gg.strokeStyle = `rgba(10,8,10,${.25 + rnd() * .3})`; gg.lineWidth = 1 + rnd() * 2; gg.beginPath(); let x = 40 + rnd() * 170, y = rnd() * h; gg.moveTo(x, y); for (let k = 0; k < 10; k++) { x += (rnd() - .5) * 18; y += 14 + rnd() * 30; gg.lineTo(x, y); } gg.stroke(); }
      for (let i = 0; i < 2; i++) { const y = rnd() * h; gg.fillStyle = 'rgba(10,8,10,.28)'; gg.fillRect(60, y, 140, 30 + rnd() * 30); }   // parches de reasfaltado
      gg.fillStyle = '#6b5547'; gg.fillRect(0, 0, 24, h); gg.fillRect(232, 0, 24, h);
      for (let i = 0; i < 1400; i++) { gg.fillStyle = `rgba(${150 + rnd() * 70 | 0},${110 + rnd() * 50 | 0},${80 + rnd() * 40 | 0},.6)`; gg.fillRect(rnd() * 24, rnd() * h, 2, 2); gg.fillRect(232 + rnd() * 24, rnd() * h, 2, 2); }
      gg.fillStyle = '#f2ead8'; gg.fillRect(32, 0, 6, h); gg.fillRect(218, 0, 6, h);   // bordes continuos
      gg.fillStyle = '#ffd88a'; gg.fillRect(125, 0, 6, 300); gg.fillRect(125, 512, 6, 300);   // eje discontinuo
    });
    const roadT = rep(tex(roadC), 1, 150);
    const roadH = rep(lin(cv(256, 256, (gg) => { gg.fillStyle = '#808080'; gg.fillRect(0, 0, 256, 256); for (let i = 0; i < 9000; i++) { const v = 80 + rnd() * 120 | 0; gg.fillStyle = `rgb(${v},${v},${v})`; gg.fillRect(rnd() * 256, rnd() * 256, 2, 2); } })), 1, 150);
    const road = new T.Mesh(new T.PlaneGeometry(11.4, 3300), new T.MeshStandardMaterial({ map: roadT, bumpMap: roadH, bumpScale: .45, roughness: .62, metalness: .1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, .01, -1500); road.receiveShadow = true; road.frustumCulled = false; g.add(road);

    // --- elementos a pie de carretera (instanciados) ---
    const dummy = new T.Object3D();
    const inst = (geo, mat, n, place, cast = true) => {
      const m = new T.InstancedMesh(geo, mat, n);
      for (let i = 0; i < n; i++) { place(dummy, i); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }
      m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; g.add(m); return m;
    };
    // postes de teléfono con cruceta y aisladores + cables con catenaria
    const poleG = T.mergeGeometries([
      new T.CylinderGeometry(.09, .15, 9, 8).translate(0, 4.5, 0),
      new T.BoxGeometry(1.9, .11, .11).translate(0, 8.4, 0), new T.BoxGeometry(1.4, .09, .09).translate(0, 7.7, 0),
      ...[-.8, 0, .8].map((x) => new T.CylinderGeometry(.03, .04, .14, 6).translate(x, 8.52, 0)), ...[-.55, .55].map((x) => new T.CylinderGeometry(.03, .04, .14, 6).translate(x, 7.82, 0)),
    ].map((x) => x.toNonIndexed()), false);
    const PX = 9.4, PN = q.mob ? 16 : 26, PS = 58, poleZ = (i) => 50 - i * PS;
    inst(poleG, new T.MeshStandardMaterial({ color: 0x3a2418, roughness: .9 }), PN, (d, i) => { d.position.set(PX + (rnd() - .5) * .3, 0, poleZ(i)); d.rotation.set(0, (rnd() - .5) * .2, (rnd() - .5) * .03); d.scale.setScalar(1); });
    const wp = [];
    for (let i = 0; i < PN - 1; i++) for (const ox of [-.8, 0, .8]) for (let k = 0; k < 8; k++) {
      const a = k / 8, b = (k + 1) / 8, z0 = poleZ(i) + (poleZ(i + 1) - poleZ(i)) * a, z1 = poleZ(i) + (poleZ(i + 1) - poleZ(i)) * b;
      wp.push(PX + ox, 8.52 - 1.1 * Math.sin(a * Math.PI), z0, PX + ox, 8.52 - 1.1 * Math.sin(b * Math.PI), z1);
    }
    const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); g.add(new T.LineSegments(wg, new T.LineBasicMaterial({ color: 0x241420 })));
    // balizas con reflectante
    const postM = new T.MeshStandardMaterial({ color: 0xe8e0d0, roughness: .6, emissive: 0xffa040, emissiveIntensity: .35 });
    const POSTN = q.mob ? 40 : 80;
    inst(new T.BoxGeometry(.09, 1, .05).translate(0, .5, 0), postM, POSTN, (d, i) => { d.position.set((i % 2 ? 1 : -1) * 6.3, 0, 30 - (i >> 1) * 28); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); });
    // cactus saguaro (un solo mesh fusionado)
    const cap = (r, l) => new T.CapsuleGeometry(r, l, 4, 10);
    const cactusG = T.mergeGeometries([cap(.24, 3.4).translate(0, 2, 0), cap(.14, .9).rotateZ(Math.PI / 2).translate(.55, 1.8, 0), cap(.14, 1.3).translate(.9, 2.6, 0), cap(.14, .8).rotateZ(Math.PI / 2).translate(-.5, 2.5, 0), cap(.14, 1.0).translate(-.84, 3.1, 0)], false);
    const cactusM = new T.MeshStandardMaterial({ color: 0x35553a, roughness: .78, bumpMap: sandT, bumpScale: 2 });
    inst(cactusG, cactusM, q.mob ? 16 : 34, (d, i) => { const s = (i % 2 ? 1 : -1); d.position.set(s * (13 + rnd() * 55), 0, 40 - rnd() * 800); d.rotation.set(0, rnd() * 6, 0); d.scale.setScalar(.7 + rnd() * .9); });
    // rocas y matojos
    const disp = (geo, amp, seed) => { const n2 = new T.SimplexNoise({ random: rng(seed) }), p = geo.attributes.position, v = new T.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + amp * n2.noise3d(v.x * 1.6, v.y * 1.6, v.z * 1.6); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals(); return geo; };
    const rockG = disp(new T.IcosahedronGeometry(1, 2), .32, 5), bushG = disp(new T.IcosahedronGeometry(1, 1), .35, 9);
    const rocks = inst(rockG, new T.MeshStandardMaterial({ color: 0xffffff, roughness: .9, bumpMap: sandT, bumpScale: 3 }), q.mob ? 50 : 110, (d, i) => { const s = (i % 2 ? 1 : -1), sz = .25 + Math.pow(rnd(), 3) * 2.2; d.position.set(s * (7.5 + Math.pow(rnd(), 1.6) * 120), sz * .25, 30 - rnd() * 900); d.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3); d.scale.set(sz * (1 + rnd() * .6), sz * .62, sz); });
    const rc = new T.Color(); for (let i = 0; i < rocks.count; i++) { rc.setHSL(.04 + rnd() * .06, .25, .22 + rnd() * .16); rocks.setColorAt(i, rc); }
    const bushes = inst(bushG, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), q.mob ? 70 : 150, (d, i) => { const s = (i % 2 ? 1 : -1), sz = .3 + rnd() * .7; d.position.set(s * (6.8 + Math.pow(rnd(), 1.5) * 70), sz * .3, 30 - rnd() * 700); d.rotation.set(0, rnd() * 6, 0); d.scale.set(sz * 1.5, sz * .7, sz * 1.3); }, false);
    for (let i = 0; i < bushes.count; i++) { rc.setHSL(.08 + rnd() * .1, .3 + rnd() * .2, .16 + rnd() * .14); bushes.setColorAt(i, rc); }

    // --- luces ---
    const hemi = new T.HemisphereLight(0x8a64b4, 0x6a4038, 1.15); g.add(hemi);
    const sunL = new T.DirectionalLight(0xffa060, 5.4); sunL.position.copy(lightDir).multiplyScalar(60); g.add(sunL, sunL.target);
    base.sun(sunL, { size: q.mob ? 11 : 13, res: q.shadow, radius: 4, bias: -.0006, normalBias: .04, near: 1, far: 140 });
    const fillL = new T.DirectionalLight(0x9a80d0, .7); fillL.position.set(-6, 5, 12); g.add(fillL);

    // --- la moto de Álvaro (modelo propio con piezas detalladas) ---
    const bike = new T.Group(); g.add(bike);
    const M = {
      paint: new T.MeshPhysicalMaterial({ color: 0xb0111e, metalness: .45, roughness: .3, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.3 }),
      chrome: new T.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .09, envMapIntensity: 1.4 }),
      alu: new T.MeshStandardMaterial({ color: 0x9aa0aa, metalness: 1, roughness: .36, envMapIntensity: 1.1 }),
      blk: new T.MeshStandardMaterial({ color: 0x14141a, metalness: .6, roughness: .42 }),
      tyre: new T.MeshStandardMaterial({ color: 0x101010, roughness: .92 }),
      seat: new T.MeshPhysicalMaterial({ color: 0x1a1210, roughness: .55, sheen: 1, sheenRoughness: .4, sheenColor: new T.Color(0x886655) }),
      leather: new T.MeshPhysicalMaterial({ color: 0x1d1c26, roughness: .46, clearcoat: .35, clearcoatRoughness: .4, sheen: .8, sheenColor: new T.Color(0x6a5a8a) }),
      jeans: new T.MeshStandardMaterial({ color: 0x2a3a5c, roughness: .95 }),
      skin: new T.MeshStandardMaterial({ color: 0xd9a07a, roughness: .7 }),
      cloth: new T.MeshStandardMaterial({ color: 0xff7a1a, roughness: .85, side: T.DoubleSide }),
      lens: new T.MeshBasicMaterial({ color: hdr(0xfff1d0, 7) }),
      tail: new T.MeshBasicMaterial({ color: hdr(0xff1a10, 6) }),
    };
    // rueda: neumático con perfil redondeado, llanta, 18 radios cruzados, buje y disco de freno
    const R = .37;
    const tyreG = (() => { const w = .17, rr = .065, pts = []; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; pts.push(new T.Vector2(R - rr + Math.cos(a) * rr, -w / 2 + rr + Math.sin(a) * rr)); } for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new T.Vector2(R - rr + Math.cos(a) * rr, w / 2 - rr + Math.sin(a) * rr)); } pts.push(new T.Vector2(.275, w / 2 - .02)); pts.unshift(new T.Vector2(.275, -w / 2 + .02)); const gg = new T.LatheGeometry(pts, 48); gg.rotateZ(Math.PI / 2); return gg; })();
    const spokeG = (() => { const gs = []; for (let k = 0; k < 18; k++) { const s = new T.CylinderGeometry(.0048, .0048, .24, 5); s.translate(0, .155, 0); s.rotateX(k / 18 * Math.PI * 2 + (k % 2) * .08); s.translate((k % 2 ? 1 : -1) * .016, 0, 0); gs.push(s); } return T.mergeGeometries(gs.map((x) => x.toNonIndexed()), false); })();
    const rimG = new T.TorusGeometry(.272, .02, 8, 48).rotateY(Math.PI / 2), hubG = new T.CylinderGeometry(.05, .05, .13, 14).rotateZ(Math.PI / 2), discG = new T.CylinderGeometry(.16, .16, .008, 36).rotateZ(Math.PI / 2).translate(.045, 0, 0);
    const blurM = new T.MeshBasicMaterial({ color: 0x2a2224, transparent: true, opacity: 0, depthWrite: false }), spokeM = new T.MeshStandardMaterial({ color: 0xd8dce2, metalness: 1, roughness: .2, transparent: true });
    const wheels = [], blurs = [];
    [-.8, .78].forEach((z) => {
      const wg = new T.Group(); wg.position.set(0, R, z); bike.add(wg);
      const sp = new T.Group(); wg.add(sp);
      put(sp, tyreG, M.tyre); put(sp, rimG, M.chrome); put(sp, spokeG, spokeM); put(sp, hubG, M.chrome); put(sp, discG, M.alu);
      const bl = new T.Mesh(new T.CircleGeometry(.29, 32), blurM.clone()); bl.rotation.y = Math.PI / 2; wg.add(bl); blurs.push(bl);
      wheels.push(sp);
    });
    // horquilla telescópica con barras cromadas, tijas y pinza de freno
    [-.085, .085].forEach((x) => { rod(bike, [x, 1.2, -.64], [x, .72, -.75], .018, M.chrome); rod(bike, [x, .74, -.75], [x, R, -.8], .028, M.alu, .03); });
    put(bike, new T.BoxGeometry(.3, .035, .08), M.alu, 0, 1.17, -.66); put(bike, new T.BoxGeometry(.24, .03, .07), M.alu, 0, .98, -.7);
    put(bike, new T.BoxGeometry(.045, .09, .12), M.paint, .12, .47, -.8);
    // guardabarros
    const fen = (zc, y0, th0, thL, rad) => { const f = put(bike, new T.CylinderGeometry(rad, rad, .17, 36, 1, true, th0, thL), M.paint, 0, y0, zc, 0, 0, Math.PI / 2); f.material = M.paint.clone(); f.material.side = T.DoubleSide; return f; };
    fen(-.8, R, Math.PI * .36, Math.PI * .56, .425); fen(.78, R, -Math.PI * .1, Math.PI * .62, .43);
    // chasis
    rod(bike, [0, 1.08, -.6], [0, .92, .38], .035, M.blk); rod(bike, [0, 1.0, -.6], [0, .5, -.12], .04, M.blk); rod(bike, [0, .5, -.12], [0, .48, .3], .04, M.blk);
    [-.1, .1].forEach((x) => { rod(bike, [x, .5, .28], [x, R, .78], .028, M.alu); rod(bike, [x * .9, .92, .4], [x * 1.1, .45, .76], .018, M.blk); rod(bike, [x * 1.3, .56, .36], [x * 1.4, .86, .52], .02, M.chrome); rod(bike, [x * 1.3, .66, .38], [x * 1.4, .82, .5], .034, M.paint); });
    // motor V2 con aletas de refrigeración
    put(bike, new T.RoundedBoxGeometry(.32, .27, .4, 3, .06), M.alu, 0, .56, -.04); put(bike, new T.RoundedBoxGeometry(.28, .2, .24, 3, .05), M.alu, 0, .5, .24);
    [[-1, 36], [1, -36]].forEach(([s, ang]) => {
      const dir = new T.Vector3(0, Math.cos(ang * Math.PI / 180), s * -Math.sin(Math.abs(ang) * Math.PI / 180) * (s < 0 ? 1 : -1)).normalize();
      const o = new T.Vector3(0, .66, -.04 + s * .06);
      const q2 = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
      for (let t = 0; t < 6; t++) { const fn = new T.Mesh(new T.CylinderGeometry(.092, .092, .012, 20), M.alu); fn.position.copy(o).addScaledVector(dir, .06 + t * .036); fn.quaternion.copy(q2); fn.castShadow = true; bike.add(fn); }
      const head = new T.Mesh(new T.CylinderGeometry(.075, .085, .09, 18), M.blk); head.position.copy(o).addScaledVector(dir, .3); head.quaternion.copy(q2); head.castShadow = true; bike.add(head);
    });
    // escape cromado y silenciador
    tube(bike, [[.07, .88, -.34], [.13, .7, -.4], [.19, .46, -.26], [.22, .34, .18], [.22, .36, .68]], .032, M.chrome, 32);
    tube(bike, [[.06, .86, .2], [.12, .72, .3], [.19, .5, .28]], .028, M.chrome, 16);
    put(bike, new T.CylinderGeometry(.052, .052, .5, 18), M.chrome, .22, .37, .85, Math.PI / 2); put(bike, new T.CylinderGeometry(.046, .046, .02, 14), M.blk, .22, .37, 1.11, Math.PI / 2);
    // depósito, asiento, colín, faro, manillar
    const tank = new T.Mesh(new T.SphereGeometry(1, 36, 22), M.paint); tank.scale.set(.2, .16, .38); tank.position.set(0, 1.07, -.26); tank.rotation.x = .1; tank.castShadow = true; bike.add(tank);
    put(bike, new T.CylinderGeometry(.045, .045, .02, 14), M.chrome, 0, 1.23, -.22);
    put(bike, new T.RoundedBoxGeometry(.32, .1, .62, 4, .045), M.seat, 0, .98, .42, -.05);
    put(bike, new T.RoundedBoxGeometry(.28, .12, .5, 4, .05), M.paint, 0, .93, .86, .28);
    put(bike, new T.SphereGeometry(.13, 24, 16), M.chrome, 0, 1.1, -.78).scale.set(1, 1, .85);
    const lens = new T.Mesh(new T.CircleGeometry(.092, 24), M.lens); lens.position.set(0, 1.1, -.9); lens.rotation.y = Math.PI; bike.add(lens);
    put(bike, new T.RoundedBoxGeometry(.2, .05, .04, 2, .015), M.tail, 0, .93, 1.1, .28, 0, 0, false);
    tube(bike, [[-.42, 1.26, -.46], [-.24, 1.3, -.6], [0, 1.3, -.64], [.24, 1.3, -.6], [.42, 1.26, -.46]], .013, M.chrome, 24);
    [-1, 1].forEach((s) => { put(bike, new T.CylinderGeometry(.021, .021, .12, 10), M.blk, s * .42, 1.26, -.46, Math.PI / 2 - .3, 0, Math.PI / 2 - .1 * s); put(bike, new T.SphereGeometry(.04, 12, 8), M.chrome, s * .47, 1.34, -.62).scale.set(1.2, .8, .5); });
    // matrícula
    const plate = new T.Mesh(new T.PlaneGeometry(.26, .09), new T.MeshStandardMaterial({ map: tex(cv(256, 88, (gg) => { gg.fillStyle = '#f4f0e4'; gg.fillRect(0, 0, 256, 88); gg.fillStyle = '#1a3e9a'; gg.fillRect(0, 0, 28, 88); gg.fillStyle = '#fff'; gg.font = '700 14px sans-serif'; gg.textAlign = 'center'; gg.fillText('E', 14, 74); gg.fillStyle = '#222'; gg.font = '700 50px "Plus Jakarta Sans", sans-serif'; gg.fillText('GANA·AL', 146, 62); })), roughness: .5 }));
    plate.position.set(0, .84, 1.12); plate.rotation.set(-.12, 0, 0); bike.add(plate);
    // piloto
    const torso = put(bike, new T.CapsuleGeometry(.18, .36, 8, 18), M.leather, 0, 1.36, .22, -.62, 0, 0); torso.scale.set(1.25, 1, .9);
    put(bike, new T.CapsuleGeometry(.1, .3, 6, 12), M.leather, 0, 1.55, .09, 0, 0, Math.PI / 2);
    put(bike, new T.CylinderGeometry(.085, .11, .12, 16), M.cloth, 0, 1.69, .0, .3); put(bike, new T.TorusGeometry(.11, .04, 8, 18), M.cloth, 0, 1.74, -.01, Math.PI / 2 + .3);
    [-1, 1].forEach((s) => {
      rod(bike, [s * .2, 1.55, .1], [s * .3, 1.3, -.14], .046, M.leather, .052); rod(bike, [s * .3, 1.3, -.14], [s * .4, 1.3, -.5], .036, M.leather, .042); put(bike, new T.SphereGeometry(.058, 12, 10), M.leather, s * .2, 1.55, .1);
      put(bike, new T.SphereGeometry(.052, 12, 10), M.blk, s * .42, 1.28, -.55);
      rod(bike, [s * .15, 1.12, .4], [s * .25, .93, -.04], .082, M.jeans, .09); rod(bike, [s * .25, .93, -.04], [s * .27, .5, .12], .06, M.jeans, .075);
      put(bike, new T.RoundedBoxGeometry(.11, .1, .3, 3, .035), M.blk, s * .27, .44, .06);
    });
    // bufanda al viento (tira de tela animada)
    const scarfG = new T.PlaneGeometry(.17, 1.3, 2, 16); const scarf = new T.Mesh(scarfG, M.cloth); scarf.castShadow = true; scarf.frustumCulled = false; bike.add(scarf);
    // cara de Álvaro (billboard) con aro naranja
    const faceC = cv(256, 256, (gg) => { gg.save(); gg.beginPath(); gg.arc(128, 128, 116, 0, 7); gg.clip(); gg.fillStyle = '#222'; gg.fillRect(0, 0, 256, 256); if (faceImg) gg.drawImage(faceImg, 118, 48, 202, 202, 12, 12, 232, 232); gg.restore(); gg.lineWidth = 10; gg.strokeStyle = '#ff7a1a'; gg.beginPath(); gg.arc(128, 128, 116, 0, 7); gg.stroke(); });
    const head = new T.Sprite(new T.SpriteMaterial({ map: tex(faceC) })); head.scale.setScalar(.92); head.position.set(0, 2.06, -.04); bike.add(head);
    // luces: faro con cono hacia delante y brillo de piloto trasero
    const hl = new T.SpotLight(0xfff0d0, 320, 70, .42, .8, 2); hl.position.set(0, 1.1, -.9); hl.target.position.set(0, 0, -14); bike.add(hl, hl.target);
    const tail = new T.Sprite(new T.SpriteMaterial({ map: soft, color: hdr(0xff2030, 3), ...AB })); tail.position.set(0, .94, 1.14); tail.scale.setScalar(.6); bike.add(tail);
    const hglow = new T.Sprite(new T.SpriteMaterial({ map: soft, color: hdr(0xffe6b0, 1.4), ...AB })); hglow.position.set(0, 1.1, -.98); hglow.scale.setScalar(.34); bike.add(hglow);

    // polvo de la rueda trasera y chispas del escape
    const PU = q.mob ? 50 : 90, ppos = new Float32Array(PU * 3).fill(-999), pa = new Float32Array(PU).map(() => Math.random());
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(ppos, 3));
    const puffs = new T.Points(pg, new T.PointsMaterial({ map: soft, size: 1.1, color: new T.Color(0xffb078), transparent: true, opacity: .3, depthWrite: false })); puffs.frustumCulled = false; g.add(puffs);
    const SN = 36, spos = new Float32Array(SN * 3).fill(-999), sa = new Float32Array(SN).map(() => Math.random());
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(spos, 3));
    const sparks = new T.Points(sg, new T.PointsMaterial({ map: soft, size: .09, color: hdr(0xffa850, 4), ...AB })); sparks.frustumCulled = false; g.add(sparks);

    // bandada de pájaros cruzando el sol (siluetas con aleteo)
    const birds = [];
    const wingG = new T.BufferGeometry(); wingG.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 1.4, .1, -.25, 1.1, 0, .35], 3)); wingG.computeVertexNormals();
    const birdM = new T.MeshBasicMaterial({ color: 0x1c0e1c, side: T.DoubleSide });
    for (let i = 0; i < (q.mob ? 5 : 9); i++) {
      const b = new T.Group(), w1 = new T.Mesh(wingG, birdM), w2 = new T.Mesh(wingG, birdM); w2.scale.x = -1; b.add(w1, w2); b.scale.setScalar(5 + rnd() * 3); b.userData = { w1, w2, ph: rnd() * 6.28, ox: (rnd() - .5) * 160, oy: rnd() * 40, oz: rnd() * 80 };
      g.add(b); birds.push(b);
    }
    return { g, bike, wheels, blurs, scarfG, puffs, ppos, pa, PU, sparks, spos, sa, SN, sunL, hl, hemi, fillL, sky, birds, spokeM, envRT, pm, head };
  }

  // Álvaro se va: el huevo arranca de inmediato; la cámara hace el recorrido de siempre
  function alvaro(faceImg) {
    office.visible = false; idleSrc.visible = false;
    const port = innerWidth / innerHeight < .8;   // vertical: el sol llena el encuadre, menos bruma
    egg = { t: 0, ...buildSunset(faceImg) };
    scene.background = new T.Color(PAL.c0);
    if (post.godrays) { post.godrays.lightSource = egg.g.children[1]; post.godrays.blendMode.opacity.value = port ? .3 : .8; Object.assign(post.godrays.godRaysMaterial, { density: .9, decay: .93, weight: .22, exposure: .32 }); }
    if (post.bloom) { post.bloom.intensity = port ? .3 : .6; post.bloom.luminanceMaterial.threshold = 1.05; }
    if (post.vignette) post.vignette.darkness = port ? .85 : .62;
    renderer.toneMappingExposure = 1;
    cam.fov = 34; cam.updateProjectionMatrix();
    mode = 'alvaro';
  }

  // =====================================================================
  //  BUCLE
  // =====================================================================
  let t = 0;
  const tmpV = new T.Vector3(), sm = (a, b, k) => { const x = Math.min(1, Math.max(0, (k - a) / (b - a))); return x * x * (3 - 2 * x); };
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
      shafts.forEach((s, i) => { s.material.uniforms.uT.value = t; s.material.uniforms.uK.value = [.3, .2, .16][i] * (.85 + Math.sin(t * .7 + i * 2) * .13 + bumpK * .5); });
      key.intensity = 340 + bumpK * 300;
      sconceL.forEach((l, i) => { l.intensity = 4.5 * (.94 + Math.sin(t * 3.1 + i * 2.3) * .03 + Math.sin(t * 7.7 + i) * .02) + bumpK * 4; });
      glareT.offset.x = cam.position.x * .05; glareT.offset.y = cam.position.y * .03;
    } else if (egg) {
      egg.t += dt; const k = egg.t;
      // la moto acelera por la carretera hacia el sol (misma ley que siempre)
      const z = -(5 * k + 3.4 * k * k), sway = Math.sin(k * 1.7) * .25, speed = 5 + 6.8 * k;
      egg.bike.position.set(sway, 0, z); egg.bike.rotation.z = -Math.cos(k * 1.7) * .08; egg.bike.position.y = Math.sin(k * 24) * .012;
      const spin = speed / .37;
      egg.wheels.forEach((w) => { w.rotation.x -= dt * spin * .92; });
      const bl = clamp((spin - 14) / 36, 0, .5);
      egg.blurs.forEach((b) => { b.material.opacity = bl * .8; }); egg.spokeM.opacity = 1 - bl * 1.2;
      // bufanda ondeando
      { const p = egg.scarfG.attributes.position, cols = 3; for (let r = 0; r <= 16; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c, u = r / 16, w = (c - 1) * .085;
          p.setXYZ(i, w + Math.sin(t * 13 - u * 8) * .06 * u, 1.66 - u * .22 + Math.sin(t * 17 - u * 9) * .07 * u, .05 + u * 1.25); } p.needsUpdate = true; egg.scarfG.computeVertexNormals(); }
      egg.head.position.y = 2.06 + Math.sin(k * 11) * .008;
      // polvo y chispas
      { const p = egg.puffs.geometry.attributes.position;
        for (let i = 0; i < egg.PU; i++) { egg.pa[i] += dt * 1.4; if (egg.pa[i] > 1) { egg.pa[i] -= 1; p.setXYZ(i, sway + (Math.random() - .5) * .5, .2, z + 1.1); } else p.setXYZ(i, p.getX(i) + (Math.random() - .5) * dt * .6, p.getY(i) + dt * .45, p.getZ(i) + dt * 1.2); }
        p.needsUpdate = true;
        const s = egg.sparks.geometry.attributes.position;
        for (let i = 0; i < egg.SN; i++) { egg.sa[i] += dt * 2.4; if (egg.sa[i] > 1) { egg.sa[i] -= 1; s.setXYZ(i, sway + .22, .38, z + 1.1); } else s.setXYZ(i, s.getX(i) + (Math.random() - .5) * dt * .8, Math.max(.02, s.getY(i) - dt * .9), s.getZ(i) + dt * (4 + speed * .15)); }
        s.needsUpdate = true; }
      // el sol y su sombra siguen a la moto (sombra larga y suave hacia la cámara)
      const B = egg.bike.position;
      egg.sunL.position.copy(B).addScaledVector(lightDir, 60); egg.sunL.target.position.copy(B); egg.sunL.target.updateMatrixWorld();
      // pájaros
      egg.birds.forEach((b, i) => { const u = b.userData, f = Math.sin(t * 9 + u.ph) * .5; u.w1.rotation.z = f; u.w2.rotation.z = -f;
        b.position.set(Math.sin(t * .05 + u.ph) * 120 + u.ox - 40, 85 + u.oy + Math.sin(t * .3 + u.ph) * 5, B.z - 520 - u.oz + t * 6); b.rotation.y = Math.PI * 1.02; });
      skyMat.uniforms.uT.value = t;
      // cámara: persecución baja al principio, luego se queda en la carretera y sube mientras se aleja
      // 1) de frente y bajo: se le ve la cara · 2) le pasamos por detrás · 3) nos quedamos en la carretera y se pierde en el sol
      const e1 = sm(1.6, 3.4, k), e2 = sm(3.4, 5.2, k);
      const front = new T.Vector3(B.x + 3.8, 1.25, B.z - 5.6), behind = new T.Vector3(B.x + 1.5, 1.5, B.z + 6.4);
      if (!egg.still && k >= 3.4) egg.still = behind.clone();
      const still = egg.still ? egg.still.clone().add(new T.Vector3(0, (k - 3.4) * .5, 0)) : behind;
      cam.position.copy(front.lerp(behind, e1).lerp(still, e2));
      const look = new T.Vector3(B.x, 1.7 - e1 * .4, B.z - e1 * 2).lerp(new T.Vector3(0, 30, -1000), e2 * .6);
      cam.lookAt(look);
      egg.sky.position.copy(cam.position);
    }
  });

  return {
    bump() { bumpK = 1; },
    burst,
    alvaro,
    dispose() {
      removeEventListener('resize', fSize); removeEventListener('pointermove', onMove);
      cancelAnimationFrame(fRaf); parts.forEach((p) => { fscene.remove(p.m); p.m.material.dispose(); });
      try { if (egg) { egg.envRT && egg.envRT.dispose(); egg.pm && egg.pm.dispose(); } skyMat.dispose(); } catch (e) { /* nada */ }
      try { fenvRT && fenvRT.dispose(); fpm && fpm.dispose(); fr && fr.dispose(); fr && fr.forceContextLoss(); } catch (e) { /* nada */ }
      fcv.remove();
    },
  };
}
