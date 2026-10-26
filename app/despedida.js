// «Alguien se quiere ir»: suena la canción desde el estribillo, pasan los momentos con los demás
// jugadores (fotos + partidos juntos) con subtítulos y al final: «¿Una partidita más?».
import { $, esc, toast, shuffle } from './util.js';
import { state } from './state.js';
import { photoFor, emojiFor } from './photos.js';
import { urlOf } from './media.js';
import * as api from './api.js';

const VIDEO = 'despedida/video.mp4';   // videoclip recortado desde el 3:42 («si tú te vas…»), ~31 s
const SLIDE = 4;          // segundos por recuerdo
const T0 = 3.2;           // primer recuerdo (tras el título)

const TEARS = '<i class="tear a"></i><i class="tear b"></i><i class="tear c"></i><i class="tear d"></i>';
const face = (name, cls = '', cry = false) => { const src = photoFor(name);
  return `<div class="bye-face ${cls}${cry ? ' cry' : ''}">${src ? `<img src="${esc(src)}" alt="" decoding="async">` : `<span>${emojiFor(name)}</span>`}${cry ? TEARS : ''}</div>`; };

// partidos y victorias que han compartido equipo con quien se va
async function memories(me) {
  const ms = await api.listMatches().catch(() => []);
  const n = (s) => s.toLowerCase();
  const stats = {};
  for (const m of ms) (m.teams || []).forEach((t, ti) => {
    const names = (t.members || []).map((x) => x.name);
    if (!names.some((x) => n(x) === n(me))) return;
    names.forEach((x) => { if (n(x) === n(me)) return; const s = stats[x] ||= { games: 0, wins: 0 }; s.games++; if (m.winner === ti) s.wins++; });
  });
  return stats;
}

// frases propias (sin letra de la canción)
const LINES = [
  (f) => `${f} todavía se acuerda de aquel pase que le diste`,
  (f) => `Sin ti, ${f} no tiene a quién pasársela`,
  (f) => `${f} dice que contigo el campo se ve más grande`,
  (f) => `${f} te guardaba el sitio en el equipo`,
  (f) => `Mira la cara de ${f}… ¿de verdad te vas?`,
  (f) => `${f} ya está calentando para otra`,
];

// fuegos artificiales en un lienzo 2D (ligero): cohetes que suben y estallan en chispas de colores
function fireworks(L, ms) {
  const cv = document.createElement('canvas'); cv.className = 'bye-fw'; L.appendChild(cv);
  const g = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), P = [], R = [];
  const size = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }; size();
  const COL = ['#ff4d6d', '#ffd23f', '#3ff0ff', '#7dff6a', '#c46bff', '#ff9a3c', '#ffffff'];
  const launch = () => R.push({ x: (.15 + Math.random() * .7) * cv.width, y: cv.height, vy: -(9 + Math.random() * 5) * dpr, ty: (.15 + Math.random() * .35) * cv.height, c: COL[Math.floor(Math.random() * COL.length)] });
  const burst = (x, y, c) => { const n = 70 + Math.floor(Math.random() * 40); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (1.5 + Math.random() * 5) * dpr;
    P.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: Math.random() < .2 ? '#fff' : c }); } };
  const t0 = performance.now(); let last = t0, nextL = 0;
  const step = (now) => {
    if (!cv.isConnected) return;
    const dt = Math.min(2, (now - last) / 16.7); last = now;
    if (now - t0 < ms - 900 && now > nextL) { launch(); if (Math.random() < .5) launch(); nextL = now + 220 + Math.random() * 260; }
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'lighter';
    for (let i = R.length - 1; i >= 0; i--) { const r = R[i]; r.y += r.vy * dt; r.vy *= .985; g.fillStyle = r.c; g.beginPath(); g.arc(r.x, r.y, 2.4 * dpr, 0, 6.283); g.fill();
      if (r.y <= r.ty || r.vy > -2) { burst(r.x, r.y, r.c); R.splice(i, 1); } }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += .06 * dpr * dt; p.vx *= .985; p.vy *= .985; p.life -= .012 * dt;
      if (p.life <= 0) { P.splice(i, 1); continue; } g.globalAlpha = p.life; g.fillStyle = p.c; g.fillRect(p.x, p.y, 2.2 * dpr, 2.2 * dpr); }
    g.globalAlpha = 1;
    if (now - t0 < ms || P.length) requestAnimationFrame(step); else cv.remove();
  };
  requestAnimationFrame(step);
}

export async function playDespedida(me) {
  const all = shuffle(state.players.map((p) => p.name).filter((x) => x !== me)), others = all.slice(0, 6);
  const stats = await memories(me);
  const L = document.createElement('div'); L.className = 'bye'; L.innerHTML = `
    <video class="bye-vid" playsinline preload="auto"></video><div class="bye-bg"></div><div class="bye-bars"></div><div class="bye-slides"></div>
    <div class="bye-grain"></div><div class="bye-leak"></div>
    <div class="bye-title"><small>Lerelio presenta</small><b>${esc(me)} se quiere ir</b></div>
    <div class="bye-me">${face(me, 'big')}<b>${esc(me)}</b></div>
    <div class="bye-sub"></div>
    <div class="bye-end"><div class="bye-all">${all.map((f, i) => `<div class="bye-pal" style="--i:${i};--n:${all.length}">${face(f, '', true)}<span>${esc(f)}</span></div>`).join('')}</div>
      <h2>¿Una partidita más?</h2><p>Todos te estamos esperando, ${esc(me)}</p>
      <div class="bye-btns"><button class="bye-stay">Me quedo 💙</button><button class="bye-go">Me voy…</button></div></div>
    <button class="bye-skip">Saltar ⟶</button>`;
  document.body.appendChild(L);
  const slides = L.querySelector('.bye-slides'), sub = L.querySelector('.bye-sub'), timers = [];
  const later = (fn, s) => timers.push(setTimeout(fn, s * 1000));
  const say = (txt) => { sub.classList.remove('on'); later(() => { sub.textContent = txt; sub.classList.add('on'); }, .35); };
  let closed = false;
  const close = (msg) => {
    if (closed) return; closed = true; timers.forEach(clearTimeout); removeEventListener('keydown', onKey);
    { const v0 = vid.volume, t0 = performance.now(); const iv = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 900); vid.volume = v0 * (1 - k); if (k >= 1) { clearInterval(iv); vid.pause(); vid.removeAttribute('src'); vid.load(); } }, 40); }
    L.classList.add('out'); setTimeout(() => L.remove(), 700); if (msg) toast(msg);
  };
  const end = () => { timers.forEach(clearTimeout); L.classList.add('final'); say(''); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', onKey);
  L.querySelector('.bye-stay').onclick = () => {
    if (L.classList.contains('happy')) return;
    L.classList.add('happy'); L.querySelector('.bye-end h2').textContent = '¡Una más!';
    L.querySelector('.bye-end p').textContent = `${me} se queda 💙`;
    fireworks(L, 4200);
    later(() => close(`¡Eso es, ${me}! Una más 💙`), 4.6);
  };
  L.querySelector('.bye-go').onclick = () => close(`Te esperaremos, ${me} 🥲`);
  L.querySelector('.bye-skip').onclick = end;

  const vid = L.querySelector('.bye-vid'); vid.volume = 1; vid.src = urlOf(VIDEO);
  vid.addEventListener('ended', () => { if (!closed && !L.classList.contains('final')) end(); });
  await new Promise((r) => { if (vid.readyState >= 3) return r(); vid.addEventListener('canplay', r, { once: true }); setTimeout(r, 3000); });
  vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
  requestAnimationFrame(() => L.classList.add('in'));
  later(() => L.classList.add('titled'), .2); later(() => L.classList.add('untitled'), 2.6);
  const lines = shuffle(LINES);
  others.forEach((f, i) => later(() => {
    const s = stats[f], el = document.createElement('div'); el.className = 'bye-slide' + (i % 2 ? ' r' : '');
    el.innerHTML = `${face(f, '', true)}<div class="bye-cap"><b>${esc(f)}</b><small>${s ? `${s.games} ${s.games === 1 ? 'partido' : 'partidos'} juntos${s.wins ? ` · ${s.wins} ${s.wins === 1 ? 'victoria' : 'victorias'}` : ''}` : 'siempre en tu equipo'}</small></div>`;
    el.style.setProperty('--rot', ((i % 2 ? 1 : -1) * (3 + Math.random() * 4)).toFixed(1) + 'deg');
    slides.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
    later(() => { el.classList.add('off'); later(() => el.remove(), 1.2); }, SLIDE + .4);
    say(lines[i % lines.length](f));
  }, T0 + i * SLIDE));
  later(end, Math.max(T0 + others.length * SLIDE + .4, 12));
}

// selector «¿quién se quiere ir?»
export function askWhoLeaves() {
  if (!state.players.length) { toast('No hay nadie en la sala de espera'); return; }
  const M = document.createElement('div'); M.className = 'bye-pick';
  M.innerHTML = `<div class="bye-pick-card"><h3>¿Quién se quiere ir?</h3><div class="bye-pick-list">${state.players.map((p) =>
    `<button data-n="${esc(p.name)}">${face(p.name)}<span>${esc(p.name)}</span></button>`).join('')}</div><button class="bye-pick-x">Cancelar</button></div>`;
  document.body.appendChild(M);
  M.addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (b) { M.remove(); playDespedida(b.dataset.n); }
    else if (e.target === M || e.target.closest('.bye-pick-x')) M.remove();
  });
}
