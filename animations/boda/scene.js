import { $, esc, faceCanvas, loadImg, photoFor } from '@kit';

// =====================================================================
//  LA BODA: el vídeo suena a pantalla completa («yo me opongo») y, cuando
//  arranca la canción, se funde a una cubierta de barco en 3D: los jugadores
//  entran desfilando, se colocan por equipos y bailan al ritmo con el vídeo
//  del baile final proyectado en una pantalla gigante al fondo.
// =====================================================================
const CUT = 38.7;        // fin de la escena de la película: empieza la canción
const BEAT = .465;       // ~129 ppm
const WALK = 6.5;        // segundos de desfile
const DANCE_DONE = 16;   // a los X s de baile se dan por cerrados los equipos

export async function playBoda(X) {
  const { teams, later } = X;
  const fx = $('#vsFx'), layer = $('#vsLayer');
  layer.classList.add('up');

  // ---------- 1. el vídeo, a pantalla completa ----------
  const vid = document.createElement('video');
  vid.className = 'bd-vid'; vid.playsInline = true; vid.preload = 'auto'; vid.src = X.url('boda/boda.mp4');
  fx.appendChild(vid);
  const tip = document.createElement('button'); tip.className = 'bd-snd'; tip.textContent = '🔇 toca para activar el sonido'; tip.hidden = true; fx.appendChild(tip);
  tip.onclick = (e) => { e.stopPropagation(); vid.muted = false; tip.hidden = true; };
  X.onClose(() => { vid.pause(); vid.removeAttribute('src'); vid.load(); });
  vid.play().catch(() => { vid.muted = true; tip.hidden = false; vid.play().catch(() => {}); });

  // ---------- 2. la escena 3D se prepara mientras suena la película ----------
  const imgs = await Promise.all(teams.flatMap((t) => t.members.map((m) => loadImg(photoFor(m.name)))));
  if (!X.isOpen()) return;
  const g = await X.three({ clear: 0x9fd2ef, fov: 40, tone: 'neutral', env: true, envIntensity: .8,
    bloom: { intensity: .6, threshold: .9, radius: .6 }, ao: false, vignette: { offset: .35, darkness: .35 }, ca: false });
  if (!g || !X.isOpen()) return;
  const { T, scene, cam, tex, sun, q } = g;
  g.canvas.style.opacity = '0'; g.canvas.style.transition = 'opacity 1.2s ease';
  scene.fog = new T.Fog(0xbfe3f5, 30, 90);
  scene.add(new T.HemisphereLight(0xdff2ff, 0xc9a77a, 1.6));
  const sl = new T.DirectionalLight(0xfff1dc, 3.2); sl.position.set(8, 16, 10); scene.add(sl, sl.target); sun(sl, { size: 16, res: q.mob ? 1024 : 2048 });

  // cubierta de madera (tablones procedurales)
  const deckC = document.createElement('canvas'); deckC.width = 512; deckC.height = 512; { const d = deckC.getContext('2d');
    for (let i = 0; i < 16; i++) { const l = 52 + Math.random() * 10; d.fillStyle = `hsl(32 38% ${l}%)`; d.fillRect(0, i * 32, 512, 32); d.fillStyle = 'rgba(60,35,15,.35)'; d.fillRect(0, i * 32 + 30, 512, 2);
      for (let k = 0; k < 3; k++) { const x = Math.random() * 512; d.fillRect(x, i * 32, 2, 30); } } }
  const deckT = tex(deckC); deckT.wrapS = deckT.wrapT = T.RepeatWrapping; deckT.repeat.set(6, 6);
  const deck = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshStandardMaterial({ map: deckT, roughness: .8 }));
  deck.rotation.x = -Math.PI / 2; deck.receiveShadow = true; scene.add(deck);
  // barandilla y franjas de colores (como la cubierta del vídeo)
  const railM = new T.MeshStandardMaterial({ color: 0xf4f4f4, metalness: .6, roughness: .3 });
  for (let x = -14; x <= 14; x += 1.6) { const p = new T.Mesh(new T.CylinderGeometry(.04, .04, 1.1, 6), railM); p.position.set(x, .55, -9); scene.add(p); }
  const bar = new T.Mesh(new T.CylinderGeometry(.05, .05, 28.5, 8), railM); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.1, -9); scene.add(bar);
  ['#e94b3c', '#f6a623', '#3bb273', '#2f7fd8'].forEach((c, i) => { const s = new T.Mesh(new T.PlaneGeometry(30, .5), new T.MeshStandardMaterial({ color: c, roughness: .9 })); s.rotation.x = -Math.PI / 2; s.position.set(0, .01, 5 + i * .5); scene.add(s); });
  // pantalla gigante con el baile del vídeo
  const vt = new T.VideoTexture(vid); vt.colorSpace = T.SRGBColorSpace;
  const screen = new T.Mesh(new T.PlaneGeometry(12.8, 7.2), new T.MeshBasicMaterial({ map: vt, toneMapped: false }));
  screen.position.set(0, 5.4, -10.5); scene.add(screen);
  const frame = new T.Mesh(new T.BoxGeometry(13.3, 7.7, .3), new T.MeshStandardMaterial({ color: 0x222222, roughness: .5 })); frame.position.set(0, 5.4, -10.7); scene.add(frame);

  // ---------- jugadores: cuerpo de cápsulas con la cara en la cabeza ----------
  const skin = new T.MeshStandardMaterial({ color: 0xf0c8a0, roughness: .7 }), pant = new T.MeshStandardMaterial({ color: 0x2b2f3a, roughness: .8 });
  const cols = teams.map((t) => new T.MeshStandardMaterial({ color: t.bar || '#888', roughness: .6 }));
  const cap = (r, l, m) => { const o = new T.Mesh(new T.CapsuleGeometry(r, l, 4, 10), m); o.castShadow = true; return o; };
  const people = [];
  let ii = 0;
  teams.forEach((t, ti) => t.members.forEach((m, k) => {
    const root = new T.Group(), hip = new T.Group(); root.add(hip);
    const torso = cap(.26, .42, cols[ti]); torso.position.y = 1.05; hip.add(torso);
    const legs = [-1, 1].map((s) => { const l = new T.Group(); l.position.set(s * .14, .78, 0); const c = cap(.1, .5, pant); c.position.y = -.38; l.add(c); hip.add(l); return l; });
    const arms = [-1, 1].map((s) => { const a = new T.Group(); a.position.set(s * .36, 1.32, 0); const c = cap(.08, .42, cols[ti]); c.position.y = -.3; a.add(c); const h = new T.Mesh(new T.SphereGeometry(.08, 10, 8), skin); h.position.y = -.6; a.add(h); hip.add(a); return a; });
    const face = new T.Sprite(new T.SpriteMaterial({ map: tex(faceCanvas(m.name, t.bar || '#888', imgs[ii++], m.name)) }));
    face.scale.set(.78, .91, 1); face.position.y = 1.86; hip.add(face);
    // sitio final: dos bloques, uno por equipo, frente a la pantalla
    const n = t.members.length, cols2 = Math.min(4, n), row = Math.floor(k / cols2), colI = k % cols2;
    const side = teams.length === 1 ? 0 : (ti / (teams.length - 1) - .5) * 2;
    const tx = side * 4.6 + (colI - (cols2 - 1) / 2) * 1.25, tz = 1.2 + row * 1.4;
    const fromL = ti % 2 === 0;
    root.position.set(fromL ? -16 : 16, 0, tz); scene.add(root);
    people.push({ root, hip, legs, arms, tx, tz, sx: root.position.x, delay: k * .35 + ti * .15, ph: Math.random() * 6, style: (k + ti) % 3 });
  }));
  // carteles de equipo
  const labels = teams.map((t, ti) => { const el = document.createElement('div'); el.className = 'bd-team'; el.style.setProperty('--c', t.bar || '#888');
    el.innerHTML = `<b>${esc(t.name)}</b>`; const side = teams.length === 1 ? 0 : (ti / (teams.length - 1) - .5) * 2; el.style.left = (50 + side * 24) + '%'; fx.appendChild(el); return el; });

  cam.position.set(0, 4.2, 15); cam.lookAt(0, 2, 0);
  const ease = (x) => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  let started = false, t3 = 0, doneF = false;

  const tick = () => {
    if (!X.isOpen()) return;
    if (!started && (vid.currentTime >= (window.__bodaCut ?? CUT) || vid.ended)) {
      started = true; vid.classList.add('off'); g.canvas.style.opacity = '1';
      g.start((et, dt) => {
        t3 += dt * (window.__bodaSpeed || 1);
        const beat = vid.currentTime / BEAT;
        // cámara: entra desde arriba y luego se mece con la música
        const k = Math.min(1, t3 / 5);
        cam.position.set(Math.sin(t3 * .25) * 2.4 * k, 5.6 - 2.6 * ease(k) + Math.sin(beat * Math.PI) * .05, 17 - 6.5 * ease(k));
        cam.lookAt(0, 1.8, 0);
        people.forEach((p) => {
          const w = Math.min(1, Math.max(0, (t3 - p.delay) / WALK));
          if (w < 1) {   // desfile hasta su sitio
            const e = ease(w);
            p.root.position.x = p.sx + (p.tx - p.sx) * e; p.root.position.z = p.tz;
            p.root.rotation.y = (p.tx > p.sx ? 1 : -1) * Math.PI / 2 * (1 - Math.min(1, w * 1.3 - .3 > 0 ? (w - .8) * 5 : 0));
            const s = Math.sin(t3 * 9 + p.ph);
            p.legs[0].rotation.x = s * .6; p.legs[1].rotation.x = -s * .6; p.arms[0].rotation.x = -s * .5; p.arms[1].rotation.x = s * .5;
            p.hip.position.y = Math.abs(s) * .06;
          } else {       // baile: tres estilos, todos al compás
            p.root.rotation.y = Math.sin(beat * Math.PI * .5 + p.ph) * .25;
            const b = beat * Math.PI, s = Math.sin(b), c = Math.cos(b);
            p.hip.position.y = Math.abs(s) * .14;
            p.hip.rotation.z = s * .12;
            p.root.position.x = p.tx + Math.sin(b * .5 + p.ph) * .25;
            if (p.style === 0) { p.arms[0].rotation.z = -1.2 - s * .8; p.arms[1].rotation.z = 1.2 + c * .8; p.arms[0].rotation.x = p.arms[1].rotation.x = 0; }
            else if (p.style === 1) { p.arms[0].rotation.x = -2.6 + s * .5; p.arms[1].rotation.x = -2.6 - s * .5; p.arms[0].rotation.z = p.arms[1].rotation.z = 0; }
            else { p.arms[0].rotation.z = -.4 - Math.max(0, s) * 1.6; p.arms[1].rotation.z = .4 + Math.max(0, -s) * 1.6; p.arms[0].rotation.x = p.arms[1].rotation.x = -.4; }
            p.legs[0].rotation.x = Math.max(0, s) * .7; p.legs[1].rotation.x = Math.max(0, -s) * .7;
          }
        });
        if (t3 > WALK + 1.5) labels.forEach((l) => l.classList.add('on'));
        if (!doneF && t3 > WALK + DANCE_DONE) { doneF = true; X.done(); }
      });
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  vid.addEventListener('ended', () => { if (!doneF) { doneF = true; X.done(); } later(X.close, 6000); });
}
