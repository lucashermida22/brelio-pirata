// Motor 3D común de las animaciones (three.js r185 + postprocessing + N8AO).
// Se carga perezosamente: solo si una animación pide `ctx.three()`.
//
//   const g = await ctx.three({ fov, clear, tone, exposure, env, bloom, ao, vignette, grain, ca, dof, godrays })
//   g.T, g.scene, g.cam, g.renderer, g.post.{bloom,vignette,ca,noise,tone,ao,dof,godrays}, g.tex(canvas), g.q (calidad)
//   g.sun(light, {size, res, radius, bias}) → configura sombras suaves; g.start((t, dt) => …)
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

export function glInit(opts = {}) {
  const T = threeNS(), fx = $('#vsFx'), P = T.PP, q = quality();
  const canvas = document.createElement('canvas'); canvas.className = 'three-cv';
  opts.append ? fx.appendChild(canvas) : fx.prepend(canvas);
  let W = innerWidth, H = innerHeight, renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, stencil: false, depth: true, powerPreference: 'high-performance', alpha: !!opts.alpha }); }
  catch (e) { canvas.remove(); return null; }
  renderer.setPixelRatio(q.dpr); renderer.setSize(W, H, false);
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NoToneMapping;
  renderer.setClearColor(opts.clear ?? 0x000000, opts.alpha ? 0 : 1);
  if (opts.clipping) renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = opts.shadows !== false; renderer.shadowMap.type = T.PCFShadowMap;

  const scene = new T.Scene(), cam = new T.PerspectiveCamera(opts.fov || 45, W / H, opts.near || .1, opts.far || 600);
  // reflejos: entorno de estudio filtrado (PMREM) salvo que la escena traiga el suyo
  let pmrem = null, envRT = null;
  if (opts.env !== false) {
    try { pmrem = new T.PMREMGenerator(renderer); envRT = pmrem.fromScene(new T.RoomEnvironment(), .04); scene.environment = envRT.texture; scene.environmentIntensity = opts.envIntensity ?? .6; }
    catch (e) { pmrem = null; }
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

  const onResize = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); composer && composer.setSize(W, H); post.ao && post.ao.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); };
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

  let raf, fn = null; const t0 = performance.now(); let prev = t0;
  const loop = now => {
    const et = (now - t0) / 1000, dt = Math.min(.05, (now - prev) / 1000); prev = now;
    fn && fn(et, dt);
    composer ? composer.render(dt) : renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  };
  vs.fxStop = () => {
    cancelAnimationFrame(raf); removeEventListener('resize', onResize);
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }); });
    try { composer && composer.dispose(); envRT && envRT.dispose(); pmrem && pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* nada */ }
    canvas.remove();
  };
  return { T, scene, cam, renderer, composer, post, tex, sun, q, canvas, get W() { return W; }, get H() { return H; }, start(f) { fn = f; raf = requestAnimationFrame(loop); } };
}
