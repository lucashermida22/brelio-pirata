// «Alguien se quiere ir»: suena la canción desde el estribillo, pasan los momentos con los demás
// jugadores (fotos + partidos juntos) con subtítulos y al final: «¿Una partidita más?».
import { $, esc, toast, shuffle } from './util.js';
import { state } from './state.js';
import { photoFor, emojiFor } from './photos.js';
import { loadAudio } from './media.js';
import * as api from './api.js';

const SONG = 'despedida/cancion.mp3';
const START = 8;          // segundo del fichero recortado donde entra el estribillo (≈ 0:48 del original)
const SLIDE = 4.2;        // segundos por recuerdo

const face = (name, cls = '') => { const src = photoFor(name);
  return `<div class="bye-face ${cls}">${src ? `<img src="${esc(src)}" alt="" decoding="async">` : `<span>${emojiFor(name)}</span>`}</div>`; };

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

export async function playDespedida(me) {
  const others = shuffle(state.players.map((p) => p.name).filter((x) => x !== me)).slice(0, 8);
  const [song, stats] = await Promise.all([loadAudio(SONG, { timeout: 4000 }), memories(me)]);
  const L = document.createElement('div'); L.className = 'bye'; L.innerHTML = `
    <div class="bye-bg"></div><div class="bye-slides"></div>
    <div class="bye-me">${face(me, 'big')}<b>${esc(me)}</b></div>
    <div class="bye-sub"></div>
    <div class="bye-end"><h2>¿Una partidita más?</h2><p>Todos te estamos esperando, ${esc(me)}</p>
      <div class="bye-btns"><button class="bye-stay">Me quedo 💙</button><button class="bye-go">Me voy…</button></div></div>
    <button class="bye-skip">Saltar ⟶</button>`;
  document.body.appendChild(L);
  const slides = L.querySelector('.bye-slides'), sub = L.querySelector('.bye-sub'), timers = [];
  const later = (fn, s) => timers.push(setTimeout(fn, s * 1000));
  const say = (txt) => { sub.classList.remove('on'); later(() => { sub.textContent = txt; sub.classList.add('on'); }, .35); };
  let closed = false;
  const close = (msg) => {
    if (closed) return; closed = true; timers.forEach(clearTimeout); removeEventListener('keydown', onKey);
    if (song) { const v0 = song.volume, t0 = performance.now(); const iv = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 900); song.volume = v0 * (1 - k); if (k >= 1) { clearInterval(iv); song.pause(); } }, 40); }
    L.classList.add('out'); setTimeout(() => L.remove(), 700); if (msg) toast(msg);
  };
  const end = () => { timers.forEach(clearTimeout); L.classList.add('final'); say(''); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', onKey);
  L.querySelector('.bye-stay').onclick = () => close(`¡Eso es, ${me}! Una más 💙`);
  L.querySelector('.bye-go').onclick = () => close(`Te esperaremos, ${me} 🥲`);
  L.querySelector('.bye-skip').onclick = end;

  if (song) { song.loop = false; song.volume = 1; try { song.currentTime = START; } catch (e) { /* sin metadatos aún */ } song.play().catch(() => {}); }
  requestAnimationFrame(() => L.classList.add('in'));
  say(`${me} se quiere ir…`);
  later(() => say('Pero antes, mira esto'), 3.2);
  const lines = shuffle(LINES);
  others.forEach((f, i) => later(() => {
    const s = stats[f], el = document.createElement('div'); el.className = 'bye-slide' + (i % 2 ? ' r' : '');
    el.innerHTML = `${face(f)}<div class="bye-cap"><b>${esc(f)}</b><small>${s ? `${s.games} ${s.games === 1 ? 'partido' : 'partidos'} juntos${s.wins ? ` · ${s.wins} ${s.wins === 1 ? 'victoria' : 'victorias'}` : ''}` : 'siempre en tu equipo'}</small></div>`;
    slides.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
    later(() => { el.classList.add('off'); later(() => el.remove(), 1.2); }, SLIDE + .4);
    say(lines[i % lines.length](f));
  }, 6 + i * SLIDE));
  later(end, 6 + others.length * SLIDE + .6);
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
