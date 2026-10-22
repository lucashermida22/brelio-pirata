// Utilidades compartidas por las animaciones: lienzos 2D para texturas, sonido
// sintetizado (Web Audio) y la base común de las escenas Three.js.
// Las animaciones las reciben por `ctx.kit`; no las importan directamente.
import { $ } from '../util.js';
import { vs } from './state.js';
import { emojiFor } from '../photos.js';
import { LANE_COLORS } from '../teams.js';

// ---- Three.js (carga perezosa: solo se descarga si una animación lo pide) ----
let T = null;
export const threeNS = () => T;
export async function loadThree() {
  if (T) return T;
  const [core, ec, rp, bp] = await Promise.all([
    import('three'),
    import('three/examples/jsm/postprocessing/EffectComposer.js'),
    import('three/examples/jsm/postprocessing/RenderPass.js'),
    import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
  ]);
  T = { ...core, EffectComposer: ec.EffectComposer, RenderPass: rp.RenderPass, UnrealBloomPass: bp.UnrealBloomPass };
  return T;
}

export const loadImg = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

export function rrect(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x+r, y); g.arcTo(x+w, y, x+w, y+h, r); g.arcTo(x+w, y+h, x, y+h, r); g.arcTo(x, y+h, x, y, r); g.arcTo(x, y, x+w, y, r); g.closePath(); }
export function cardCanvas(m, color, img){
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
export function textCanvas(text, { size = 64, w = 1024, h = 160, fill = '#fff', glow = '#3d8bff', font = 'Orbitron, "Plus Jakarta Sans", system-ui, sans-serif', weight = 900, italic = false, grad = null } = {}){
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
export function glowCanvas(stops){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return c;
}

// ---------- sonido sintetizado (Web Audio) ----------
export function synth(){
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
export function noiseFactory(seed){
  const p = new Uint8Array(512); const r = (() => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const perm = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const g3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t;
  const dot = (g, x, y, z) => g[0] * x + g[1] * y + g[2] * z;
  return (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    const G = i => g3[p[i] % 12];
    return lerp(lerp(lerp(dot(G(AA), x, y, z), dot(G(BA), x - 1, y, z), u), lerp(dot(G(AB), x, y - 1, z), dot(G(BB), x - 1, y - 1, z), u), v),
                lerp(lerp(dot(G(AA + 1), x, y, z - 1), dot(G(BA + 1), x - 1, y, z - 1), u), lerp(dot(G(AB + 1), x, y - 1, z - 1), dot(G(BB + 1), x - 1, y - 1, z - 1), u), v), w);
  };
}
export function flareCanvas(kind, rgb){
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  if (kind === 'hex'){
    g.beginPath(); for (let k = 0; k < 6; k++){ const a = k / 6 * Math.PI * 2 + Math.PI / 6; g.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); } g.closePath();
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 120); gr.addColorStop(0, `rgba(${rgb},.05)`); gr.addColorStop(.85, `rgba(${rgb},.35)`); gr.addColorStop(1, `rgba(${rgb},.6)`); g.fillStyle = gr; g.fill();
  } else if (kind === 'ring'){
    const gr = g.createRadialGradient(128, 128, 80, 128, 128, 126); gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(.7, `rgba(${rgb},.5)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  } else if (kind === 'burst'){
    g.translate(128, 128);
    for (let k = 0; k < 40; k++){ const a = k / 40 * Math.PI * 2 + Math.random() * .05, L = 60 + Math.random() * 68 * (k % 2 ? .55 : 1);
      const gr = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L); gr.addColorStop(0, 'rgba(255,245,225,.9)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
      g.strokeStyle = gr; g.lineWidth = 1.2 + Math.random() * 1.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.stroke(); }
  }
  return c;
}

// ---------- base común para escenas Three.js ----------
export function glInit(opts = {}){
  const T = threeNS(), fx = $('#vsFx');
  const canvas = document.createElement('canvas'); canvas.className = 'three-cv'; fx.prepend(canvas);
  let W = innerWidth, H = innerHeight, renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch(e) { canvas.remove(); return null; }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(W, H, false);
  renderer.outputEncoding = T.sRGBEncoding; renderer.setClearColor(opts.clear ?? 0x000000, 1);
  if (opts.clipping) renderer.localClippingEnabled = true;
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(opts.fov || 45, W / H, .1, 600);
  let composer = null;
  try { if (T.EffectComposer && T.UnrealBloomPass){ composer = new T.EffectComposer(renderer); composer.addPass(new T.RenderPass(scene, cam)); const b = opts.bloom || [.9, .5, .8]; composer.addPass(new T.UnrealBloomPass(new T.Vector2(W, H), b[0], b[1], b[2])); } } catch(e) { composer = null; }
  const onResize = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); composer && composer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); };
  addEventListener('resize', onResize);
  const tex = c => { const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; };
  let raf, fn = null; const t0 = performance.now(); let prev = t0;
  const loop = now => { const et = (now - t0) / 1000, dt = Math.min(.05, (now - prev) / 1000); prev = now; fn && fn(et, dt); composer ? composer.render() : renderer.render(scene, cam); raf = requestAnimationFrame(loop); };
  vs.fxStop = () => {
    cancelAnimationFrame(raf); removeEventListener('resize', onResize);
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { m.map && m.map.dispose(); m.dispose(); }); });
    try { renderer.dispose(); renderer.forceContextLoss(); } catch(e) {}
    canvas.remove();
  };
  return { T, scene, cam, renderer, tex, get W(){ return W; }, get H(){ return H; }, start(f){ fn = f; raf = requestAnimationFrame(loop); } };
}
export function faceCanvas(name, color, img, label){
  const c = document.createElement('canvas'); c.width = 256; c.height = label ? 300 : 256; const g = c.getContext('2d');
  g.save(); g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.clip();
  if (img){ const s = Math.min(img.width, img.height); g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 16, 16, 224, 224); }
  else { g.font = '140px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emojiFor(name), 128, 140); }
  g.restore(); g.lineWidth = 12; g.strokeStyle = color; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
  if (label){
    g.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = Math.min(250, g.measureText(label).width + 26); rrect(g, 128 - w / 2, 252, w, 44, 14); g.fillStyle = '#120612'; g.fill(); g.fillStyle = '#fff'; g.fillText(label, 128, 275, 230);
  }
  return c;
}
export function heartShape(T){
  const s = new T.Shape();
  s.moveTo(5, 5); s.bezierCurveTo(5, 5, 4, 0, 0, 0); s.bezierCurveTo(-6, 0, -6, 7, -6, 7); s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7); s.bezierCurveTo(16, 7, 16, 0, 10, 0); s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  return s;
}
export function heartGeo(T, size, depth){
  const g = new T.ExtrudeGeometry(heartShape(T), { depth: depth ?? 4, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 1.2, bevelThickness: 1.2, curveSegments: 18 });
  g.center(); g.rotateZ(Math.PI); g.scale(size / 22, size / 22, size / 22); return g;
}
export function popSprite(ctx, text, pos, opts = {}){
  const { T } = ctx;
  const s = new T.Sprite(new T.SpriteMaterial({ map: ctx.tex(textCanvas(text, { size: opts.size || 150, w: 768, h: 220, grad: opts.grad || ['#fff59a', '#ffd23f', '#ff7a1a'], glow: opts.glow || '#ff2a4f', italic: true })), transparent: true, depthTest: false }));
  s.position.copy(pos); s.renderOrder = 999; ctx.scene.add(s);
  const h = opts.h || 1.6; s.userData = { t: 0, h, life: opts.life || .8 };
  return s;
}

