// Flujo común de las animaciones «de DOM» (kawaii, cine, bruh, reggaetón, JoJo…):
// la foto sube, los equipos se colocan a los lados del VS, las caras se revelan una a una
// y al terminar se recolocan en una forma. Cada animación lo configura con `cfg`.
import { $, rand, esc } from '../util.js';
import { vs } from './state.js';
import { photoFor, faceInner, EMOJIS } from '../photos.js';
import { LANE_COLORS } from '../teams.js';
import { state } from '../state.js';

const SCR = '!<>-_\\/[]{}=+*^?#01ZXK';
const scramble = (s) => [...s].map((c) => (c === ' ' ? ' ' : SCR[rand(SCR.length)])).join('');
let randFace = () => '';

export function layoutArena(teams, key){
  const arena = $('#vsArena');
  const vw = innerWidth, vh = innerHeight, narrow = vw <= 640;
  const n = teams.length, per = Math.max(...teams.map(t => t.members.length));
  const vsw = narrow ? 52 : Math.max(52, Math.min(96, vw * .075));
  const gap = narrow ? 10 : 14;
  const stands = key === 'jojo', ST = stands ? (narrow ? .9 : 1.45) : 0;   // altura del Stand respecto a la carta
  const maxCols = stands && !narrow ? per : narrow ? 4 : Math.max(1, Math.ceil(Math.sqrt(per * (n <= 2 ? 1.3 : .8))));
  const cols = Math.ceil(per / Math.ceil(per / maxCols));
  const rows = Math.ceil(per / cols);
  let availW, availH;
  if (narrow){ availW = vw - 24 - 24; availH = (vh * .62 - (n-1)*(vsw+gap*2)) / n - 40; }
  else { availW = (vw * .94 - (n-1)*(vsw + gap*2)) / n - 24; availH = vh * .58 - 44; }
  const cg = key === 'jojo' && !narrow ? 26 : 10, nameH = teams.some(t => t.members.some(m => m.role)) ? 54 : 30;
  if (stands) availH = vh * .6 - 50;
  let card = Math.min(140, (availW - (cols-1)*cg) / cols, ((availH - (rows-1)*cg) / rows - nameH - (stands ? 6 : 0)) / (1 + ST));
  card = Math.max(narrow ? 46 : 54, Math.floor(card));
  arena.style.setProperty('--gap', gap + 'px');
  arena.style.setProperty('--vsw', vsw + 'px');
  arena.style.setProperty('--card', card + 'px');
  arena.style.setProperty('--cols', cols);
  arena.style.setProperty('--standH', Math.floor(card * ST) + 'px');
  arena.style.setProperty('--cgap', cg + 'px');
  arena.style.setProperty('--nfs', Math.max(11, Math.min(16, card * .15)) + 'px');
}

export function burst(el, chars){
  const r = el.getBoundingClientRect(), layer = $('#vsLayer');
  for (let k = 0; k < 6; k++){
    const s = document.createElement('span');
    s.className = 'vs-pop'; s.textContent = chars[k % chars.length];
    const a = (Math.PI * 2 * k) / 6 + Math.random() * .6, d = 40 + Math.random() * 30;
    s.style.left = (r.left + r.width/2 - 10) + 'px'; s.style.top = (r.top + r.height/2 - 10) + 'px';
    s.style.setProperty('--dx', Math.cos(a)*d + 'px'); s.style.setProperty('--dy', Math.sin(a)*d + 'px');
    layer.appendChild(s); setTimeout(() => s.remove(), 900);
  }
}

export function land(el, name, A){
  const face = el.querySelector('.vs-face');
  face.innerHTML = faceInner(name);
  el.classList.remove('spin'); el.classList.add('landed');
  if (A.pops.length) burst(face, A.pops);
}
export function punch(el){
  const arena = $('#vsArena'), r = el.getBoundingClientRect(), a = arena.getBoundingClientRect();
  arena.style.transformOrigin = `${r.left - a.left + r.width/2}px ${r.top - a.top + r.height/2 + arena.scrollTop}px`;
  arena.style.setProperty('--tilt', (rand(2) ? 1 : -1) * (3 + rand(5)) + 'deg');
  arena.classList.remove('punch'); void arena.offsetWidth; arena.classList.add('punch');
}

// Revelados genéricos de una carta (las animaciones pueden pasar el suyo como función)
export const REVEAL = {
  slot(el, name, A, ctx) {
    el.classList.add('spin');
    const face = el.querySelector('.vs-face');
    const iv = ctx.every(() => { face.innerHTML = randFace(); }, 70);
    ctx.later(() => { clearInterval(iv); land(el, name, A); }, 480);
  },
  spot(el, name, A, ctx) { el.classList.add('spin'); ctx.later(() => land(el, name, A), 650); },
  glitch(el, name, A, ctx) {
    el.classList.add('spin');
    const nm = el.querySelector('.vs-nm');
    const iv = ctx.every(() => { nm.textContent = scramble(name); }, 45);
    ctx.later(() => { clearInterval(iv); nm.textContent = name; land(el, name, A); }, A.beat * .8);
  },
  drop(el, name, A, ctx) { el.classList.add('spin'); ctx.later(() => land(el, name, A), A.beat * .6); },
};

// Flujo común. cfg: {
//   reveal: 'slot'|'spot'|'drop'|fn(el, name, A, ctx), shape: 'heart'|'poster'|'pile'|'ring'|'lineup', p3d: bool,
//   fx(ctx): html del fondo, fxStart(ctx, fx): función que lo para (cine),
//   start(ctx), onUp(), onArena(), shakeAt: ms, onShake(), cardExtra(m, ti, k): html, teamDelay(i): ms,
//   finale(ctx, end): ms extra, onDone(), holdExtra: ms de más antes de cerrar }
export function play(ctx, cfg = {}) {
  const { A, teams, win, key, stage: layer, arena, fx, later } = ctx;
  fx.innerHTML = cfg.fx ? cfg.fx(ctx) : '';
  if (cfg.p3d) layer.classList.add('p3d');
  if (cfg.fxStart) {
    const t0 = performance.now();
    const stop = cfg.fxStart(ctx, fx); if (stop) ctx.setStop(stop);
    // montar el fondo (p. ej. la Tierra 3D) bloquea un momento; los temporizadores empiezan después,
    // así que la canción retrocede ese rato para seguir cuadrada con ellos
    const lag = (performance.now() - t0) / 1000;
    if (lag > .05 && ctx.song && !ctx.song.paused) { try { ctx.song.currentTime = Math.max(0, ctx.song.currentTime - lag); } catch (e) { /* nada */ } }
  }
  cfg.start && cfg.start(ctx);

  const pool = [...new Set([...(state.pool || []), ...teams.flatMap((t) => t.members.map((m) => photoFor(m.name)))])].filter(Boolean);
  randFace = () => (pool.length && Math.random() < .75 ? `<img src="${pool[rand(pool.length)]}" alt="">` : `<span class="emo">${EMOJIS[rand(EMOJIS.length)]}</span>`);
  const reveal = typeof cfg.reveal === 'function' ? cfg.reveal : REVEAL[cfg.reveal];

  // 1) la foto sube y se queda arriba
  later(() => { layer.classList.remove('intro'); layer.classList.add('up'); cfg.onUp && cfg.onUp(); }, A.upAt);

  // 2) equipos a los lados del VS
  later(() => {
    layoutArena(teams, key);
    arena.innerHTML = teams.map((t, i) => `${i ? '<div class="vs-badge"><span>VS</span></div>' : ''}
      <div class="vs-team ${i % 2 ? 'from-r' : 'from-l'}" style="animation-delay:${cfg.teamDelay ? cfg.teamDelay(i) : i * 90}ms;--tc:${t.bar}">
        <div class="vs-team-name"><i style="background:${t.bar}"></i><span>${esc(t.name)}</span></div>
        <div class="vs-grid">${t.members.map((m, k) => `<div class="vs-card">${cfg.cardExtra ? cfg.cardExtra(m, i, k) : ''}<div class="vs-face">${faceInner(m.name)}</div><div class="vs-nm">${esc(m.name)}</div>${m.role ? `<div class="vs-lane" style="--lc:${LANE_COLORS[m.role]}">${m.role}</div>` : ''}</div>`).join('')}</div>
      </div>`).join('');
    cfg.onArena && cfg.onArena();
    later(() => { layer.classList.add('shake'); cfg.onShake && cfg.onShake(); }, cfg.shakeAt ?? 260);

    // 3) revelado de caras, alternando equipos
    const cols = [...arena.querySelectorAll('.vs-team')].map((t) => [...t.querySelectorAll('.vs-card')]);
    const order = [];
    const maxLen = Math.max(...cols.map((c) => c.length));
    for (let r = 0; r < maxLen; r++) cols.forEach((c, ti) => { if (c[r]) order.push({ el: c[r], name: teams[ti].members[r].name }); });
    const step = A.beat ? (order.length > 10 ? A.beat / 2 : A.beat) : Math.max(A.step[0], Math.min(A.step[1], 2600 / order.length));
    order.forEach(({ el, name }, k) => later(() => reveal(el, name, A, ctx), A.cardsAt + k * step));
    let end = A.cardsAt + order.length * step + 700;
    if (cfg.finale) end += cfg.finale(ctx, end);
    later(() => {
      layer.classList.remove('shake'); void layer.offsetWidth;
      ctx.done();
      endShape(cfg.shape, later);
      cfg.onDone && cfg.onDone();
      if (win && A.pops.length) {
        const cards = [...arena.querySelectorAll('.vs-face')];
        ctx.every(() => burst(cards[rand(cards.length)], A.pops), 280);
      }
    }, end);
    later(ctx.close, end + (A.hold || 3200) + (cfg.holdExtra ? cfg.holdExtra(ctx) : 0));
  }, A.arenaAt);
}

export const dom = { play, REVEAL, land, punch, burst, layoutArena, endShape };

export function endShape(kind, later){
  if (!kind) return;
  const p3d = $('#vsLayer').classList.contains('p3d');
  $('#vsArena').querySelectorAll('.vs-team').forEach((team, ti) => {
    const cards = [...team.querySelectorAll('.vs-card')], N = cards.length; if (!N) return;
    // medidas de maquetación (no les afectan las transformaciones 3D)
    const W = team.offsetWidth, H = team.offsetHeight, nm = team.querySelector('.vs-team-name');
    const top = nm.offsetTop + nm.offsetHeight + 6, cx = W / 2, cy = top + (H - top) / 2;
    const cw = cards[0].offsetWidth, chh = cards[0].offsetHeight;
    const lc = c => [c.offsetLeft + c.offsetWidth / 2, c.offsetTop + c.offsetHeight / 2];
    const rx = Math.max(cw * .3, W / 2 - cw * .42), ry = Math.max(chh * .2, (H - top) / 2 - chh * .36);
    const bg = document.createElement('div'); bg.className = 'shape-bg ' + kind;
    bg.style.cssText = `left:${cx}px;top:${cy}px;width:${rx * 2 + cw}px;height:${ry * 2 + chh}px`;
    team.prepend(bg); team.classList.add('shaped', 'shape-' + kind);
    let pts = [];
    if (kind === 'heart'){
      pts = cards.map((_, i) => {
        const t = N === 1 ? Math.PI : (i / N) * Math.PI * 2 + Math.PI / N;
        const x = 16 * Math.sin(t) ** 3, y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        return [cx + x / 16 * rx * 1.08, cy + (y + 3) / 14 * ry, Math.sin(x) * 4, .74, null, p3d ? `translateZ(${(Math.cos(t) * 50).toFixed(0)}px) rotateY(${(-x / 16 * 28).toFixed(1)}deg)` : ''];
      });
    } else if (kind === 'poster'){
      const k = Math.max(.7, Math.min(1.5, (H - top) * .78 / chh, W * .96 / (cw * (1 + (N - 1) * .62))));
      const sp = N > 1 ? Math.min(cw * k * .74, (W - cw * k) / (N - 1)) : 0;
      pts = cards.map((_, i) => { const d = i - (N - 1) / 2, a = Math.abs(d); return [cx + d * sp, cy + a * a * chh * k * .035, d * 3.5, k * (1.06 - a * .08), 20 - Math.round(a * 2), p3d ? `translateZ(${-a * 70}px) rotateY(${-d * 16}deg)` : '']; });
    } else if (kind === 'lineup'){
      // cada uno con su Stand en su columna: solo escalonado vertical, sin moverse de lado (nunca se pisan)
      pts = cards.map((card, i) => { const [x, y] = lc(card), d = i - (N - 1) / 2; return [x, y + Math.abs(d) * -6 + (i % 2 ? 4 : -4), 0, 1, 20 - Math.round(Math.abs(d) * 2), '']; });
    } else if (kind === 'pose'){
      const sp = N > 1 ? Math.min(cw * .95, (W * 1.12 - cw * .8) / (N - 1)) : 0;
      pts = cards.map((_, i) => { const d = i - (N - 1) / 2, a = Math.abs(d), sg = d < 0 ? -1 : 1; return [cx + d * sp, cy - a * chh * .16 + chh * .08 + (i % 2 ? chh * .05 : -chh * .05), sg * (5 + a * 4) * (i % 2 ? 1 : -.6), 1.1 - a * .09, 20 - Math.round(a * 2), '']; });
    } else if (kind === 'pile'){
      pts = cards.map((_, i) => [cx + (Math.random() - .5) * cw * .6, cy + (Math.random() - .5) * chh * .35, (Math.random() - .5) * 50, .92, rand(20), p3d ? `translateZ(${i * 8}px) rotateX(${12 + rand(16)}deg)` : '']);
    } else if (kind === 'ring'){
      const R3 = Math.max(cw * .9, Math.min(W * .48, (N * cw * 1.15) / (2 * Math.PI)));
      cards.forEach((card, i) => {
        const [x, y] = lc(card);
        card.style.setProperty('--tx', cx - x + 'px'); card.style.setProperty('--ty', cy - y + 'px');
        card.style.setProperty('--a', (i / N) * 360 - 90 + 'deg');
        card.style.setProperty('--rx', (N === 1 ? 0 : rx) + 'px'); card.style.setProperty('--ry', (N === 1 ? 0 : ry) + 'px');
        card.style.setProperty('--r3', (N === 1 ? 0 : R3) + 'px');
        card.style.setProperty('--sc', Math.min(innerWidth <= 640 ? .78 : .92, (Math.PI * (rx + ry)) / (N * cw * 1.05)));
      });
      team.classList.add('ring-on');
      later(() => team.classList.add('ring-spin'), 950);
      return;
    }
    cards.forEach((card, i) => {
      const [x0, y0] = lc(card), [x, y, rot, s, z, extra] = pts[i];
      card.style.zIndex = z ?? '';
      card.style.transform = `translate(${x - x0}px, ${y - y0}px) ${extra || ''} rotate(${rot}deg) scale(${s})`;
    });
  });
}
