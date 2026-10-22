// La pantalla principal: lista de jugadores, reparto, agenda de equipos y botón «Ganador».
import { $, $$, esc, eur, toast, ls } from './util.js';
import { state } from './state.js';
import { ARROW } from './data.js';
import { avatarHTML } from './photos.js';
import { teamCount, makeTeams, assignLanes, LANE_COLORS } from './teams.js';
import * as api from './api.js';
import { openPicker, initPicker, refreshLibrary } from './picker.js';
import { play, isOpen, pickAnim, prefetch, animIds, animLabel, winMessage } from './versus/runtime.js';

let lastAnim = null;

// ---- lista de jugadores ----
export function render() {
  $('#people').innerHTML = state.players.map((p, i) => `
    <li class="prow">
      <button class="av-btn" type="button" data-pick="${esc(p.id)}" title="Elegir foto de ${esc(p.name)}">${avatarHTML(p.name)}</button>
      <span class="nm">${esc(p.name)}</span>
      <span class="id">#PRD-${String(i + 1).padStart(5, '0')}</span>
      <button class="x" data-id="${esc(p.id)}" aria-label="Quitar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </li>`).join('');
  $('#empty').style.display = state.players.length ? 'none' : 'block';
  $('#chipCount').textContent = state.players.length;
  updateHint();
}

function updateHint() {
  const n = state.players.length;
  let msg = '';
  if (n < 2) msg = 'Necesitas al menos 2 pacientes. Esto no es terapia individual.';
  else {
    const t = teamCount($('#num').value);
    if (t > n) msg = `Hay más equipos (${t}) que pacientes (${n}). Alguien va a jugar solo.`;
    else {
      const min = Math.floor(n / t), max = Math.ceil(n / t);
      msg = `${t} equipo${t > 1 ? 's' : ''} de ${min === max ? min : min + '–' + max} personas.`;
    }
  }
  $('#hint').textContent = msg;
}

async function addPlayers(names) {
  let added = 0;
  for (let n of names) {
    n = n.trim().slice(0, 40);
    if (!n) continue;
    if (state.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) continue;
    try { state.players.push(await api.addPlayer(n)); added++; }
    catch (e) { toast('No se pudo añadir a ' + n + ': ' + e.message); }
  }
  render();
  return added;
}

// ---- agenda ----
export function showTeams(teams) {
  state.lastTeams = teams;
  $('#chipTeams').textContent = teams.length;
  let h = 9, m = 30;
  const html = teams.map((tm, i) => {
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    m += 60; while (m >= 60) { m -= 60; h++; }
    return `
      <article class="team${tm.winner ? ' won' : ''}" style="animation-delay:${i * 60}ms">
        <div class="appt">
          <div class="time">${time}<small>50 min</small></div>
          <span class="bar" style="background:${tm.bar}"></span>
          <div>
            <div class="svc-line"><span class="svc">${esc(tm.name)}</span><span class="badge ${tm.status.c}">${tm.status.i}${tm.status.t}</span></div>
            <div class="svc-sub">${esc(tm.svc)}</div>
          </div>
          <svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
        </div>
        <ul class="members">
          ${tm.members.map((p, k) => `<li style="animation-delay:${i * 90 + k * 55 + 200}ms">${avatarHTML(p.name)}<span class="who"><span class="nm">${esc(p.name)}${ARROW}${p.role ? `<span class="lane" style="--lc:${LANE_COLORS[p.role]}">${p.role}</span>` : ''}</span><span class="dx"><b>Dx</b>${esc(p.dx)}</span></span></li>`).join('')}
        </ul>
        <div class="team-foot">
          <div class="left"><span class="sesion">Sesión</span>${tm.members.length} paciente${tm.members.length === 1 ? '' : 's'}${tm.winner ? '<span class="won-badge">🏆 Ganador</span>' : (teams.length > 1 ? `<button class="btn-sm win-btn" type="button" data-win="${i}">🏆 Ganador</button>` : '')}</div>
          <div class="money">${eur(tm.price * tm.members.length)}<small>A facturar</small></div>
        </div>
      </article>`;
  }).join('');
  $('#result').innerHTML = `<div class="teams">${html}</div>`;
}

// ---- generar ----
function generate() {
  if (state.players.length < 2) { toast('Faltan pacientes en la sala de espera'); return; }
  if (isOpen()) return;
  const teams = makeTeams($('#num').value);
  if (state.lolMode) assignLanes(teams);
  const id = pickAnim(state.animPref, lastAnim);
  lastAnim = id;
  teams.anim = id;
  $('#result').innerHTML = `<div class="placeholder"><b>Asignando equipos…</b>Los pacientes están entrando en consulta.</div>`;
  play(teams, () => {
    teams.matchP = api.saveMatch(id, teams);   // el reparto ya es definitivo (con los nombres que pusiera la animación)
    showTeams(teams);
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    prefetchNext();
  }, { anim: id });
}

// ---- ganador: repite la animación solo con el equipo ganador ----
function pickWinner(e) {
  const b = e.target.closest('.win-btn'); if (!b || !state.lastTeams || isOpen()) return;
  const teams = state.lastTeams, t = teams[+b.dataset.win];
  teams.forEach((x) => { x.winner = false; }); t.winner = true;
  const matchWin = teams.indexOf(t) === 0;
  const idx = teams.indexOf(t);
  if (teams.matchP) teams.matchP.then((m) => m && api.setWinner(m.id, idx));
  play([t], () => {
    showTeams(teams);
    toast(winMessage(teams.anim, { team: t, matchWin }) || `🏆 ${t.name} gana la pachanga`);
  }, { win: true, anim: teams.anim, matchWin });
}

// precarga la canción de lo siguiente que va a salir
function prefetchNext() {
  if (state.animPref !== 'random') return prefetch(state.animPref);
  animIds().forEach((id) => prefetch(id));
}

export function initUI() {
  // selector de animación (generado con lo que haya en /animations)
  const sel = $('#animSel');
  sel.innerHTML = '<option value="random">Aleatoria</option>' + animIds().map((k) => `<option value="${k}">${esc(animLabel(k))}</option>`).join('');
  state.animPref = ls.get('brelio-anim', 'random');
  sel.value = animIds().includes(state.animPref) ? state.animPref : 'random';
  if (sel.value !== state.animPref) state.animPref = sel.value;
  sel.addEventListener('change', () => { state.animPref = sel.value; ls.set('brelio-anim', state.animPref); prefetchNext(); });

  initPicker(() => { render(); if (state.lastTeams) showTeams(state.lastTeams); });

  $('#addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = $('#nameInput');
    if (!(await addPlayers([inp.value]))) toast(inp.value.trim() ? 'Ese paciente ya tiene ficha' : 'Escribe un nombre');
    inp.value = ''; inp.focus();
  });
  $('#people').addEventListener('click', async (e) => {
    const pk = e.target.closest('.av-btn'); if (pk) { openPicker(pk.dataset.pick); return; }
    const b = e.target.closest('.x'); if (!b) return;
    try { await api.removePlayer(b.dataset.id); state.players = state.players.filter((p) => p.id !== b.dataset.id); render(); }
    catch (err) { toast('No se pudo quitar: ' + err.message); }
  });
  $('#toggleBulk').addEventListener('click', () => { const b = $('#bulk'); b.hidden = !b.hidden; if (!b.hidden) $('#bulkText').focus(); });
  $('#focusAdd').addEventListener('click', () => $('#nameInput').focus());
  $('#bulkAdd').addEventListener('click', async () => {
    const n = await addPlayers($('#bulkText').value.split(/[\n,;]+/));
    $('#bulkText').value = ''; $('#bulk').hidden = true;
    toast(`Migración completada: ${n} paciente${n === 1 ? '' : 's'} importado${n === 1 ? '' : 's'}`);
  });
  $('#clearAll').addEventListener('click', async () => {
    if (!state.players.length) return;
    const b = $('#clearAll');
    if (!b._armed) { b._armed = true; toast('Pulsa otra vez para dar de alta a todos'); clearTimeout(b._t); b._t = setTimeout(() => { b._armed = false; }, 3000); return; }
    b._armed = false;
    const all = state.players; state.players = []; render();
    await Promise.all(all.map((p) => api.removePlayer(p.id).catch(() => {})));
    toast('Lista vaciada');
  });
  $$('.seg button').forEach((b) => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    $$('.seg button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    $('#num').value = state.mode === 'teams' ? 2 : 3;
    updateHint();
  }));
  const step = (d) => { const i = $('#num'); i.value = Math.min(20, Math.max(1, (parseInt(i.value) || 1) + d)); updateHint(); };
  $('#minus').addEventListener('click', () => step(-1));
  $('#plus').addEventListener('click', () => step(1));
  $('#num').addEventListener('input', updateHint);
  $('#go').addEventListener('click', generate);
  $('#reshuffle').addEventListener('click', generate);
  $('#result').addEventListener('click', pickWinner);

  // botón LOL
  state.lolMode = ls.get('brelio-lol') === '1';
  const paintLol = () => { $('#lol').setAttribute('aria-pressed', state.lolMode); $('#lolState').textContent = state.lolMode ? 'On' : 'Off'; };
  paintLol();
  $('#lol').addEventListener('click', () => {
    state.lolMode = !state.lolMode; paintLol();
    ls.set('brelio-lol', state.lolMode ? '1' : '0');
    toast(state.lolMode ? 'Modo LOL activado. Nadie quiere ir de support.' : 'Modo LOL desactivado');
  });

  $('#copy').addEventListener('click', async () => {
    if (!state.lastTeams) { toast('No hay nada que copiar'); return; }
    const txt = state.lastTeams.map((t) => `${t.winner ? '🏆 ' : ''}${t.name} (${t.svc}):\n` + t.members.map((m) => `  · ${m.role ? '[' + m.role + '] ' : ''}${m.name} — ${m.dx}`).join('\n')).join('\n\n');
    try { await navigator.clipboard.writeText(txt); toast('Copiado al portapapeles'); }
    catch (e) { toast('No se pudo copiar'); }
  });
  $('#demo').addEventListener('click', () => toast('Demo de 25 min no disponible. Prueba a pulsar botones.'));
  $('#login').addEventListener('click', () => toast('Contraseña olvidada desde 2019'));
  $('#howto').addEventListener('click', () => toast('Pones nombres, pulsas el botón azul. Ya está.'));

  render();
  refreshLibrary().catch(() => {});
  prefetchNext();
}
