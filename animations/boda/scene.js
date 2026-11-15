import { $, esc, faceCanvas, loadImg, photoFor } from '@kit';

// =====================================================================
//  LA BODA: el vídeo suena a pantalla completa («yo me opongo») y, cuando
//  arranca la canción, se funde a una cubierta de barco en 3D: los jugadores
//  entran desfilando, se colocan por equipos y bailan al ritmo con el vídeo
//  del baile final proyectado en una pantalla gigante al fondo.
// =====================================================================
const CUT = 38.7;        // fin de la escena de la película: empieza la canción
const ENTER = 14;        // los bailarines entran aquí, con el vídeo sonando de fondo
const BEAT = .465;       // ~129 ppm
const WALK = 4;        // segundos de desfile
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
  const g = await X.three({ clear: 0x8ec9ef, fov: 40, tone: 'neutral', env: true, envIntensity: .8,
    bloom: false, ao: false, vignette: { offset: .35, darkness: .35 }, ca: false });
  if (!g || !X.isOpen()) return;
  const { T, scene, cam, tex, sun, q } = g;
  g.canvas.style.opacity = '0'; g.canvas.style.transition = 'opacity 1.2s ease';
  scene.add(new T.HemisphereLight(0xcfd8e8, 0x6a5a48, 1.5));
  const sl = new T.DirectionalLight(0xfff0d6, 3); sl.position.set(-10, 14, 6); scene.add(sl, sl.target); sun(sl, { size: 16, res: q.mob ? 1024 : 2048 });

  // fondo: el propio vídeo, que sigue moviéndose detrás de los bailarines
  const bt = new T.VideoTexture(vid); bt.colorSpace = T.SRGBColorSpace; scene.background = bt;
  const fit = () => { const vw = vid.videoWidth || 16, vh = vid.videoHeight || 9, a = (g.W / g.H) / (vw / vh); bt.repeat.set(Math.min(1, a), Math.min(1, 1 / a)); bt.offset.set((1 - bt.repeat.x) / 2, (1 - bt.repeat.y) / 2); };
  fit(); vid.addEventListener('loadedmetadata', fit); addEventListener('resize', fit); X.onClose(() => removeEventListener('resize', fit));
  scene.fog = null;
  const floor = new T.Mesh(new T.PlaneGeometry(60, 60), new T.ShadowMaterial({ opacity: .35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // ---------- jugadores: cuerpo de cápsulas con la cara en la cabeza ----------
  const skin = new T.MeshStandardMaterial({ color: 0xf0c8a0, roughness: .7 }), pant = new T.MeshStandardMaterial({ color: 0x2b2f3a, roughness: .8 });
  const cols = teams.map((t) => new T.MeshStandardMaterial({ color: new T.Color(t.bar || '#888').lerp(new T.Color(0x8a8070), .35), roughness: .75 }));   // tonos apagados, como la luz de la iglesia
  const cap = (r, l, m) => { const o = new T.Mesh(new T.CapsuleGeometry(r, l, 4, 10), m); o.castShadow = true; return o; };
  const people = [];
  let ii = 0;
  teams.forEach((t, ti) => t.members.forEach((m, k) => {
    const root = new T.Group(), hip = new T.Group(); root.add(hip);
    const torso = cap(.26, .42, cols[ti]); torso.position.y = 1.05; hip.add(torso);
    const legs = [-1, 1].map((s) => { const l = new T.Group(); l.position.set(s * .14, .78, 0); const c = cap(.1, .5, pant); c.position.y = -.38; l.add(c); hip.add(l); return l; });
    const arms = [-1, 1].map((s) => { const a = new T.Group(); a.position.set(s * .36, 1.32, 0); const c = cap(.08, .42, cols[ti]); c.position.y = -.3; a.add(c); const h = new T.Mesh(new T.SphereGeometry(.08, 10, 8), skin); h.position.y = -.6; a.add(h); hip.add(a); return a; });
    const face = new T.Sprite(new T.SpriteMaterial({ map: tex(faceCanvas(m.name, t.bar || '#888', imgs[ii++])) }));
    face.scale.set(.62, .62, 1); face.position.y = 1.86; hip.add(face);
    // sitio final: dos bloques, uno por equipo, frente a la pantalla
    const n = t.members.length, cols2 = Math.min(4, n), row = Math.floor(k / cols2), colI = k % cols2;
    const side = teams.length === 1 ? 0 : (ti / (teams.length - 1) - .5) * 2;
    const tx = side * 4.6 + (colI - (cols2 - 1) / 2) * 1.25, tz = 1.2 + row * 1.4;
    const fromL = ti % 2 === 0;
    root.position.set(fromL ? -16 : 16, 0, tz); scene.add(root);
    people.push({ root, hip, legs, arms, tx, tz, k, sx: root.position.x, delay: k * .22 + ti * .1, ph: Math.random() * 6, style: (k + ti) % 3 });
  }));
  // carteles de equipo
  const labels = teams.map((t, ti) => { const el = document.createElement('div'); el.className = 'bd-team'; el.style.setProperty('--c', t.bar || '#888');
    el.innerHTML = `<b>${esc(t.name)}</b>`; const side = teams.length === 1 ? 0 : (ti / (teams.length - 1) - .5) * 2; el.style.left = (50 + side * 24) + '%'; fx.appendChild(el); return el; });

  cam.position.set(0, 4.2, 15); cam.lookAt(0, 2, 0);
  const ease = (x) => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  let started = false, t3 = 0, doneF = false;

  const tick = () => {
    if (!X.isOpen()) return;
    if (!started && (vid.currentTime >= (window.__bodaCut ?? ENTER) || vid.ended)) {
      started = true; vid.classList.add('off'); g.canvas.style.opacity = '1';
      g.start((et, dt) => {
        t3 += dt * (window.__bodaSpeed || 1);
        const beat = vid.currentTime / BEAT, song = vid.currentTime >= CUT;
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
          } else if (!song) {   // aún no suena la canción: de pie, mirando la boda y meciéndose
            const s = Math.sin(t3 * 1.6 + p.ph);
            p.root.rotation.y = s * .1; p.hip.rotation.set(0, 0, s * .03); p.hip.position.y = 0;
            p.arms[0].rotation.set(0, 0, -.12); p.arms[1].rotation.set(0, 0, .12); p.legs[0].rotation.x = p.legs[1].rotation.x = 0;
          } else {       // reggaetón: rebote de dembow, perreo con las manos en las rodillas y meneo de cadera
            const b = beat * Math.PI, s2 = Math.sin(b * 2), s = Math.sin(b), bounce = Math.abs(s2);
            p.root.position.x = p.tx + Math.sin(b * .5 + p.ph) * .18;
            if (p.style === 0) {          // perreo: inclinado hacia delante, cadera arriba y abajo a doble tiempo
              p.root.rotation.y = (p.k % 2 ? Math.PI * .85 : Math.PI * .15) - Math.PI / 2 + Math.PI / 2;
              p.hip.rotation.x = .55; p.hip.position.y = -.12 + bounce * .12; p.hip.rotation.z = s * .08;
              p.arms[0].rotation.set(-.9, 0, .25); p.arms[1].rotation.set(-.9, 0, -.25);
              p.legs[0].rotation.x = p.legs[1].rotation.x = -.45 + bounce * .15;
            } else if (p.style === 1) {   // dembow: rebote de rodillas, brazo arriba marcando, giro de hombros
              p.root.rotation.y = s * .35;
              p.hip.rotation.x = .12; p.hip.position.y = bounce * .1 - .05; p.hip.rotation.z = Math.sin(b) * .14;
              p.arms[0].rotation.set(-2.5 + bounce * .4, 0, 0); p.arms[1].rotation.set(-.6, 0, .9 + s * .3);
              p.legs[0].rotation.x = s > 0 ? .3 * bounce : 0; p.legs[1].rotation.x = s < 0 ? .3 * bounce : 0;
            } else {                      // meneo: cadera en círculos y manos en la cintura
              p.root.rotation.y = Math.sin(b * .25 + p.ph) * .6;
              p.hip.rotation.x = .2 + Math.cos(b * 2) * .1; p.hip.rotation.z = Math.sin(b * 2) * .2; p.hip.position.y = bounce * .07 - .04;
              p.arms[0].rotation.set(0, 0, -.9); p.arms[1].rotation.set(0, 0, .9);
              p.legs[0].rotation.x = Math.max(0, s2) * .35; p.legs[1].rotation.x = Math.max(0, -s2) * .35;
            }
          }
        });
        if (t3 > WALK + 1.5) labels.forEach((l) => l.classList.add('on'));
        if (!doneF && vid.currentTime > CUT + DANCE_DONE) { doneF = true; X.done(); }
      });
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  vid.addEventListener('ended', () => { if (!doneF) { doneF = true; X.done(); } later(X.close, 6000); });
}
