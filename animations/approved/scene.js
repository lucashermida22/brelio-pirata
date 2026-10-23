import { esc, rand, shuffle, faceInner, LANE_COLORS } from '@kit';
import { CLIPS, KINDS, catFor, clipKey } from './catalog.js';

// =====================================================================
//  APPROVED: cada jugador presenta su solicitud a Knuckles. El clip dice
//  el veredicto, un sello cae sobre la carta y esta vuela a su equipo.
// =====================================================================

// Orden de aparición: equipos intercalados por rondas, con el orden de cada ronda barajado
function makeQueue(teams) {
  const lists = teams.map((t, ti) => shuffle(t.members).map((m) => ({ m, ti })));
  const out = []; let last = -1;
  while (lists.some((l) => l.length)) {
    let idx = shuffle(lists.map((_, i) => i).filter((i) => lists[i].length));
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

const INK = `<svg class="ap-defs" width="0" height="0" aria-hidden="true"><defs>
  <filter id="apInk" x="-6%" y="-10%" width="112%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.55" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in" result="e"/>
    <feTurbulence type="turbulence" baseFrequency=".035" numOctaves="2" seed="3" result="w"/>
    <feDisplacementMap in="e" in2="w" scale="3.5" xChannelSelector="R" yChannelSelector="G"/>
  </filter></defs></svg>`;

export async function playApproved(ctx) {
  const { teams, win, stage: layer, later } = ctx;
  const n = teams.length;
  const queue = win ? [] : makeQueue(teams);
  if (!win) planClips(queue, n);
  const winClip = ['aprobado-1', 'aprobado-5'][rand(2)];
  const need = [...new Set(win ? [winClip] : queue.map((p) => p.clip))];

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.className = 'ap-root' + (win ? ' ap-win' : '');
  root.dataset.n = n; root.style.setProperty('--n', n);
  const total = win ? 1 : queue.length;
  root.innerHTML = `${INK}
    <div class="ap-head">
      <div class="ap-brand"><span>🗂️</span> Ministerio de Aprobaciones</div>
      <div class="ap-count"><span id="apCount">${win ? 'Expediente colectivo' : 'Preparando expedientes…'}</span><div class="ap-prog"><i id="apProg"></i></div></div>
    </div>
    <div class="ap-main">
      <div class="ap-slot" id="apSlot"></div>
      <div class="ap-tvwrap">
        <div class="ap-tv" id="apTv">
          <div class="ap-glass" id="apGlass"></div>
          <div class="ap-scan"></div>
          <div class="ap-tvtag"><i></i> KNUCKLES · CANAL 3</div>
          <div class="ap-cap" id="apCap"></div>
          <button class="ap-sound" id="apSound" type="button" hidden>🔇 toca para activar el sonido</button>
          <div class="ap-load" id="apLoad">Cargando clips…</div>
        </div>
      </div>
      <div class="ap-keys"><span><kbd>Clic</kbd><kbd>Espacio</kbd><kbd>→</kbd></span><em>saltar al veredicto</em></div>
    </div>
    <div class="ap-teams" id="apTeams">${win ? '' : teams.map((t, i) => {
      const c = catFor(n, i);
      return `<div class="ap-col" data-ti="${i}" style="--k:${c.color}"><div class="ap-ch"><span class="ap-cname">${esc(t.name)}</span><b class="ap-cc">0</b></div><div class="ap-chips"></div></div>`;
    }).join('')}</div>`;
  layer.appendChild(root);
  const $r = (s) => root.querySelector(s);
  const glass = $r('#apGlass'), cap = $r('#apCap'), slot = $r('#apSlot'), tv = $r('#apTv'), soundBtn = $r('#apSound'), loadEl = $r('#apLoad');
  const countEl = $r('#apCount'), prog = $r('#apProg');
  const cols = [...root.querySelectorAll('.ap-col')];

  let stampAt = 0, state = 'load', pending = null, raf = 0, audioCtx = null, soundOff = false, curVid = null, curAnim = null, cardWrap = null;
  const blobs = [], vids = {}, anims = new Set();

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
    if (!['enter', 'play', 'stamp', 'fly'].includes(state)) return;   // en la carga y el final Espacio sigue cerrando, como siempre
    e.preventDefault(); e.stopImmediatePropagation(); skip();
  };
  addEventListener('keydown', onKey, true);
  const onResize = () => fitChips();
  addEventListener('resize', onResize);
  ctx.onClosing(() => stopVideos(true));
  ctx.onClose(() => {
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

  // golpe seco con WebAudio (sin recursos)
  function thud() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .22);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.55, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + .28);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + .3);
    } catch (e) { /* sin audio */ }
  }
  function shake() { root.classList.remove('ap-shake'); void root.offsetWidth; root.classList.add('ap-shake'); }

  // tamaño de las fichas de los equipos según el hueco disponible
  function fitChips() {
    if (win || !cols.length || state === 'closed') return;
    const M = Math.max(...teams.map((t) => t.members.length));
    const body = cols[0].querySelector('.ap-chips'), w = body.clientWidth - 12, h = body.clientHeight - 10; if (!w || !h) return;
    const gap = 6, final = root.classList.contains('ap-final');
    let s = final ? 132 : 84;
    for (; s > 24; s -= 2) {
      const nameH = s >= 38 ? 15 : 0, c = Math.max(1, Math.floor((w + gap) / (s + gap))), r = Math.ceil(M / c);
      if (r * (s + nameH + 4) + (r - 1) * gap <= h) break;
    }
    root.style.setProperty('--chip', s + 'px');
    root.classList.toggle('ap-noname', s < 38);
  }

  // ---------- carga de clips (fetch → blob: sin huecos al cambiar de clip) ----------
  const canPlay = (v) => new Promise((res) => {
    if (v.readyState >= 4) return res();
    const done = () => { v.removeEventListener('canplaythrough', done); v.removeEventListener('error', done); res(); };
    v.addEventListener('canplaythrough', done); v.addEventListener('error', done);
    setTimeout(done, 7000);
  });
  await Promise.all(need.map(async (id) => {
    let src = ctx.url(clipKey(id));
    try { const r = await fetch(src); if (r.ok) { const u = URL.createObjectURL(await r.blob()); blobs.push(u); src = u; } } catch (e) { /* se usa la URL directa */ }
    const v = document.createElement('video');
    v.className = 'ap-vid'; v.preload = 'auto'; v.playsInline = true; v.setAttribute('playsinline', ''); v.src = src;
    glass.appendChild(v); vids[id] = v; v.load();
  }));
  if (!alive()) return;
  fitChips();
  await canPlay(vids[win ? winClip : queue[0].clip]);
  if (!alive()) return;
  loadEl.hidden = true;
  fitChips();

  // ---------- reproducir un clip ----------
  function unmute() { soundOff = false; Object.values(vids).forEach((v) => { v.muted = false; }); soundBtn.hidden = true; if (curVid && curVid.paused === false && curVid.muted) curVid.muted = false; }
  soundBtn.addEventListener('click', (e) => { e.stopPropagation(); unmute(); });

  function playClip(id) {
    const v = vids[id], meta = CLIPS[id];
    Object.values(vids).forEach((o) => { o.classList.toggle('on', o === v); if (o !== v) o.pause(); });
    curVid = v; v.muted = soundOff; v.volume = 1;
    try { v.currentTime = 0; } catch (e) { /* nada */ }
    cap.textContent = meta.cap; cap.classList.add('on');
    const p = v.play();
    if (p && p.catch) p.catch(() => {   // sin permiso para sonar: seguimos sin sonido y avisamos
      if (!alive() || curVid !== v) return;
      v.muted = true; soundOff = true; soundBtn.hidden = false;
      v.play().catch(() => {});
    });
    state = 'play';
    cancelAnimationFrame(raf);
    const tick = () => {
      if (!alive() || state !== 'play' || curVid !== v) return;
      const left = (isFinite(v.duration) ? v.duration : meta.dur) - v.currentTime;
      if (v.ended || (v.currentTime > 0 && left <= .25)) return verdict();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    wait(meta.dur * 1000 + 1800, () => { if (state === 'play') verdict(); });   // por si el vídeo se atasca
  }

  // ---------- veredicto: sello sobre la carta ----------
  let cur = null;   // { card, clip, p, kindInfo, stamp, markKind }
  function verdict(skipped) {
    if (state !== 'play' && state !== 'enter') return;
    state = 'stamp'; stampAt = performance.now(); cancelAnimationFrame(raf);
    if (pending) { clearTimeout(pending.id); pending = null; }
    if (skipped && curVid) curVid.pause();
    const { card, stampEl } = cur;
    cap.classList.remove('on');
    card.classList.add('stamped');
    card.querySelector('.ap-status').textContent = 'Dictaminado';
    stampEl.getAnimations().forEach((a) => a.cancel());
    anim(stampEl, [
      { opacity: 0, transform: 'scale(3.4) rotate(calc(var(--rot) - 26deg))' },
      { opacity: 1, transform: 'scale(.9) rotate(var(--rot))', offset: .55 },
      { opacity: 1, transform: 'scale(1.05) rotate(var(--rot))', offset: .75 },
      { opacity: 1, transform: 'scale(1) rotate(var(--rot))' },
    ], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    ctx.later(() => { if (!alive()) return; shake(); thud(); card.classList.add('inked'); }, 200);
    wait(win ? 2300 : 1250, win ? finishWin : fly);
  }

  // ---------- la carta vuela a su equipo ----------
  function fly() {
    if (!alive()) return;
    state = 'fly';
    const { card, p } = cur, col = cols[p.ti], body = col.querySelector('.ap-chips'), clip = CLIPS[p.clip];
    const chip = document.createElement('div');
    chip.className = 'ap-chip'; chip.style.setProperty('--k', KINDS[clip.kind].color);
    chip.title = p.m.name + (p.m.role ? ' · ' + p.m.role : '');
    chip.innerHTML = `<div class="ap-cf">${faceInner(p.m.name)}<i class="ap-cb">${KINDS[clip.kind].mark}</i></div><div class="ap-cn">${esc(p.m.name)}</div>`;
    body.appendChild(chip);
    col.classList.add('hot');
    const photo = card.querySelector('.ap-photo'), a = photo.getBoundingClientRect(), c = card.getBoundingClientRect(), t = chip.querySelector('.ap-cf').getBoundingClientRect();
    const s = t.width / a.width, dx = (t.left + t.width / 2) - (a.left + a.width / 2), dy = (t.top + t.height / 2) - (a.top + a.height / 2);
    card.style.transformOrigin = `${a.left + a.width / 2 - c.left}px ${a.top + a.height / 2 - c.top}px`;
    const rot = (rand(2) ? 1 : -1) * (4 + rand(6));
    anim(card, [
      { transform: 'none', opacity: 1 },
      { transform: `translate(${dx * .12}px, ${Math.min(dy * .1, 0) - 26}px) scale(.94) rotate(${-rot}deg)`, opacity: 1, offset: .3 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${rot}deg)`, opacity: 1, offset: .88 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 680, easing: 'cubic-bezier(.55,0,.25,1)', fill: 'forwards' }).finished.then(() => {
      if (!alive()) return;
      chip.classList.add('landed'); col.classList.remove('hot');
      col.querySelector('.ap-cc').textContent = body.children.length;
      card.style.visibility = 'hidden';
      fitChips();
      next();
    }, () => {});
  }

  // ---------- siguiente jugador ----------
  let idx = -1;
  function memberCard(p) {
    const m = p.m, k = KINDS[CLIPS[p.clip].kind];
    return `<div class="ap-tab">Solicitud nº <b>${pad(idx + 1)}</b></div>
      <div class="ap-photo">${faceInner(m.name)}</div>
      <div class="ap-info"><div class="ap-name">${esc(m.name)}</div>
        ${m.role ? `<span class="ap-role" style="background:${LANE_COLORS[m.role] || '#71717a'}">${esc(m.role)}</span>` : ''}
        <div class="ap-line">Asunto: pertenencia a un equipo</div>
        <div class="ap-line ap-st">Estado: <b class="ap-status">En revisión</b></div></div>
      <div class="ap-bar"></div>`;
  }
  function mountCard(inner, clip, stamp, color) {
    slot.innerHTML = '';
    cardWrap = document.createElement('div'); cardWrap.className = 'ap-cardwrap';
    const card = document.createElement('div'); card.className = 'ap-card';
    card.innerHTML = inner + `<div class="ap-stampbox"><div class="ap-stamp" style="--sc:${color};--rot:${(rand(2) ? 1 : -1) * (9 + rand(8))}deg"><span>${esc(stamp)}</span></div></div>`;
    cardWrap.appendChild(card); slot.appendChild(cardWrap);
    cur = { card, stampEl: card.querySelector('.ap-stamp'), clip };
    return card;
  }
  function next() {
    if (!alive()) return;
    idx++;
    if (idx >= queue.length) return finale();
    const p = queue[idx], clip = CLIPS[p.clip];
    state = 'enter';
    countEl.textContent = `Solicitud ${pad(idx + 1)} de ${pad(total)}`;
    prog.style.width = (idx / total * 100) + '%';
    mountCard(memberCard(p), p.clip, clip.stamp, KINDS[clip.kind].color);
    cur.p = p;
    anim(cardWrap, [{ opacity: 0, transform: 'translate(-70px, 24px) rotate(-7deg) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.9,.25,1.1)', fill: 'both' });
    wait(520, () => playClip(p.clip));
  }

  // ---------- final ----------
  function finale() {
    state = 'final';
    prog.style.width = '100%';
    countEl.textContent = `Resolución final · ${total} expedientes resueltos`;
    Object.values(vids).forEach((v) => v.classList.remove('on'));
    root.classList.add('ap-final');
    later(() => {
      fitChips();
      root.querySelectorAll('.ap-chip').forEach((c, i) => anim(c, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-8px) scale(1.08)' }, { transform: 'none' }], { duration: 420, delay: (i % 12) * 40, easing: 'ease-out' }));
    }, 650);
    later(() => { ctx.done(); }, 900);
    later(ctx.close, 900 + (ctx.A.hold || 4200));
  }

  // ---------- repetición del ganador: un solo expediente con todo el equipo ----------
  function startWin() {
    const t = teams[0], mem = t.members;
    const fs = Math.max(34, Math.min(76, Math.floor(Math.sqrt(300 * 330 / Math.max(1, mem.length)) * .62)));
    const inner = `<div class="ap-tab">Expediente colectivo</div>
      <div class="ap-teamname">${esc(t.name)}</div>
      <div class="ap-faces" style="--f:${fs}px">${mem.map((m) => `<div class="ap-wf"><div class="ap-wp">${faceInner(m.name)}</div><span>${esc(m.name)}</span></div>`).join('')}</div>
      <div class="ap-info"><div class="ap-line ap-st">Estado: <b class="ap-status">En revisión</b></div></div><div class="ap-bar"></div>`;
    state = 'enter';
    mountCard(inner, winClip, 'APROBADOS', KINDS.ok.color);
    cur.p = null;
    anim(cardWrap, [{ opacity: 0, transform: 'translate(-70px, 24px) rotate(-7deg) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.9,.25,1.1)', fill: 'both' });
    wait(600, () => playClip(winClip));
  }
  function finishWin() {
    state = 'final';
    prog.style.width = '100%';
    ctx.done();
    later(ctx.close, ctx.A.hold || 4200);
  }

  // ---------- saltar ----------
  function skip() {
    if (state === 'enter' || state === 'play') verdict(true);
    else if (state === 'stamp' && performance.now() - stampAt > 600) runPending();   // deja ver el sello un momento
  }
  const onClickSkip = (e) => {
    if (!['enter', 'play', 'stamp', 'fly'].includes(state)) return;   // en la carga o el final el clic cierra, como siempre
    e.stopPropagation();
    if (soundOff && state === 'play' && !soundBtn.hidden) { unmute(); return; }
    skip();
  };
  $r('.ap-main').addEventListener('click', (e) => { if (e.target.closest('.ap-tv, .ap-card, .ap-cardwrap')) onClickSkip(e); });

  if (win) startWin(); else next();
}
