// Tierra 3D para la intro de cine (motor común): relieve, océanos con brillo solar, nubes con sombra,
// luces de ciudad HDR, atmósfera dispersiva, Vía Láctea y amanecer con destello de lente.
import { noiseFactory, flareCanvas, GLSL_SRGB } from '@kit';
let EARTH_TEX = null;
function earthTextures(){
  if (EARTH_TEX) return EARTH_TEX;
  const mob = Math.min(innerWidth, innerHeight) < 420 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const W = mob ? 720 : 1024, H = W / 2, n1 = noiseFactory(7), n2 = noiseFactory(91), n3 = noiseFactory(33), n4 = noiseFactory(55), n5 = noiseFactory(12);
  const mkC = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const col = mkC(), cld = mkC(), ngt = mkC(), spc = mkC(), hgt = mkC();
  const im = () => [col, cld, ngt, spc, hgt].map(c => c.getContext('2d').createImageData(W, H));
  const [ci, cl, ni, si, hi] = im();
  const fbm = (nz, x, y, z, o) => { let a = 0, f = 1, amp = .5; for (let i = 0; i < o; i++){ a += amp * nz(x * f, y * f, z * f); f *= 2.03; amp *= .5; } return a; };
  const mix = (a, b, t) => a + (b - a) * t, cl01 = v => Math.max(0, Math.min(1, v)), sm = (a, b, x) => { const t = cl01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  for (let j = 0; j < H; j++){
    const lat = (j / H - .5) * Math.PI, cy = Math.cos(lat), sy = Math.sin(lat), asy = Math.abs(sy);
    for (let i = 0; i < W; i++){
      const lon = (i / W) * Math.PI * 2, x = Math.cos(lon) * cy, z = Math.sin(lon) * cy, y = sy;
      const h = fbm(n1, x * 1.6 + 3, y * 1.6, z * 1.6, 7) + .08;           // altura (continentes)
      const m = fbm(n3, x * 3, y * 3, z * 3, 4);                             // humedad
      const detail = fbm(n5, x * 14, y * 14, z * 14, 3);                     // moteado del terreno
      const iceLim = .9 - fbm(n2, x * 4, y * 4, z * 4, 3) * .2;
      let r, g, b, sea = 0, city = 0, hv = 0;
      if (asy > iceLim){ const k = .93 + detail * .1; r = 236 * k; g = 242 * k; b = 250 * k; hv = .5; city = 0; }
      else if (h < 0){
        // océano: plataforma turquesa junto a la costa → abismo azul marino
        const d = cl01(-h * 3.2), sh = sm(.0, .45, 1 - d);
        r = mix(3, 24, sh * sh); g = mix(20, 118, sh * sh); b = mix(58, 150, sh * sh * .9 + .1); sea = 1; hv = 0;
        r += detail * 6; g += detail * 8;
      } else {
        const warm = 1 - asy;                                                // 1 en el ecuador
        const dry = cl01(sm(.02, .24, m) * (.35 + .9 * sm(.05, .55, asy) * (asy < .62 ? 1 : 0)) + (asy > .18 && asy < .5 ? .25 : 0) - .1);
        // bioma: selva / sabana / desierto / bosque templado / tundra
        const forest = [26, 74, 34], jungle = [18, 82, 40], savanna = [128, 126, 58], desert = [204, 164, 100], tundra = [118, 118, 96], rock = [118, 106, 96];
        let c0 = asy > .66 ? tundra : mix3(forest, jungle, warm);
        c0 = mix3(c0, savanna, cl01(dry * 1.2) * sm(.1, .5, warm));
        c0 = mix3(c0, desert, cl01((dry - .45) * 2.6) * sm(.25, .8, warm));
        const sand = sm(.05, .0, h);                                         // franja de playa
        c0 = mix3(c0, [214, 196, 146], sand);
        const mt = sm(.26, .42, h + detail * .05);                           // roca y nieve en las cumbres
        c0 = mix3(c0, rock, mt);
        const snow = sm(.36, .5, h + detail * .04) + sm(.74, .88, asy) * .7;
        c0 = mix3(c0, [240, 244, 250], cl01(snow));
        const k = .86 + detail * .55 + (h * .25);
        r = c0[0] * k; g = c0[1] * k; b = c0[2] * k;
        hv = cl01(.05 + h * 1.9);
        city = (1 - cl01(dry * .8)) * (h < .1 ? 1.2 : .75) * (asy > .5 ? .2 : 1) * (snow > .4 ? 0 : 1);
      }
      const o = (j * W + i) * 4;
      ci.data[o] = r; ci.data[o + 1] = g; ci.data[o + 2] = b; ci.data[o + 3] = 255;
      const c = fbm(n2, x * 2.6 + 9, y * 5.2, z * 2.6, 6), a = cl01((c + .02) * 3.2);
      cl.data[o] = cl.data[o + 1] = cl.data[o + 2] = 255; cl.data[o + 3] = a * 240;
      // luces de ciudades: racimos en tierra templada, más densos en la costa
      const u = fbm(n4, x * 34, y * 34, z * 34, 3), v2 = fbm(n3, x * 6, y * 6, z * 6, 2), dens = city * Math.max(0, 1 - asy * 1.3) * (v2 > -.02 ? 1 : .15);
      const lit = u > .22 - dens * .08 ? Math.min(1, (u - .18) * 7) * dens * .85 : 0;
      ni.data[o] = ni.data[o + 1] = ni.data[o + 2] = 255 * cl01(lit); ni.data[o + 3] = 255;
      si.data[o] = si.data[o + 1] = si.data[o + 2] = sea * 255; si.data[o + 3] = 255;
      hi.data[o] = hi.data[o + 1] = hi.data[o + 2] = hv * 255; hi.data[o + 3] = 255;
    }
  }
  [[col, ci], [cld, cl], [ngt, ni], [spc, si], [hgt, hi]].forEach(([c, d]) => c.getContext('2d').putImageData(d, 0, 0));
  return (EARTH_TEX = { col, cld, ngt, spc, hgt });
}
function mix3(a, b, t){ return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

export const warmEarth = () => { earthTextures(); };   // genera las texturas por adelantado

// Ruido para la Vía Láctea (cielo)
const GLSL_NOISE = `
float h31(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + vec3(7.1, 3.3, 5.2); a *= .5; } return s; }
`;

// Devuelve una función de parada al instante; el motor 3D se monta en cuanto está listo.
export function cineEarth(ctx, canvas){
  const tCall = performance.now(); let dead = false;
  ctx.three({ clear: 0x010208, fov: 38, near: .1, far: 4000, tone: 'aces_filmic', env: false, ao: false, shadows: false,
    bloom: { intensity: 1.05, threshold: .9, radius: .85, smoothing: .22 }, ca: .0008, grain: .03, vignette: { offset: .28, darkness: .55 } })
    .then(g => {
      if (!g) return;                                           // sin WebGL: se queda el fondo negro con las bandas de cine
      const stop = ctx.getStop();                               // limpieza del motor (la deja glInit)
      if (dead || !ctx.isOpen()){ stop && stop(); return; }
      canvas.remove();                                          // el lienzo del motor sustituye al de la plantilla
      mount(ctx, g, (performance.now() - tCall) / 1000);
    }).catch(e => console.error(e));
  return () => { dead = true; };
}

function mount(ctx, g, lag){
  const A = ctx.A, { T, scene, cam, post, tex, q } = g, glowCanvas = ctx.kit.glowCanvas;
  scene.add(cam);
  const mk = (c, o) => tex(c, o);
  const AB = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };
  const hdr = (c, k) => new T.Color(c).multiplyScalar(k);
  const { col, cld, ngt, spc, hgt } = earthTextures();
  const SEG = q.mob ? 72 : 144;

  // ---- cielo profundo: Vía Láctea tenue y polvo de estrellas ----
  const sky = new T.Mesh(new T.SphereGeometry(3400, 48, 32), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, depthTest: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: GLSL_SRGB + GLSL_NOISE + `varying vec3 vD; void main(){
      vec3 d = normalize(vD); vec3 bn = normalize(vec3(.28, .86, -.42)); float w = dot(d, bn);
      float band = exp(-w * w / .035);
      float cloud = fbm3(d * 5. + 2.), dust = smoothstep(.38, .75, fbm3(d * 9. - 4.));
      vec3 c = mix(s2l(vec3(.28, .30, .55)), s2l(vec3(.95, .66, .42)), smoothstep(.3, .8, fbm3(d * 3. + 8.)));
      vec3 o = c * band * cloud * (1. - dust * .6) * .16;
      o += vec3(.85, .9, 1.) * pow(h31(floor(d * 700.)), 90.) * (.25 + band * 1.6);
      o += s2l(vec3(.04, .05, .12)) * .5;
      gl_FragColor = vec4(o, 1.); }` }));
  sky.renderOrder = -30; sky.frustumCulled = false; scene.add(sky);

  // ---- estrellas: estelas durante el salto, deriva con paralaje después ----
  const SN = q.mob ? 1800 : 3400, sPos = new Float32Array(SN * 6), sCol = new Float32Array(SN * 6), sD = [], sSz = new Float32Array(SN), sPh = new Float32Array(SN);
  for (let i = 0; i < SN; i++){
    const p = new T.Vector3((Math.random() - .5) * 900, (Math.random() - .5) * 900, -1600 + Math.random() * 1900);
    if (p.length() < 60) p.multiplyScalar(3);
    const k = .3 + Math.random() * .5, warm = Math.random(), big = Math.random() < .025, B = big ? 2.4 : 1;
    sD.push(p); sCol.set([k * B, k * B * (.9 + warm * .1), k * B * (.75 + (1 - warm) * .25), k * .2, k * .2, k * .2], i * 6);
    sSz[i] = big ? 2.6 + Math.random() * 1.6 : .7 + Math.random() * 1.0; sPh[i] = Math.random() * 6.28;
  }
  const sGeo = new T.BufferGeometry(); sGeo.setAttribute('position', new T.BufferAttribute(sPos, 3)); sGeo.setAttribute('color', new T.BufferAttribute(sCol, 3));
  const streaks = new T.LineSegments(sGeo, new T.LineBasicMaterial({ vertexColors: true, ...AB })); streaks.frustumCulled = false; scene.add(streaks);
  const dGeo = new T.BufferGeometry(); dGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(sD.flatMap(p => [p.x, p.y, p.z])), 3));
  dGeo.setAttribute('color', new T.BufferAttribute(new Float32Array(sD.flatMap((_, i) => [sCol[i*6], sCol[i*6+1], sCol[i*6+2]])), 3));
  dGeo.setAttribute('aSize', new T.BufferAttribute(sSz, 1)); dGeo.setAttribute('aPh', new T.BufferAttribute(sPh, 1));
  const starMat = new T.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uPx: { value: g.renderer.getPixelRatio() * Math.max(.7, g.H / 720) } }, ...AB, vertexColors: true,
    vertexShader: 'attribute float aSize; attribute float aPh; uniform float uTime; uniform float uPx; varying vec3 vC; void main(){ vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = aSize * uPx * (1. + .3 * sin(uTime * (1.2 + aPh * .3) + aPh * 30.)); }',
    fragmentShader: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = exp(-d * d * 4.) * (1. - smoothstep(.85, 1., d)); gl_FragColor = vec4(vC * a, 1.); }' });
  const stars = new T.Points(dGeo, starMat); stars.frustumCulled = false; scene.add(stars);

  // ---- Tierra: océanos con brillo solar, relieve, sombras de nubes, luces de ciudad ----
  const R = 10, sunDir = new T.Vector3(.52, .2, -.86).normalize(), S = sunDir.clone().multiplyScalar(1800);
  const earth = new T.Group(); earth.rotation.z = -.32; scene.add(earth);
  const uni = { day: { value: mk(col) }, night: { value: mk(ngt, { linear: true }) }, spec: { value: mk(spc, { linear: true }) }, hgt: { value: mk(hgt, { linear: true }) }, cld: { value: mk(cld, { linear: true }) },
    sun: { value: sunDir }, sunObj: { value: sunDir.clone() }, uTime: { value: 0 } };
  const globe = new T.Mesh(new T.SphereGeometry(R, SEG, SEG), new T.ShaderMaterial({ uniforms: uni,
    vertexShader: 'varying vec3 vN; varying vec3 vNo; varying vec3 vW; varying vec2 vU; void main(){ vU = uv; vNo = normalize(normal); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GLSL_SRGB + `uniform sampler2D day, night, spec, hgt, cld; uniform vec3 sun; uniform vec3 sunObj; uniform float uTime; varying vec3 vN; varying vec3 vNo; varying vec3 vW; varying vec2 vU;
      vec3 bump(vec3 N, vec3 p, float h, float k){ vec3 dpx = dFdx(p), dpy = dFdy(p); float hx = dFdx(h) * k, hy = dFdy(h) * k;
        vec3 r1 = cross(dpy, N), r2 = cross(N, dpx); float det = dot(dpx, r1); vec3 sg = sign(det) * (hx * r1 + hy * r2); return normalize(abs(det) * N - sg); }
      float D_GGX(float nh, float a){ float a2 = a * a; float d = nh * nh * (a2 - 1.) + 1.; return a2 / (3.14159 * d * d); }
      void main(){
        vec3 Ng = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(sun);
        float hv = texture2D(hgt, vU).r, sea = texture2D(spec, vU).r;
        vec3 N = Ng;
        float dg = dot(Ng, L), d = dot(N, L);
        // sombra de las nubes: se proyectan desplazadas hacia el lado opuesto al sol
        vec3 on = normalize(vNo), Ls = sunObj - on * dot(on, sunObj);
        vec3 E = normalize(cross(vec3(0., 1., 0.), on)), Nn = cross(on, E);
        float cy = max(.12, sqrt(1. - on.y * on.y));
        vec2 off = vec2(dot(Ls, E) / (6.2832 * cy), dot(Ls, Nn) / 3.1416) * -.05;
        float cs = texture2D(cld, vU + off).a, sh = 1. - cs * .55;
        vec3 sunC = mix(vec3(1., .5, .2), vec3(1., .95, .88), smoothstep(.0, .14, dg));
        vec3 alb = texture2D(day, vU).rgb;
        float diff = max(d, 0.) * smoothstep(-.04, .1, dg);
        vec3 col = alb * sunC * diff * 3.1 * sh + alb * s2l(vec3(.5, .6, 1.)) * .012;
        // océano: reflejo del cielo en ángulos rasantes y brillo solar (HDR para el bloom)
        float nv = max(dot(N, V), 0.), Fr = .02 + .98 * pow(1. - nv, 5.);
        vec3 Hh = normalize(L + V); float nh = max(dot(N, Hh), 0.);
        float rough = .09 + .1 * (1. - sh);
        float gl = (D_GGX(nh, rough) * .04 * 2.2 + D_GGX(nh, .35) * .05) * max(d, 0.) * 3.1 * sh;
        col += sea * (vec3(1., .86, .62) * gl * 1.5 + s2l(vec3(.35, .55, 1.)) * Fr * .55 * smoothstep(-.1, .5, dg));
        // luces de ciudad: solo en la cara nocturna y donde no hay nubes densas
        float nm = smoothstep(.06, -.2, dg) * (1. - smoothstep(0., .6, texture2D(cld, vU).a));
        float tw = .85 + .15 * sin(uTime * 3. + vU.x * 900. + vU.y * 400.);
        float cn = texture2D(night, vU).r;
        col += mix(vec3(1., .55, .22), vec3(1., .86, .6), cn) * pow(cn, 1.3) * nm * 3.4 * tw;
        // bruma crepuscular en el terminador
        col += s2l(vec3(1., .38, .12)) * pow(1. - abs(dg), 14.) * .12 * step(-.1, dg) * (1. - sea * .6);
        // bruma atmosférica sobre el relieve (lejos del centro, más aire)
        col += s2l(vec3(.35, .6, 1.)) * pow(1. - nv, 3.) * max(dg + .25, 0.) * .55;
        gl_FragColor = vec4(col, 1.); }` }));
  const cloudUni = { map: { value: uni.cld.value }, sun: { value: sunDir }, sunObj: { value: sunDir.clone() } };
  const clouds = new T.Mesh(new T.SphereGeometry(R * 1.012, SEG, SEG), new T.ShaderMaterial({ uniforms: cloudUni, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vN; varying vec3 vNo; varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vNo = normalize(normal); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GLSL_SRGB + `uniform sampler2D map; uniform vec3 sun; uniform vec3 sunObj; varying vec3 vN; varying vec3 vNo; varying vec2 vU; varying vec3 vW;
      void main(){ vec3 N = normalize(vN), L = normalize(sun), V = normalize(cameraPosition - vW);
        float a = texture2D(map, vU).a, d = dot(N, L);
        vec3 on = normalize(vNo), Ls = sunObj - on * dot(on, sunObj);
        vec3 E = normalize(cross(vec3(0., 1., 0.), on)), Nn = cross(on, E); float cy = max(.12, sqrt(1. - on.y * on.y));
        vec2 off = vec2(dot(Ls, E) / (6.2832 * cy), dot(Ls, Nn) / 3.1416) * .012;
        float a2 = texture2D(map, vU + off).a;
        float rel = clamp(1. + (a - a2) * 1.7, .45, 1.3);                            // relieve: la cara hacia el sol brilla más
        vec3 sunC = mix(vec3(1., .55, .25), vec3(1., .97, .92), smoothstep(.0, .14, d));
        float lit = max(d, 0.) * smoothstep(-.06, .12, d);
        vec3 c = vec3(.92, .95, 1.) * sunC * (lit * 2.7 * rel + .006) + s2l(vec3(.35, .55, 1.)) * pow(1. - max(dot(N, V), 0.), 3.) * max(d + .2, 0.) * .5;
        gl_FragColor = vec4(c, a * .94); }` }));
  // atmósfera: halo exterior (cara trasera) + velo dispersivo sobre el disco (cara delantera)
  const atmoOut = new T.Mesh(new T.SphereGeometry(R * 1.12, 96, 96), new T.ShaderMaterial({ uniforms: { sun: { value: sunDir } }, side: T.BackSide, ...AB,
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GLSL_SRGB + `uniform vec3 sun; varying vec3 vN; varying vec3 vW; void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
      float f = pow(max(0., 1. - abs(dot(N, V)) * 1.04), 6.5); float d = dot(-N, sun); float lit = smoothstep(-.45, .5, d);
      float fw = pow(max(dot(sun, -V), 0.), 5.);                                  // dispersión hacia delante: el limbo se enciende con el sol detrás
      vec3 c = mix(s2l(vec3(1., .46, .16)), s2l(vec3(.3, .6, 1.)), smoothstep(.05, .6, d));
      gl_FragColor = vec4(c * f * (.05 + lit * 2.0 + fw * 1.5), 1.); }` }));
  const atmoIn = new T.Mesh(new T.SphereGeometry(R * 1.04, 96, 96), new T.ShaderMaterial({ uniforms: { sun: { value: sunDir } }, side: T.FrontSide, ...AB,
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GLSL_SRGB + `uniform vec3 sun; varying vec3 vN; varying vec3 vW; void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
      float nv = max(dot(N, V), 0.), f = pow(1. - nv, 2.6); float d = dot(N, sun);
      vec3 blue = s2l(vec3(.28, .55, 1.)) * smoothstep(-.15, .55, d) * 1.05, red = s2l(vec3(1., .55, .25)) * pow(1. - abs(d), 7.) * smoothstep(-.3, .1, d) * .3;
      gl_FragColor = vec4((blue + red) * f * .8, 1.); }` }));
  earth.add(globe, clouds, atmoIn, atmoOut);

  // ---- sol + destello de lente (HDR: el bloom hace el resto) ----
  const sunSprites = [];
  const sunSp = (c, sc, op, k = 1) => { const s = new T.Sprite(new T.SpriteMaterial({ map: mk(c), color: hdr(0xffffff, k), ...AB, depthTest: false, opacity: 0 })); s.position.copy(S); s.scale.setScalar(sc); s.userData = { sc, op }; scene.add(s); sunSprites.push(s); return s; };
  sunSp(glowCanvas([[0, 'rgba(255,255,255,1)'], [.08, 'rgba(255,250,235,1)'], [.25, 'rgba(255,210,150,.5)'], [1, 'rgba(0,0,0,0)']]), 420, 1, 5);
  sunSp(glowCanvas([[0, 'rgba(255,190,120,.45)'], [.4, 'rgba(255,140,60,.15)'], [1, 'rgba(0,0,0,0)']]), 1500, 1, 1.3);
  const burst = sunSp(flareCanvas('burst'), 1100, .9, 1.6);
  const streakC = document.createElement('canvas'); streakC.width = 1024; streakC.height = 64;
  { const x = streakC.getContext('2d'), gr = x.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, 'rgba(120,170,255,0)'); gr.addColorStop(.5, 'rgba(235,245,255,1)'); gr.addColorStop(1, 'rgba(120,170,255,0)'); x.fillStyle = gr; x.fillRect(0, 29, 1024, 6); }
  const streak = sunSp(streakC, 1, 1, 1.3); streak.userData.streak = true;
  const ghosts = [[.25, 'hex', '120,200,255', 1.1], [.45, 'ring', '255,180,120', 2.2], [.62, 'hex', '170,255,190', .7], [.9, 'hex', '255,150,220', 1.5], [1.25, 'ring', '140,170,255', 3.1], [1.5, 'hex', '255,220,140', .9]]
    .map(([f, k, rgb, s]) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: mk(flareCanvas(k, rgb)), color: hdr(0xffffff, 1.4), ...AB, depthTest: false, opacity: 0 })); sp.userData = { f, s }; cam.add(sp); return sp; });

  // ---- cámara: salto entre estrellas → órbita → amanecer → horizonte ----
  const ease3 = k => 1 - Math.pow(1 - k, 3), inout = k => k < .5 ? 4 * k ** 3 : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const up = A.upAt / 1000, look = new T.Vector3(), tmp = new T.Vector3(), cp = new T.Vector3();
  const fwd = new T.Vector3(), side = new T.Vector3(), upv = new T.Vector3(), rel = new T.Vector3(), qi = new T.Quaternion();
  let prevZ = null, sunSeen = -1, prevT = -1;
  const bloomBase = post.bloom ? post.bloom.intensity : 0;
  g.start((t, dtr) => {
    const et = t + lag, dt = dtr;
    const kW = ease3(Math.min(1, et / 2.7)), kO = inout(Math.min(1, Math.max(0, (et - 1.6) / 2.6))), kU = inout(Math.min(1, Math.max(0, (et - up) / 1.8)));
    const D = 520 - 480 * kW - 6 * kO - 12 * kU + 0;
    const th = -.55 + .5 * kW + .62 * kO + .1 * kU + Math.max(0, et - up - 1.8) * .012;
    const hgtC = .38 - .3 * kO - .02 * kU;
    cp.set(Math.sin(th) * D, hgtC * D, Math.cos(th) * D);
    cam.position.copy(cp);
    look.set(0, R * (.62 + .2 * kO) * (1 - kU) + R * 1.18 * kU, 0);
    cam.lookAt(look); cam.rotateZ(Math.sin(et * .35) * .015 + (1 - kW) * .08);
    sky.position.copy(cp);
    // estelas de estrellas según la velocidad de la cámara
    const speed = prevZ === null || dt <= 0 ? 0 : Math.abs(D - prevZ) / dt; prevZ = D;
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
    starMat.uniforms.uTime.value = et; uni.uTime.value = et;
    // los puntos se esconden un poco cuando las estelas son largas (se ven como rayas)
    stars.visible = len < 40;
    globe.rotation.y = et * .03; clouds.rotation.y = et * .042;
    // sol en coordenadas locales de cada capa (sombras y relieve de nubes)
    earth.updateMatrixWorld(true);
    globe.getWorldQuaternion(qi).invert(); uni.sunObj.value.copy(sunDir).applyQuaternion(qi);
    clouds.getWorldQuaternion(qi).invert(); cloudUni.sunObj.value.copy(sunDir).applyQuaternion(qi);
    // visibilidad del sol: cuánto asoma por detrás del planeta
    const toS = tmp.copy(S).sub(cp).normalize(), tc = -cp.dot(toS), closest = Math.sqrt(Math.max(0, cp.lengthSq() - tc * tc));
    const vis = tc < 0 ? 1 : Math.min(1, Math.max(0, (closest - R * .985) / (R * .16)));
    if (vis > .05 && sunSeen < 0) sunSeen = et;
    const pop = sunSeen < 0 ? 0 : 1 + 2.2 * Math.exp(-(et - sunSeen) * 2.6);
    sunSprites.forEach(s => {
      s.material.opacity = s.userData.op * vis * Math.min(1, pop);
      if (s.userData.streak) s.scale.set(5200 * vis * pop, 56 * vis + 1, 1); else s.scale.setScalar(s.userData.sc * (.5 + .5 * vis) * Math.max(1, pop * .8));
    });
    burst.material.rotation = et * .05;
    // fantasmas de la lente en la línea sol → centro de pantalla
    const ndc = tmp.copy(S).project(cam), hh = Math.tan(T.MathUtils.degToRad(cam.fov / 2)) * 10, hw = hh * cam.aspect;
    const onScreen = ndc.z < 1 ? 1 : 0;
    ghosts.forEach(gh => { const f = gh.userData.f; gh.position.set(ndc.x * hw * (1 - 2 * f), ndc.y * hh * (1 - 2 * f), -10); gh.scale.setScalar(gh.userData.s * (.6 + .4 * vis)); gh.material.opacity = vis * onScreen * .55 * Math.min(1.6, pop); });
    // el bloom y la aberración crecen cuando el sol asoma tras el limbo
    if (post.bloom) post.bloom.intensity = bloomBase * (1 + .5 * vis * Math.min(1, pop) * (sunSeen < 0 ? 0 : 1));
    if (post.ca) { const v = .0007 + (1 - kW) * .003 + vis * Math.min(1, pop) * .0008; post.ca.offset.set(v, v); }
  });
}

// la textura se genera en segundo plano al cargar, para que la intro empiece al instante
addEventListener('load', () => setTimeout(() => { try { earthTextures(); } catch(e) {} }, 1200));
