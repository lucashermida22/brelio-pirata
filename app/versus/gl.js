// Motor 3D común de las animaciones (three.js r185 + postprocessing + N8AO).
// Se carga perezosamente: solo si una animación pide `ctx.three()`.
//
//   const g = await ctx.three({ fov, clear, tone, exposure, env, bloom, ao, vignette, grain, ca, dof, godrays })
//   g.T, g.scene, g.cam, g.renderer, g.post.{bloom,vignette,ca,noise,tone,ao,dof,godrays}, g.tex(canvas), g.q (calidad)
//   g.sun(light, {size, res, radius, bias}) → configura sombras suaves; g.start((t, dt) => …)
//   g.precompile(obj3D) → Promise: compila en paralelo los shaders de algo que añadirás después a la escena
//
// Todo trabaja en espacio lineal y HDR; el tono y el sRGB se aplican al final.
import { $ } from '../util.js';
import { vs } from './state.js';

let T = null;
export const threeNS = () => T;
export async function loadThree() {
  if (T) return T;
  const [core, pp, n8, room, rbox, bgu, sky, simplex] = await Promise.all([
    import('three'),
    import('postprocessing'),
    import('n8ao'),
    import('three/examples/jsm/environments/RoomEnvironment.js'),
    import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
    import('three/examples/jsm/utils/BufferGeometryUtils.js'),
    import('three/examples/jsm/objects/Sky.js'),
    import('three/examples/jsm/math/SimplexNoise.js'),
  ]);
  T = {
    ...core, PP: pp, N8AOPostPass: n8.N8AOPostPass,
    RoomEnvironment: room.RoomEnvironment, RoundedBoxGeometry: rbox.RoundedBoxGeometry,
    mergeGeometries: bgu.mergeGeometries, mergeVertices: bgu.mergeVertices, Sky: sky.Sky, SimplexNoise: simplex.SimplexNoise,
  };
  return T;
}

// GLSL: los colores escritos a mano en los shaders están en sRGB; el pipeline es lineal.
export const GLSL_SRGB = 'vec3 s2l(vec3 c){ return pow(max(c, vec3(0.)), vec3(2.2)); }\n';

// calidad: alta en escritorio, más ligera en móviles
export function quality() {
  const mob = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 560;
  const dpr = devicePixelRatio || 1;
  return { hi: !mob, mob, dpr: Math.min(mob ? 1.6 : 2, dpr), msaa: mob ? 0 : 4, shadow: mob ? 1024 : 2048 };
}

// ---- renderer persistente ---------------------------------------------------------------------
// Un único WebGLRenderer (con su canvas, su entorno PMREM y, con ellos, la caché de programas de three) vive toda
// la sesión. Cada glInit() devuelve una escena/cámara/composer nuevos y, al cerrar, se liberan solo los recursos de
// esa escena. Así la 2.ª animación 3D no vuelve a compilar los mismos shaders.
const R = { renderer: null, canvas: null, alpha: false, pmrem: null, envRT: null, lost: false, active: null };
const DEV = !!(import.meta.env && import.meta.env.DEV);
if (typeof window !== 'undefined') window.__brelioGL = R;   // para depurar: __brelioGL.renderer.info
const MAX_PROGRAMS = 400;   // si la caché crece demasiado (shaders muy distintos), se reconstruye el renderer

function dropRenderer() {
  const r = R.renderer;
  try { R.envRT && R.envRT.dispose(); R.pmrem && R.pmrem.dispose(); r && r.dispose(); r && r.forceContextLoss(); } catch (e) { /* nada */ }
  R.canvas && R.canvas.remove();
  R.renderer = R.canvas = R.pmrem = R.envRT = null; R.lost = false;
}

function ensureRenderer(T, alpha) {
  if (R.renderer && (R.lost || R.alpha !== alpha || R.renderer.info.programs.length > MAX_PROGRAMS)) dropRenderer();
  if (R.renderer) return R.renderer;
  const canvas = document.createElement('canvas'); canvas.className = 'three-cv';
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, stencil: false, depth: true, powerPreference: 'high-performance', alpha });
  // sin esto three pide getProgramInfoLog por cada programa (síncrono: congela hasta que compila)
  renderer.debug.checkShaderErrors = DEV;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R.lost = true; }, false);
  Object.assign(R, { renderer, canvas, alpha, lost: false });
  return renderer;
}

// entorno de estudio filtrado (PMREM), una sola vez por renderer
function sharedEnv(T, renderer) {
  if (!R.envRT) {
    R.pmrem = new T.PMREMGenerator(renderer);
    const room = new T.RoomEnvironment();
    R.envRT = R.pmrem.fromScene(room, .04);
    room.dispose && room.dispose();
  }
  return R.envRT;
}

// Libera geometrías, texturas y sombras de una escena. Los materiales NO se liberan: material.dispose() destruiría
// su programa y la caché dejaría de servir a la siguiente animación (sin referencias, el GC se los lleva).
function disposeScene(scene, keep) {
  const tex = (v) => { if (v && v.isTexture && v !== keep) v.dispose(); };
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.isInstancedMesh || o.isLight) { try { o.dispose(); } catch (e) { /* nada */ } }
    if (o.skeleton) o.skeleton.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach((m) => {
      for (const k in m) tex(m[k]);
      if (m.uniforms) for (const u in m.uniforms) tex(m.uniforms[u] && m.uniforms[u].value);
    });
  });
  tex(scene.background); tex(scene.environment);
}

function resetRenderer(T, renderer) {
  try {
    renderer.setRenderTarget(null); renderer.setScissorTest(false);
    renderer.autoClear = true; renderer.autoClearColor = renderer.autoClearDepth = renderer.autoClearStencil = true;
    renderer.sortObjects = true; renderer.localClippingEnabled = false; renderer.clippingPlanes = [];
    renderer.toneMapping = T.NoToneMapping; renderer.toneMappingExposure = 1; renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap; renderer.shadowMap.autoUpdate = true; renderer.shadowMap.needsUpdate = false;
    renderer.setClearColor(0x000000, 1); renderer.setPixelRatio(1); renderer.setSize(1, 1, false);
    renderer.renderLists.dispose();
  } catch (e) { /* nada */ }
}

// resolución adaptativa
const ADAPT_WINDOW = 1000, SLOW_MS = 22, FAST_MS = 12;

export function glInit(opts = {}) {
  const T = threeNS(), fx = $('#vsFx'), P = T.PP, q = quality();
  if (R.active) R.active.release();   // una animación anterior que no llegó a cerrarse
  let W = innerWidth, H = innerHeight, renderer;
  try { renderer = ensureRenderer(T, !!opts.alpha); }
  catch (e) { dropRenderer(); return null; }
  const canvas = R.canvas; canvas.removeAttribute('style');
  opts.append ? fx.appendChild(canvas) : fx.prepend(canvas);
  renderer.setPixelRatio(q.dpr); renderer.setSize(W, H, false);
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NoToneMapping; renderer.toneMappingExposure = 1;
  renderer.setClearColor(opts.clear ?? 0x000000, opts.alpha ? 0 : 1);
  renderer.localClippingEnabled = !!opts.clipping;
  renderer.shadowMap.enabled = opts.shadows !== false; renderer.shadowMap.type = T.PCFShadowMap;

  const scene = new T.Scene(), cam = new T.PerspectiveCamera(opts.fov || 45, W / H, opts.near || .1, opts.far || 600);
  // reflejos: entorno de estudio filtrado (PMREM, compartido) salvo que la escena traiga el suyo
  let envTex = null;
  if (opts.env !== false) {
    try { envTex = sharedEnv(T, renderer).texture; scene.environment = envTex; scene.environmentIntensity = opts.envIntensity ?? .6; }
    catch (e) { /* sin entorno */ }
  }

  // ---- postproceso ----
  const post = {};
  let composer = null;
  try {
    composer = new P.EffectComposer(renderer, { frameBufferType: T.HalfFloatType, multisampling: q.msaa });
    composer.addPass(new P.RenderPass(scene, cam));
    if (opts.ao) {
      const ao = new T.N8AOPostPass(scene, cam, W, H), a = opts.ao === true ? {} : opts.ao;
      Object.assign(ao.configuration, { aoRadius: a.radius ?? 2, distanceFalloff: a.falloff ?? 1, intensity: a.intensity ?? 2.2, color: new T.Color(a.color ?? 0x000000), halfRes: !q.hi, aoSamples: q.hi ? 16 : 8, denoiseSamples: q.hi ? 8 : 4, gammaCorrection: false });
      composer.addPass(ao); post.ao = ao;
    }
    const eff = [];
    if (opts.godrays) {
      const src = opts.godrays.sun || new T.Mesh(new T.SphereGeometry(1, 16, 8), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
      post.godrays = new P.GodRaysEffect(cam, src, { density: .9, decay: .93, weight: .35, exposure: .5, samples: q.hi ? 60 : 36, clampMax: 1, resolutionScale: .5, blur: true, ...opts.godrays.o });
      eff.push(post.godrays);
    }
    if (opts.dof) { post.dof = new P.DepthOfFieldEffect(cam, { focusDistance: .02, focalLength: .05, bokehScale: 2.5, resolutionScale: .5, ...opts.dof }); eff.push(post.dof); }
    // bloom: [fuerza, radio, umbral] como antes, u objeto
    const b = Array.isArray(opts.bloom) ? { intensity: opts.bloom[0] * 1.4, radius: .55 + opts.bloom[1] * .3, threshold: Math.pow(opts.bloom[2], 2.2) * .9 } : (opts.bloom || {});
    if (opts.bloom !== false) { post.bloom = new P.BloomEffect({ mipmapBlur: true, intensity: b.intensity ?? 1, radius: b.radius ?? .7, luminanceThreshold: b.threshold ?? .6, luminanceSmoothing: b.smoothing ?? .25, levels: 7 }); eff.push(post.bloom); }
    if (opts.ca !== false) { const o = opts.ca ?? .0006; post.ca = new P.ChromaticAberrationEffect({ offset: new T.Vector2(o, o), radialModulation: true, modulationOffset: .35 }); eff.push(post.ca); }
    post.tone = new P.ToneMappingEffect({ mode: P.ToneMappingMode[(opts.tone || 'neutral').toUpperCase()] ?? P.ToneMappingMode.NEUTRAL });
    eff.push(post.tone);
    if (opts.vignette !== false) { const v = opts.vignette || {}; post.vignette = new P.VignetteEffect({ offset: v.offset ?? .32, darkness: v.darkness ?? .5 }); eff.push(post.vignette); }
    if (opts.grain) { post.noise = new P.NoiseEffect({ premultiply: true }); post.noise.blendMode.opacity.value = opts.grain; eff.push(post.noise); }
    if (opts.exposure) renderer.toneMappingExposure = opts.exposure;
    const ep = new P.EffectPass(cam, ...eff); composer.addPass(ep); post.pass = ep;
    if (!q.msaa) { post.smaa = new P.SMAAEffect({ preset: P.SMAAPreset.HIGH }); composer.addPass(new P.EffectPass(cam, post.smaa)); }
  } catch (e) { console.warn('postproceso desactivado:', e); composer = null; renderer.toneMapping = T.NeutralToneMapping; }

  let pr = q.dpr;   // pixel ratio actual (la resolución adaptativa lo mueve)
  const applySize = () => { renderer.setSize(W, H, false); composer && composer.setSize(W, H); post.ao && post.ao.setSize(W, H); };
  const onResize = () => { W = innerWidth; H = innerHeight; applySize(); cam.aspect = W / H; cam.updateProjectionMatrix(); };
  addEventListener('resize', onResize);
  const maxA = renderer.capabilities.getMaxAnisotropy();
  const tex = (c, o = {}) => { const t = c && c.isTexture ? c : new T.CanvasTexture(c); t.colorSpace = o.linear ? T.NoColorSpace : T.SRGBColorSpace; t.anisotropy = maxA; t.needsUpdate = true; return t; };
  // sombras suaves y bien encajadas para una luz direccional
  const sun = (l, o = {}) => {
    l.castShadow = true; const s = o.size ?? 40, r = o.res ?? q.shadow;
    l.shadow.mapSize.set(r, r); Object.assign(l.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: o.near ?? .5, far: o.far ?? 400 });
    l.shadow.camera.updateProjectionMatrix(); l.shadow.bias = o.bias ?? -.0004; l.shadow.normalBias = o.normalBias ?? .02; l.shadow.radius = o.radius ?? 3; l.shadow.blurSamples = 12;
    return l;
  };

  // ---- compilación sin bloqueo (KHR_parallel_shader_compile) ----
  // materiales de los pases de postproceso (N8AO, bloom, godrays…), para compilarlos también en paralelo
  const passMaterials = () => {
    const out = new Set(), seen = new Set(), add = (m) => { if (m && m.isShaderMaterial) out.add(m); };
    // recorre (con duck-typing: en producción los nombres de clase están minificados) pases, efectos y sus pases internos
    const scan = (p, depth) => {
      if (!p || typeof p !== 'object' || seen.has(p) || p.isObject3D || p.isTexture || p.isWebGLRenderTarget || p.isBufferGeometry || p.isWebGLRenderer) return;
      seen.add(p);
      if (p.isShaderMaterial) { add(p); return; }
      if (p.material && p.material.isShaderMaterial) add(p.material);
      add(p.fullscreenMaterial);
      if (depth <= 0) return;
      for (const k in p) { const v = p[k]; if (v && typeof v === 'object') (Array.isArray(v) ? (v.length < 24 ? v : []) : [v]).forEach((x) => scan(x, depth - 1)); }
    };
    composer && composer.passes.forEach((p) => { if (p.scene !== scene) scan(p, 3); });
    return out;
  };
  // Lanza la compilación en paralelo de `obj` (por defecto toda la escena) y espera a que termine. Se compila con el
  // estado real (el del primer fotograma) y, si hay luces ocultas, otra vez con todas visibles (otro nº de luces = otro
  // programa). La visibilidad se restaura al instante: es la parte síncrona de compile() la que la lee.
  const compileAll = async (obj, withPasses) => {
    obj = obj || scene;
    const prevRT = renderer.getRenderTarget(), jobs = [];
    try {
      if (composer) renderer.setRenderTarget(composer.inputBuffer);   // con composer se renderiza a un RT lineal: otra variante de programa
      jobs.push(renderer.compileAsync(obj, cam, scene));
      const hid = []; scene.traverse((o) => { if (o.isLight && !o.visible) hid.push(o); });
      if (hid.length) { hid.forEach((o) => { o.visible = true; }); try { jobs.push(renderer.compileAsync(obj, cam, scene)); } finally { hid.forEach((o) => { o.visible = false; }); } }
      if (withPasses && composer) {
        const mats = passMaterials();
        if (mats.size) {
          // la geometría debe tener atributo `position` (entra en la clave del programa), como la de pantalla completa
          const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(9), 3)); geo.setAttribute('uv', new T.BufferAttribute(new Float32Array(6), 2));
          const tmp = new T.Scene(); mats.forEach((m) => tmp.add(new T.Mesh(geo, m)));
          jobs.push(renderer.compileAsync(tmp, cam));
          renderer.setRenderTarget(null);   // el último pase pinta en pantalla: otra variante (espacio de color de salida)
          jobs.push(renderer.compileAsync(tmp, cam));
        }
      }
    } finally { renderer.setRenderTarget(prevRT); }
    await Promise.all(jobs);
  };

  // ---- bucle ----
  let raf = 0, fn = null, t0 = null, tCall = 0, prev = 0, dead = false, booting = false;
  // resolución adaptativa: media de ~1 s; > 22 ms baja, < 12 ms (4 ventanas seguidas) sube; tras cada cambio se salta alguna ventana
  const minPr = Math.min(q.dpr, q.mob ? .75 : 1);
  let aWin = 0, aN = 0, aSum = 0, aSkip = 2, aFast = 0, aLow = false;
  const adapt = (ft, now) => {
    if (ft > 250) { aSkip = Math.max(aSkip, 1); return; }     // pestaña oculta o parón: no cuenta
    if (!aWin) aWin = now;
    aSum += ft; aN++;
    if (now - aWin < ADAPT_WINDOW) return;
    const avg = aSum / aN; aSum = 0; aN = 0; aWin = now;
    if (aSkip > 0) { aSkip--; return; }
    if (window.__noAdapt) return;
    if (avg > SLOW_MS) {
      aFast = 0;
      if (pr > minPr + .01) { pr = Math.max(minPr, +(pr * .85).toFixed(2)); renderer.setPixelRatio(pr); applySize(); aSkip = 2; }
      else if (!aLow && post.ao) { aLow = true; post.ao.configuration.halfRes = true; aSkip = 2; }   // recompila el AO una vez
    } else if (avg < FAST_MS) {
      if (++aFast >= 4 && pr < q.dpr - .01) { aFast = 0; pr = Math.min(q.dpr, +(pr / .85).toFixed(2)); renderer.setPixelRatio(pr); applySize(); aSkip = 3; }
    } else aFast = 0;
  };
  const loop = (now) => {
    if (dead) return;
    let dt;
    if (t0 === null) { t0 = now; prev = now; dt = 1 / 60; } else { dt = Math.min(.05, (now - prev) / 1000); adapt(now - prev, now); prev = now; }
    fn && fn(Math.max(0, now - tCall) / 1000, dt);
    composer ? composer.render(dt) : renderer.render(scene, cam);
    if (t0 === now) { const L = document.getElementById('vsLayer'); L && L.classList.remove('loading'); }   // ya hay imagen: fuera el telón
    raf = requestAnimationFrame(loop);
  };
  // el reloj (`et`) cuenta desde la llamada a start() (la música no espera a la compilación): el 1.er fotograma llega con et ≈ tiempo de compilación
  const boot = async () => {
    try { await compileAll(scene, true); } catch (e) { console.warn('compileAsync:', e); }
    if (dead) return;
    raf = requestAnimationFrame(loop);
  };

  const release = () => {
    if (dead) return; dead = true;
    cancelAnimationFrame(raf); removeEventListener('resize', onResize);
    if (R.active === api) R.active = null;
    try { disposeScene(scene, envTex); } catch (e) { /* nada */ }
    try { composer && composer.dispose(); } catch (e) { /* nada */ }
    canvas.remove();
    if (R.renderer === renderer) resetRenderer(T, renderer);
  };
  vs.fxStop = release;
  const api = {
    T, scene, cam, renderer, composer, post, tex, sun, q, canvas, get W() { return W; }, get H() { return H; }, get pixelRatio() { return pr; },
    start(f) { fn = f; if (!dead && !booting) { booting = true; tCall = performance.now(); boot(); } },
    precompile(obj) { return dead ? Promise.resolve() : compileAll(obj || scene, false).catch(() => {}); },
    release,
  };
  R.active = api;
  return api;
}
