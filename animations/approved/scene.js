import { esc, rand, shuffle, faceInner, LANE_COLORS } from '@kit';
import { CLIPS, KINDS, catFor, clipKey } from './catalog.js';
import { setupGL } from './gl.js';

// =====================================================================
//  APPROVED: el despacho de Knuckles. Cada solicitud sale de la bandeja de
//  entrada, Knuckles da su veredicto en el clip, el sello de madera cae
//  sobre el papel y el expediente vuela a la bandeja de su equipo.
//  Todo es DOM/CSS; los únicos recursos son los clips del vídeo.
// =====================================================================

// Orden de aparición: equipos intercalados por rondas, con el orden de cada ronda barajado
function makeQueue(teams) {
  const lists = teams.map((t, ti) => shuffle(t.members).map((m) => ({ m, ti })));
  const out = []; let last = -1;
  while (lists.some((l) => l.length)) {
    const idx = shuffle(lists.map((_, i) => i).filter((i) => lists[i].length));
    if (idx.length > 1 && idx[0] === last) idx.push(idx.shift());
    idx.forEach((i) => out.push(lists[i].pop()));
    last = idx[idx.length - 1];
  }
  return out;
}

// Clip de cada jugador: al azar dentro del grupo de su equipo, sin repetir el anterior y repartiendo el uso
function planClips(queue, n) {
  const used = {}; let prev = null;
  queue.forEach((p) => {
    const pool = catFor(n, p.ti).pool;
    let cand = pool.filter((c) => c !== prev); if (!cand.length) cand = pool;
    const min = Math.min(...cand.map((c) => used[c] || 0));
    cand = cand.filter((c) => (used[c] || 0) === min);
    p.clip = cand[rand(cand.length)]; used[p.clip] = (used[p.clip] || 0) + 1; prev = p.clip;
  });
}

// filtro de tinta: bordes irregulares y huecos, como un sello de goma de verdad
const INK = `<svg class="ap-defs" width="0" height="0" aria-hidden="true"><defs>
  <filter id="apInk" x="-6%" y="-10%" width="112%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.55" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in" result="e"/>
    <feTurbulence type="turbulence" baseFrequency=".035" numOctaves="2" seed="3" result="w"/>
    <feDisplacementMap in="e" in2="w" scale="3.5" xChannelSelector="R" yChannelSelector="G"/>
  </filter></defs></svg>`;

const EASE = 'cubic-bezier(.22,.8,.24,1)';

export async function playApproved(ctx) {
  const { teams, win, stage: layer, later } = ctx;
  const n = teams.length;
  const queue = win ? [] : makeQueue(teams);
  if (!win) planClips(queue, n);
  const winClip = ['aprobado-1', 'aprobado-5'][rand(2)];
  const need = [...new Set(win ? [winClip] : queue.map((p) => p.clip))];
  const total = win ? 1 : queue.length;

  // ---------- DOM: pared de madera, cuadro con el clip, escritorio con tapete verde ----------
  const root = document.createElement('div');
  root.className = 'ap-root' + (win ? ' ap-win' : '');
  root.dataset.n = n; root.style.setProperty('--n', n);
  root.innerHTML = `${INK}
    <div class="ap-wall" aria-hidden="true"><i class="ap-dip a"></i><i class="ap-dip b"></i><i class="ap-dip c"></i></div>
    <div class="ap-head">
      <div class="ap-plate"><b>Despacho del alcalde</b><span>Ministerio de Aprobaciones</span></div>
      <div class="ap-count"><span id="apCount">${win ? 'Expediente colectivo' : 'Abriendo la sesión…'}</span><div class="ap-prog"><i id="apProg"></i></div></div>
    </div>
    <div class="ap-stage">
      <div class="ap-frame" id="apTv">
        <div class="ap-glass" id="apGlass"></div>
        <div class="ap-cap" id="apCap"></div>
        <button class="ap-sound" id="apSound" type="button" hidden>🔇 toca para activar el sonido</button>
        <div class="ap-load" id="apLoad"><i></i>Ordenando expedientes…</div>
      </div>
      <div class="ap-keys"><kbd>Clic</kbd><kbd>Espacio</kbd><kbd>→</kbd><em>saltar al veredicto</em></div>
    </div>
    <div class="ap-desk">
      <div class="ap-blotter">
        <div class="ap-inbox" id="apInbox"><div class="ap-pile" id="apPile"></div><div class="ap-tag">Entrada <b id="apLeft">${total}</b></div></div>
        <div class="ap-slot" id="apSlot"></div>
        <div class="ap-trays" id="apTeams">${win ? '' : teams.map((t, i) => {
          const c = catFor(n, i);
          return `<div class="ap-tray" data-ti="${i}" style="--k:${c.color}"><div class="ap-docs"></div><div class="ap-label"><span class="ap-lname">${esc(t.name)}</span><b class="ap-lc">0</b></div></div>`;
        }).join('')}</div>
      </div>
    </div>
    <div class="ap-tool" id="apTool" aria-hidden="true"><i class="ap-knob"></i><i class="ap-neck"></i><i class="ap-base"></i><i class="ap-rub"></i></div>
    <div class="ap-impact" id="apImpact" aria-hidden="true"><i class="ap-lines"></i><b>DESTERRADO</b></div>`;
  layer.appendChild(root);
  // capa WebGL (despacho 3D, papelitos, easter egg); se carga en paralelo con los clips
  let GL = null;
  const glP = setupGL(ctx, root).then((g) => { GL = g; return g; }).catch(() => null);
  const pop = (el, kind, ink) => { if (!GL || !el) return; const r = el.getBoundingClientRect(); GL.burst(r.left + r.width / 2, r.top + r.height / 2, kind, ink); GL.bump(); };
  const $r = (s) => root.querySelector(s);
  const glass = $r('#apGlass'), cap = $r('#apCap'), slot = $r('#apSlot'), tv = $r('#apTv'), soundBtn = $r('#apSound'), loadEl = $r('#apLoad');
  const countEl = $r('#apCount'), prog = $r('#apProg'), tool = $r('#apTool'), impact = $r('#apImpact'), pile = $r('#apPile'), leftEl = $r('#apLeft');
  const trays = [...root.querySelectorAll('.ap-tray')];

  let state = 'load', stampAt = 0, pending = null, raf = 0, audioCtx = null, soundOff = false, curVid = null, cur = null, idx = -1, flying = 0;
  const blobs = [], vids = {}, anims = new Set(), blobOf = {};

  // montón de la bandeja de entrada (hasta 7 hojas visibles)
  function drawPile(left) {
    const k = Math.min(7, left);
    pile.innerHTML = Array.from({ length: k }, (_, i) => `<i style="--i:${i};--r:${((i * 37) % 7) - 3}deg"></i>`).join('');
    leftEl.textContent = left;
  }
  drawPile(total);

  // ---------- limpieza ----------
  function stopVideos(fade) {
    cancelAnimationFrame(raf);
    Object.values(vids).forEach((v) => {
      try {
        if (fade && !v.paused) { const v0 = v.volume, t0 = performance.now(); const iv = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 350); try { v.volume = v0 * (1 - k); } catch (e) { /* nada */ } if (k >= 1) { clearInterval(iv); v.pause(); } }, 30); }
        else v.pause();
      } catch (e) { /* nada */ }
    });
  }
  const onKey = (e) => {
    if (e.key !== ' ' && e.key !== 'ArrowRight') return;
    if (!['enter', 'play', 'stamp'].includes(state)) return;   // en la carga y el final Espacio sigue cerrando, como siempre
    e.preventDefault(); e.stopImmediatePropagation(); skip();
  };
  addEventListener('keydown', onKey, true);
  const onResize = () => fitDocs();
  addEventListener('resize', onResize);
  ctx.onClosing(() => stopVideos(true));
  ctx.onClose(() => {
    if (GL) GL.dispose();
    state = 'closed'; stopVideos(false);
    removeEventListener('keydown', onKey, true); removeEventListener('resize', onResize);
    anims.forEach((a) => { try { a.cancel(); } catch (e) { /* nada */ } });
    Object.values(vids).forEach((v) => { v.removeAttribute('src'); try { v.load(); } catch (e) { /* nada */ } v.remove(); });
    blobs.forEach((u) => URL.revokeObjectURL(u));
    if (audioCtx) { try { audioCtx.close(); } catch (e) { /* nada */ } }
    root.remove();
  });

  // ---------- utilidades ----------
  const wait = (ms, fn) => { const id = later(() => { pending = null; fn(); }, ms); pending = { id, fn }; };
  const runPending = () => { if (!pending) return; const p = pending; pending = null; clearTimeout(p.id); p.fn(); };
  const alive = () => ctx.isOpen() && state !== 'closed';
  const pad = (k) => String(k).padStart(2, '0');
  const anim = (el, kf, opt) => { const a = el.animate(kf, opt); anims.add(a); a.finished.then(() => anims.delete(a), () => anims.delete(a)); return a; };
  const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  // golpe seco del sello (WebAudio, sin recursos); `heavy` para el destierro
  function thud(heavy) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime, out = audioCtx.createGain(); out.gain.value = heavy ? .9 : .55; out.connect(audioCtx.destination);
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(heavy ? 120 : 160, t); o.frequency.exponentialRampToValueAtTime(heavy ? 28 : 45, t + (heavy ? .5 : .2));
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(1, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + (heavy ? .7 : .26));
      o.connect(g).connect(out); o.start(t); o.stop(t + .8);
      // chasquido de la goma contra el papel
      const len = Math.floor(audioCtx.sampleRate * (heavy ? .25 : .06)), buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, heavy ? 2 : 4);
      const s = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), gn = audioCtx.createGain();
      s.buffer = buf; f.type = 'lowpass'; f.frequency.value = heavy ? 1800 : 2600; gn.gain.value = heavy ? .8 : .35;
      s.connect(f).connect(gn).connect(out); s.start(t);
    } catch (e) { /* sin audio */ }
  }
  function shake(heavy) {
    root.classList.remove('ap-shake', 'ap-quake'); void root.offsetWidth;
    root.classList.add(heavy ? 'ap-quake' : 'ap-shake');
  }

  // tamaño de las hojas en las bandejas según el hueco disponible
  function fitDocs() {
    if (win || !trays.length || state === 'closed') return;
    const M = Math.max(...teams.map((t) => t.members.length));
    const body = trays[0].querySelector('.ap-docs'), w = body.clientWidth - 8, h = body.clientHeight - 6; if (!w || !h) return;
    const gap = 6;
    let s = root.classList.contains('ap-final') ? 120 : 78;
    for (; s > 26; s -= 2) {
      const dh = s * 1.24, c = Math.max(1, Math.floor((w + gap) / (s + gap))), r = Math.ceil(M / c);
      if (r * dh + (r - 1) * gap <= h) break;
    }
    root.style.setProperty('--doc', s + 'px');
    root.classList.toggle('ap-tiny', s < 44);
  }

  // ---------- carga de clips (fetch → blob: cambios de clip sin huecos) ----------
  const canPlay = (v) => new Promise((res) => {
    if (v.readyState >= 4) return res();
    const done = () => { v.removeEventListener('canplaythrough', done); v.removeEventListener('error', done); res(); };
    v.addEventListener('canplaythrough', done); v.addEventListener('error', done);
    setTimeout(done, 7000);
  });
  await Promise.all(need.map(async (id) => {
    let src = ctx.url(clipKey(id));
    try { const r = await fetch(src); if (r.ok) { const b = await r.blob(); blobOf[id] = b; const u = URL.createObjectURL(b); blobs.push(u); src = u; } } catch (e) { /* se usa la URL directa */ }
    const v = document.createElement('video');
    v.className = 'ap-vid'; v.preload = 'auto'; v.playsInline = true; v.setAttribute('playsinline', ''); v.src = src;
    glass.appendChild(v); vids[id] = v; v.load();
  }));
  if (!alive()) return;
  fitDocs();
  await canPlay(vids[win ? winClip : queue[0].clip]);
  if (!alive()) return;
  anim(loadEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).finished.then(() => { loadEl.hidden = true; }, () => {});
  fitDocs();

  // ---------- reproducir un clip (fundido entre clips: el anterior se queda hasta que el nuevo arranca) ----------
  function unmute() { soundOff = false; Object.values(vids).forEach((v) => { v.muted = false; }); soundBtn.hidden = true; }
  soundBtn.addEventListener('click', (e) => { e.stopPropagation(); unmute(); });

  function playClip(id) {
    const v = vids[id], meta = CLIPS[id];
    curVid = v; v.muted = soundOff; v.volume = 1;
    try { v.currentTime = .06; } catch (e) { /* nada */ }
    const show = () => {
      if (curVid !== v) return;
      v.classList.add('on');
      Object.values(vids).forEach((o) => { if (o !== v) { o.classList.remove('on'); later(() => { if (curVid !== o) o.pause(); }, 260); } });
    };
    v.addEventListener('playing', show, { once: true });
    later(show, 400);   // por si 'playing' no llega
    cap.classList.remove('on');
    later(() => { if (curVid === v && state === 'play') { cap.textContent = meta.cap; cap.classList.add('on'); } }, 120);
    const p = v.play();
    if (p && p.catch) p.catch(() => {   // sin permiso para sonar: seguimos sin sonido y avisamos
      if (!alive() || curVid !== v) return;
      v.muted = true; soundOff = true; soundBtn.hidden = false;
      v.play().catch(() => {});
    });
    state = 'play';
    cancelAnimationFrame(raf);
    // el sello de la ficha cae a la vez que Knuckles golpea con el suyo en el vídeo
    const hits = meta.hits || [];
    let hi = 0;
    const tick = () => {
      if (!alive() || state !== 'play' || curVid !== v) return;
      const t = v.currentTime, left = (isFinite(v.duration) ? v.duration : meta.dur) - t;
      while (hi < hits.length && t >= hits[hi] - PRESS_LEAD) {
        if (hi === hits.length - 1) { const h = hits[hi++]; return verdict(false, true, h); }
        miniHit(hi, hits[hi]); hi++;
      }
      if (v.ended || (t > 0 && left <= .3)) return verdict();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    wait(meta.dur * 1000 + 1800, () => { if (state === 'play') verdict(); });   // por si el vídeo se atasca
  }

  // golpes previos (p. ej. «no boomerangs, no hammers…»): sellito pequeño en cada golpe del vídeo
  const PRESS_LEAD = .26;   // lo que tarda el sello en bajar hasta el papel
  // ejecuta fn cuando el vídeo llegue al segundo `at` (o tras `ms` como red de seguridad)
  function atVideo(v, at, ms, fn) {
    const t0 = performance.now(); let doneF = false;
    const go = () => { if (doneF) return; doneF = true; fn(); };
    const chk = () => { if (doneF || !alive()) return; if (!v || v.paused || v.currentTime >= at || performance.now() - t0 > ms) return go(); requestAnimationFrame(chk); };
    requestAnimationFrame(chk);
  }
  function miniHit(k, hitAt) {
    const { card, kind } = cur, cr = card.getBoundingClientRect(), rr = root.getBoundingClientRect(), c = center(cr);
    const tw = tool.offsetWidth, th = tool.offsetHeight, jx = (rand(2) ? 1 : -1) * rand(16), jy = (rand(2) ? 1 : -1) * rand(18);
    const x = c.x - rr.left - tw / 2 + jx, y = c.y - rr.top - th * .9 + jy;
    tool.style.setProperty('--ink', KINDS[kind].ink);
    anim(tool, [
      { transform: k === 0 ? `translate(${x + 220}px, ${y - 280}px) rotate(20deg)` : `translate(${x}px, ${y - 60}px)`, opacity: k === 0 ? 0 : 1 },
      { transform: `translate(${x}px, ${y - 30}px)`, opacity: 1, offset: .55 },
      { transform: `translate(${x}px, ${y + 6}px) scale(1, .94)`, opacity: 1, offset: .82 },
      { transform: `translate(${x}px, ${y - 60}px)`, opacity: 1 },
    ], { duration: 380, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' });
    const miniPress = () => {
      if (!alive() || !cur || cur.card !== card) return;
      const ink = document.createElement('div'); ink.className = 'ap-stamp ap-mini';
      ink.style.cssText = `--ink:${KINDS[kind].ink};--rot:${(rand(2) ? 1 : -1) * (6 + rand(22))}deg;translate:${jx * 2.4}px ${jy * 3}px`;
      ink.innerHTML = `<span>${esc(CLIPS[cur.clip].stamp)}</span>`;
      card.querySelector('.ap-stampbox').appendChild(ink);
      anim(ink, [{ opacity: 0, transform: 'scale(1.2) rotate(var(--rot))' }, { opacity: .5, transform: 'scale(.92) rotate(var(--rot))' }], { duration: 120, fill: 'forwards' });
      thud(false); shake(false); pop(ink, 'stamp', KINDS[kind].ink);
    };
    atVideo(curVid, hitAt, 380 * .82 + 250, miniPress);
  }

  // ---------- veredicto: el sello de madera baja, aprieta y se va ----------
  // live = sincronizado con el golpe del vídeo: el clip sigue hasta su final antes de pasar al siguiente
  function verdict(skipped, live, hitAt) {
    if (state !== 'play' && state !== 'enter') return;
    state = 'stamp'; stampAt = performance.now(); cancelAnimationFrame(raf);
    if (pending) { clearTimeout(pending.id); pending = null; }
    const vv = curVid, rem = live && vv && isFinite(vv.duration) ? Math.max(0, vv.duration - vv.currentTime - .32) : 0;
    if (vv && !live) vv.pause();   // imagen congelada en el veredicto (y nunca se ven los fotogramas borrosos del final del clip)
    if (vv && live) later(() => { if (curVid === vv) vv.pause(); }, rem * 1000);
    const { card, stampEl, kind } = cur, ban = kind === 'ban';
    if (!live) cap.classList.remove('on');
    const cr = card.getBoundingClientRect(), rr = root.getBoundingClientRect(), c = center(cr);
    const tw = tool.offsetWidth, th = tool.offsetHeight;
    const x = c.x - rr.left - tw / 2, y = c.y - rr.top - th * .9;
    tool.style.setProperty('--ink', KINDS[kind].ink);
    const TD = ban ? 760 : 560, press = ban ? .52 : .46;
    anim(tool, [
      { transform: `translate(${x + 260}px, ${y - 320}px) rotate(24deg)`, opacity: 0 },
      { transform: `translate(${x + 30}px, ${y - 90}px) rotate(6deg)`, opacity: 1, offset: press * .55 },
      { transform: `translate(${x}px, ${y - (ban ? 70 : 34)}px) rotate(0deg)`, opacity: 1, offset: press * .82 },
      { transform: `translate(${x}px, ${y + 6}px) rotate(0deg) scale(1, .94)`, opacity: 1, offset: press },
      { transform: `translate(${x}px, ${y - 20}px) rotate(-2deg)`, opacity: 1, offset: press + .12 },
      { transform: `translate(${x - 200}px, ${y - 360}px) rotate(-20deg)`, opacity: 0 },
    ], { duration: TD, easing: 'cubic-bezier(.45,0,.3,1)' });
    const press0 = () => {   // momento del golpe: tinta en el papel, sacudida y sonido
      if (!alive()) return;
      card.classList.add('stamped');
      const st = card.querySelector('.ap-status'); if (st) st.textContent = 'Dictaminado';
      anim(stampEl, [
        { opacity: 0, transform: 'scale(1.18) rotate(var(--rot))' },
        { opacity: .95, transform: 'scale(.98) rotate(var(--rot))', offset: .45 },
        { opacity: .92, transform: 'scale(1) rotate(var(--rot))' },
      ], { duration: 220, easing: 'ease-out', fill: 'forwards' });
      anim(card, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(3px) scale(.985)' }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
      thud(ban); shake(ban); pop(stampEl, ban ? 'ban' : 'stamp', KINDS[kind].ink);
      if (ban) impactFrame(card);
    };
    if (live && hitAt != null) atVideo(vv, hitAt, TD * press + 250, press0); else later(press0, TD * press);
    const hold = Math.max(win ? 2400 : ban ? 1350 : 800, rem * 1000 - TD * press + 120);
    wait(TD * press + hold, () => { cap.classList.remove('on'); (win ? finishWin : advance)(); });
  }

  // ---------- impact frame del destierro: negativo, líneas de velocidad, latigazo ----------
  function impactFrame(card) {
    const c = center(card.getBoundingClientRect()), rr = root.getBoundingClientRect();
    impact.style.setProperty('--cx', ((c.x - rr.left) / rr.width * 100) + '%');
    impact.style.setProperty('--cy', ((c.y - rr.top) / rr.height * 100) + '%');
    impact.classList.remove('go'); void impact.offsetWidth; impact.classList.add('go');
    root.classList.remove('ap-neg'); void root.offsetWidth; root.classList.add('ap-neg');
    later(() => root.classList.remove('ap-neg'), 700);
  }

  // ---------- pasa al siguiente: el expediente vuela a su bandeja mientras entra el siguiente ----------
  function advance() {
    if (!alive() || state === 'alvaro') return;
    const done = cur;
    fly(done);
    next();
  }

  function fly(c) {
    const { card, p, kind } = c, tray = trays[p.ti], body = tray.querySelector('.ap-docs'), K = KINDS[kind];
    const doc = document.createElement('div');
    doc.className = 'ap-doc'; doc.style.setProperty('--ink', K.ink); doc.style.setProperty('--r', ((rand(2) ? 1 : -1) * (1 + rand(4))) + 'deg');
    doc.title = p.m.name + (p.m.role ? ' · ' + p.m.role : '');
    doc.innerHTML = `<div class="ap-dp">${faceInner(p.m.name)}</div><div class="ap-dn">${esc(p.m.name)}</div><i class="ap-dm">${K.mark}</i>`
      + (p.m.role ? `<span class="ap-drole" style="--lc:${LANE_COLORS[p.m.role] || '#71717a'}">${esc(p.m.role)}</span>` : '');
    body.appendChild(doc);
    tray.classList.add('hot');
    fitDocs();
    const a = card.getBoundingClientRect(), t = doc.getBoundingClientRect();
    const s = t.width / a.width, ca = center(a), ct = center(t), dx = ct.x - ca.x, dy = ct.y - ca.y;
    const ban = kind === 'ban', rot = (rand(2) ? 1 : -1) * (6 + rand(8));
    card.classList.add('leaving'); flying++;
    // el desterrado sale disparado fuera de la pantalla y vuelve a caer en su bandeja
    const kf = ban ? [
      { transform: 'none', opacity: 1 },
      { transform: `translate(${dx * .2 + 40}px, -60vh) scale(.8) rotate(${rot * 6}deg)`, opacity: 1, offset: .42 },
      { transform: `translate(${dx}px, ${dy - 40}px) scale(${s * 1.1}) rotate(${rot}deg)`, opacity: 1, offset: .86 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${rot * .3}deg)`, opacity: 1 },
    ] : [
      { transform: 'none', opacity: 1 },
      { transform: `translate(${dx * .35}px, ${dy * .2 - 50}px) scale(${(1 + s) / 2}) rotate(${-rot * .6}deg)`, opacity: 1, offset: .42 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${rot * .3}deg)`, opacity: 1 },
    ];
    anim(card, kf, { duration: ban ? 900 : 620, easing: 'cubic-bezier(.5,0,.25,1)', fill: 'forwards' }).finished.then(() => {
      if (!alive()) return;
      card.remove(); flying--;
      doc.classList.add('landed'); tray.classList.remove('hot');
      anim(tray, [{ transform: 'translateY(0)' }, { transform: 'translateY(4px)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
      tray.querySelector('.ap-lc').textContent = body.children.length;
      later(() => doc.classList.add('role-in'), 260);   // la posición del LoL aparece ya dentro del equipo
      if (state === 'final') fitDocs();
    }, () => {});
  }

  // ---------- una solicitud nueva sale de la bandeja de entrada ----------
  function paperHTML(p) {
    const m = p.m;
    return `<div class="ap-clip"></div>
      <div class="ap-ph">Ayuntamiento · Solicitud nº <b>${pad(idx + 1)}</b></div>
      <div class="ap-photo">${faceInner(m.name)}</div>
      <div class="ap-name">${esc(m.name)}</div>
      <div class="ap-field"><span>Asunto</span><em>Ingreso en un equipo</em></div>
      <div class="ap-field"><span>Estado</span><em class="ap-status">En revisión</em></div>
      <div class="ap-sign"><span>Firma del alcalde</span></div>`;
  }
  function mountPaper(inner, stamp, ink) {
    const card = document.createElement('div'); card.className = 'ap-paper';
    const rot = (rand(2) ? 1 : -1) * (8 + rand(9));
    card.style.setProperty('--tilt', ((rand(2) ? 1 : -1) * (1 + rand(3))) + 'deg');
    card.innerHTML = inner + `<div class="ap-stampbox"><div class="ap-stamp" style="--ink:${ink};--rot:${rot}deg"><span>${esc(stamp)}</span></div></div>`;
    slot.appendChild(card);
    return card;
  }
  function enterFromInbox(card, dur) {
    const from = pile.getBoundingClientRect(), to = card.getBoundingClientRect(), a = center(from), b = center(to);
    const s = Math.max(.35, from.width / to.width);
    anim(card, [
      { transform: `translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${s}) rotate(-14deg)`, opacity: .4 },
      { transform: `translate(${(a.x - b.x) * .3}px, ${(a.y - b.y) * .3 - 30}px) scale(${(1 + s) / 2}) rotate(-4deg)`, opacity: 1, offset: .55 },
      { transform: 'rotate(var(--tilt))', opacity: 1 },
    ], { duration: dur, easing: EASE, fill: 'both' });
  }
  function next() {
    if (!alive() || state === 'alvaro') return;
    idx++;
    if (idx >= queue.length) return later(finale, flying ? 700 : 200);
    const p = queue[idx], clip = CLIPS[p.clip], kind = clip.kind;
    state = 'enter';
    countEl.textContent = `Solicitud ${pad(idx + 1)} de ${pad(total)}`;
    prog.style.width = ((idx + 1) / total * 100) + '%';
    drawPile(total - idx - 1);
    const card = mountPaper(paperHTML(p), clip.stamp, KINDS[kind].ink);
    cur = { card, stampEl: card.querySelector('.ap-stamp'), p, kind, clip: p.clip };
    enterFromInbox(card, 560);
    wait(idx === 0 ? 420 : 200, () => playClip(p.clip));   // el clip arranca mientras el papel aún se está posando
  }

  // ---------- final: el cuadro se recoge y las bandejas ocupan el escritorio ----------
  function finale() {
    if (!alive() || state === 'alvaro') return;
    state = 'final';
    prog.style.width = '100%';
    countEl.textContent = `Sesión levantada · ${total} expedientes resueltos`;
    stopVideos(true);
    root.classList.add('ap-final');
    later(fitDocs, 80); later(fitDocs, 700);
    later(() => root.querySelectorAll('.ap-doc').forEach((d, i) => anim(d, [{ transform: 'rotate(var(--r)) translateY(0)' }, { transform: 'rotate(var(--r)) translateY(-8px) scale(1.06)' }, { transform: 'rotate(var(--r))' }], { duration: 420, delay: (i % 12) * 45, easing: 'ease-out' })), 700);
    later(() => { ctx.done(); }, 900);
    later(ctx.close, 900 + (ctx.A.hold || 4200));
  }

  // ---------- repetición del ganador: un solo expediente con todo el equipo ----------
  function startWin() {
    const t = teams[0], mem = t.members;
    const fs = Math.max(34, Math.min(72, Math.floor(Math.sqrt(300 * 300 / Math.max(1, mem.length)) * .6)));
    const inner = `<div class="ap-clip"></div>
      <div class="ap-ph">Ayuntamiento · Expediente colectivo</div>
      <div class="ap-name">${esc(t.name)}</div>
      <div class="ap-faces" style="--f:${fs}px">${mem.map((m) => `<div class="ap-wf"><div class="ap-wp">${faceInner(m.name)}</div><span>${esc(m.name)}</span>${m.role ? `<em style="--lc:${LANE_COLORS[m.role] || '#71717a'}">${esc(m.role)}</em>` : ''}</div>`).join('')}</div>
      <div class="ap-field"><span>Estado</span><em class="ap-status">En revisión</em></div>
      <div class="ap-sign"><span>Firma del alcalde</span></div>`;
    state = 'enter';
    drawPile(0);
    const card = mountPaper(inner, 'APROBADOS', KINDS.ok.ink);
    cur = { card, stampEl: card.querySelector('.ap-stamp'), p: null, kind: 'ok', clip: winClip };
    enterFromInbox(card, 620);
    wait(480, () => winStutter().catch(() => playClip(winClip)));
  }

  // ---------- victoria: «¡A-a-a-a-a-a-aprobado!» con un sellazo en cada «a» ----------
  const ONSET = { 'aprobado-1': .72, 'aprobado-5': .81 };   // dónde empieza la palabra en cada clip
  async function winStutter() {
    const v = vids[winClip], on = ONSET[winClip];
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    try { await audioCtx.resume(); } catch (e) { /* nada */ }
    const buf = await audioCtx.decodeAudioData(await blobOf[winClip].arrayBuffer());
    if (!alive()) return;
    const ac = audioCtx, out = ac.createGain(); out.gain.value = 1; out.connect(ac.destination);
    const play = (at, from, dur) => { const s = ac.createBufferSource(); s.buffer = buf; s.connect(out); s.start(at, from, dur); return s; };
    // vídeo en silencio: el audio va por WebAudio para poder tartamudear con precisión
    state = 'play'; curVid = v; v.muted = true; try { v.currentTime = 0; } catch (e) { /* nada */ }
    v.play().catch(() => {}); v.classList.add('on');
    Object.values(vids).forEach((o) => { if (o !== v) o.classList.remove('on'); });
    const t0 = ac.currentTime + .06;
    play(t0, 0, on);
    const HITS = [0, .2, .36, .5, .62, .72, .8, .87, .93];   // cada vez más rápido
    const SL = .1, startMs = (t0 - ac.currentTime + on) * 1000;
    const { card } = cur, cr = card.getBoundingClientRect(), rr = root.getBoundingClientRect(), c = center(cr);
    const tw = tool.offsetWidth, th = tool.offsetHeight, x = c.x - rr.left - tw / 2, y = c.y - rr.top - th * .9;
    tool.style.setProperty('--ink', KINDS.ok.ink);
    // el sello se coloca encima del papel justo antes de la primera «a»
    later(() => anim(tool, [{ transform: `translate(${x + 240}px, ${y - 300}px) rotate(22deg)`, opacity: 0 }, { transform: `translate(${x}px, ${y - 40}px)`, opacity: 1 }],
      { duration: 260, easing: EASE, fill: 'forwards' }), Math.max(0, startMs - 280));
    let said = '¡A';
    HITS.forEach((h, k) => {
      play(t0 + on + h, on, SL);
      later(() => {
        if (!alive()) return;
        try { v.pause(); v.currentTime = on; } catch (e) { /* nada */ }
        cap.textContent = said + '…'; cap.classList.add('on'); said += '-a';
        const jx = (rand(2) ? 1 : -1) * rand(14), jy = (rand(2) ? 1 : -1) * rand(16);
        anim(tool, [{ transform: `translate(${x + jx}px, ${y - 36}px)` }, { transform: `translate(${x + jx}px, ${y + 6 + jy}px) scale(1, .94)`, offset: .45 }, { transform: `translate(${x + jx}px, ${y - 30}px)` }],
          { duration: 110, easing: 'ease-in-out', fill: 'forwards' });
        later(() => {
          const ink = document.createElement('div'); ink.className = 'ap-stamp ap-mini';
          ink.style.cssText = `--ink:${KINDS.ok.ink};--rot:${(rand(2) ? 1 : -1) * (6 + rand(22))}deg;translate:${jx * 2.2}px ${jy * 3}px`;
          ink.innerHTML = '<span>APROBADO</span>';
          card.querySelector('.ap-stampbox').appendChild(ink);
          anim(ink, [{ opacity: 0, transform: 'scale(1.2) rotate(var(--rot))' }, { opacity: .55 + k * .03, transform: 'scale(.92) rotate(var(--rot))' }], { duration: 120, fill: 'forwards' });
          thud(false); shake(false); pop(ink, 'stamp', KINDS.ok.ink);
        }, 50);
      }, startMs + h * 1000);
    });
    // el último: «…aprobado!» entero, el sellazo grande y el vídeo sigue
    const endH = HITS[HITS.length - 1] + .1;
    play(t0 + on + endH, on, buf.duration - on);
    later(() => {
      if (!alive()) return;
      try { v.currentTime = on; v.play().catch(() => {}); } catch (e) { /* nada */ }
      later(() => { try { v.pause(); } catch (e) { /* nada */ } }, Math.max(0, (v.duration || buf.duration) - on - .35) * 1000);   // congelar antes del fundido del clip
      cap.textContent = said.replace(/-a$/, '') + '-aprobado!';
      anim(tool, [{ transform: `translate(${x}px, ${y - 80}px)` }, { transform: `translate(${x}px, ${y + 8}px) scale(1, .92)`, offset: .4 }, { transform: `translate(${x}px, ${y - 24}px)`, offset: .6 }, { transform: `translate(${x - 220}px, ${y - 360}px) rotate(-20deg)`, opacity: 0 }],
        { duration: 720, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' });
      later(() => {
        if (!alive()) return;
        state = 'stamp'; card.classList.add('stamped');
        const st = card.querySelector('.ap-status'); if (st) st.textContent = 'Dictaminado';
        anim(cur.stampEl, [{ opacity: 0, transform: 'scale(1.4) rotate(var(--rot))' }, { opacity: .96, transform: 'scale(.96) rotate(var(--rot))', offset: .5 }, { opacity: .94, transform: 'scale(1) rotate(var(--rot))' }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
        thud(true); shake(true); pop(cur.stampEl, 'gold'); pop(cur.stampEl, 'stamp', KINDS.ok.ink);
        root.classList.add('ap-gold'); later(() => root.classList.remove('ap-gold'), 900);
        wait(2600, finishWin);
      }, 290);
    }, startMs + endH * 1000);
  }
  function finishWin() {
    if (state === 'alvaro') return;
    state = 'final';
    prog.style.width = '100%';
    ctx.done();
    later(ctx.close, ctx.A.hold || 4200);
  }

  // ---------- saltar ----------
  function skip() {
    if (state === 'enter' || state === 'play') verdict(true);
    else if (state === 'stamp' && performance.now() - stampAt > 450) runPending();   // deja ver el sello un momento
  }
  const onClickSkip = (e) => {
    if (!['enter', 'play', 'stamp'].includes(state)) return;   // en la carga o el final el clic cierra, como siempre
    e.stopPropagation();
    if (soundOff && state === 'play' && !soundBtn.hidden) { unmute(); return; }
    skip();
  };
  root.addEventListener('click', (e) => { if (e.target.closest('.ap-frame, .ap-paper, .ap-slot')) onClickSkip(e); });


  // ---------- easter egg: escribir «alvaro» → Álvaro se va en moto hasta el fin del mundo ----------
  function alvSound() {
    // la canción de Fast & Furious mientras se aleja hacia el sol
    ctx.audio('furious/last_ride.mp3').then((song) => {
      if (!song || state !== 'alvaro' || !ctx.isOpen()) return;
      try { song.currentTime = 0; song.volume = 0; const p = song.play(); p && p.catch(() => {}); } catch (e) { return; }
      const t0 = performance.now(), iv = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 1400); try { song.volume = k; } catch (e) { /* nada */ } if (k >= 1 || !ctx.isOpen()) clearInterval(iv); }, 40);
    }).catch(() => {});
    // motor que se aleja (WebAudio, sin recursos)
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime, o = audioCtx.createOscillator(), o2 = audioCtx.createOscillator(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(118, t + 1.2); o.frequency.linearRampToValueAtTime(96, t + 7);
      o2.frequency.setValueAtTime(35, t); o2.frequency.linearRampToValueAtTime(48, t + 7);
      f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(160, t + 7);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.09, t + .5); g.gain.exponentialRampToValueAtTime(.0001, t + 7.2);
      o.connect(f); o2.connect(f); f.connect(g).connect(audioCtx.destination); o.start(t); o2.start(t); o.stop(t + 7.4); o2.stop(t + 7.4);
    } catch (e) { /* sin audio */ }
  }
  function alvaroEnd() {
    if (!alive() || state === 'alvaro') return;
    state = 'alvaro'; cancelAnimationFrame(raf);
    if (pending) { clearTimeout(pending.id); pending = null; }
    stopVideos(true); cap.classList.remove('on');
    if (GL) {   // versión 3D: la carretera al atardecer en WebGL
      root.classList.add('ap-alv3d');
      ctx.media('alvaro/alvaro.jpg').then((img) => { if (state === 'alvaro' && ctx.isOpen()) GL.alvaro(img); }).catch(() => GL.alvaro(null));
      const txt = document.createElement('div'); txt.className = 'ap-gana'; txt.innerHTML = '<b>Gana Álvaro</b>'; root.appendChild(txt);
      alvSound();
      later(() => { if (ctx.isOpen()) ctx.done(); }, 8200);
      later(() => { if (ctx.isOpen()) ctx.close(); }, 8200 + (ctx.A.hold || 4200));
      return;
    }
    const face = ctx.url('alvaro/alvaro.jpg');
    const ov = document.createElement('div'); ov.className = 'ap-alv';
    ov.innerHTML = `<div class="ap-sky"></div><div class="ap-sun"></div><div class="ap-hills b"></div><div class="ap-hills f"></div>
      <div class="ap-ground"></div><div class="ap-road"><i></i></div>
      <div class="ap-rider"><div class="ap-bob"><svg viewBox="0 0 220 150" aria-label="Álvaro en moto">
        <defs><clipPath id="apAlvFace"><circle cx="138" cy="34" r="22"/></clipPath></defs>
        <g class="ap-wh" style="transform-origin:50px 116px"><circle cx="50" cy="116" r="26" fill="none" stroke="#120a10" stroke-width="10"/><circle cx="50" cy="116" r="9" fill="#9aa0a8"/><path d="M50 92V140M26 116H74" stroke="#9aa0a8" stroke-width="3"/></g>
        <g class="ap-wh" style="transform-origin:174px 116px"><circle cx="174" cy="116" r="26" fill="none" stroke="#120a10" stroke-width="10"/><circle cx="174" cy="116" r="9" fill="#9aa0a8"/><path d="M174 92V140M150 116H198" stroke="#9aa0a8" stroke-width="3"/></g>
        <path d="M50 116 L92 84 L150 84 L174 116" fill="none" stroke="#2a1218" stroke-width="9" stroke-linejoin="round"/>
        <path d="M84 80 Q118 62 156 76 L150 92 L92 92 Z" fill="#b3121b"/>
        <path d="M150 78 L170 56 M164 54 L182 50" stroke="#2a1218" stroke-width="6" stroke-linecap="round"/>
        <path d="M60 100 L40 96" stroke="#6b6f78" stroke-width="6" stroke-linecap="round"/>
        <path d="M110 80 L124 104 L132 104" stroke="#23262e" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M104 82 Q112 50 132 48 L140 60 Q126 66 120 84 Z" fill="#5c1426"/>
        <path d="M130 54 L164 56" stroke="#5c1426" stroke-width="9" stroke-linecap="round"/>
        <circle cx="138" cy="34" r="24" fill="#5c1426"/>
        <image href="${face}" x="88.3" y="1.5" width="73.2" height="123.3" clip-path="url(#apAlvFace)" preserveAspectRatio="none"/>
        <circle cx="138" cy="34" r="22" fill="none" stroke="#ff7a1a" stroke-width="3"/>
      </svg></div><i class="ap-dust"></i></div>
      <div class="ap-fin">Gana Álvaro</div>`;
    root.appendChild(ov);
    alvSound();
    later(() => { if (ctx.isOpen()) ctx.done(); }, 7600);
    later(() => { if (ctx.isOpen()) ctx.close(); }, 7600 + (ctx.A.hold || 4200));
  }
  ctx.onType('alvaro', alvaroEnd);

  if (win) startWin(); else next();
}
