// «Lerelio Estadísticas»: winrates, mejores y peores parejas, némesis… a partir del historial de partidos.
// Solo cuentan los partidos con ganador marcado (el botón 🏆 de cada equipo).
import { $, esc, toast } from './util.js';
import { avatarHTML } from './photos.js';
import { animLabel } from './versus/runtime.js';
import * as api from './api.js';

const MIN_PAIR = 2;   // partidos juntos mínimos para entrar en «mejor/peor combinación»
const pct = (w, g) => (g ? Math.round((w / g) * 100) : 0);
const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

export function computeStats(matches) {
  const P = {}, pairs = {}, vs = {}, anims = {};
  const pl = (n) => (P[n] ||= { name: n, games: 0, wins: 0, played: 0, form: [] });
  let decided = 0;
  for (const m of matches.slice().reverse()) {           // de más antiguo a más reciente (rachas)
    const teams = m.teams || [];
    anims[m.animation] = (anims[m.animation] || 0) + 1;
    teams.forEach((t) => (t.members || []).forEach((x) => { pl(x.name).played++; }));
    if (m.winner == null || !teams[m.winner]) continue;
    decided++;
    teams.forEach((t, ti) => {
      const won = ti === m.winner, names = (t.members || []).map((x) => x.name);
      names.forEach((n) => { const p = pl(n); p.games++; if (won) p.wins++; p.form.push(won ? 'W' : 'L'); });
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        const k = key(names[i], names[j]), s = (pairs[k] ||= { a: names[i] < names[j] ? names[i] : names[j], b: names[i] < names[j] ? names[j] : names[i], games: 0, wins: 0 });
        s.games++; if (won) s.wins++;
      }
      // contra quién: cada jugador frente a cada rival
      teams.forEach((o, oi) => { if (oi === ti) return; names.forEach((n) => (o.members || []).forEach((r) => {
        const v = ((vs[n] ||= {})[r.name] ||= { games: 0, wins: 0 }); v.games++; if (won) v.wins++; })); });
    });
  }
  const players = Object.values(P).map((p) => {
    let streak = 0; const f = p.form; for (let i = f.length - 1; i >= 0 && f[i] === f[f.length - 1]; i--) streak++;
    const riv = Object.entries(vs[p.name] || {}).filter(([, v]) => v.games >= MIN_PAIR);
    const nem = riv.sort((a, b) => pct(a[1].wins, a[1].games) - pct(b[1].wins, b[1].games) || b[1].games - a[1].games)[0];
    return { ...p, wr: pct(p.wins, p.games), streak: f.length ? (f[f.length - 1] === 'W' ? '+' : '-') + streak : '', nemesis: nem ? { name: nem[0], ...nem[1] } : null, last5: f.slice(-5) };
  }).sort((a, b) => b.wr - a.wr || b.games - a.games || a.name.localeCompare(b.name));
  const pl2 = Object.values(pairs).filter((s) => s.games >= MIN_PAIR).map((s) => ({ ...s, wr: pct(s.wins, s.games) }));
  const best = pl2.slice().sort((a, b) => b.wr - a.wr || b.games - a.games).slice(0, 5);
  const worst = pl2.slice().sort((a, b) => a.wr - b.wr || b.games - a.games).slice(0, 5);
  const fav = Object.entries(anims).sort((a, b) => b[1] - a[1])[0];
  return { total: matches.length, decided, players, best, worst, fav: fav ? { id: fav[0], n: fav[1] } : null };
}

const duo = (s) => `<div class="st-duo">${avatarHTML(s.a)}${avatarHTML(s.b)}</div><span class="nm st-two">${esc(s.a)}<br>${esc(s.b)}</span>`;
const bar = (wr) => `<span class="st-bar"><i style="width:${wr}%"></i></span><b class="st-wr">${wr}%</b>`;

let resetWired = false;
export async function showStats() {
  if (!resetWired) { resetWired = true; $('#stReset').addEventListener('click', async () => {
    if (!confirm('¿Borrar todo el historial de partidos? Las estadísticas empezarán de cero para todo el grupo.')) return;
    try { await api.resetMatches(); toast('Estadísticas reseteadas'); } catch (e) { toast('No se pudieron resetear'); }
    showStats();
  }); }
  const box = $('#statsBody');
  box.innerHTML = '<div class="placeholder"><b>Calculando…</b>Revisando el historial clínico de la pachanga.</div>';
  const S = computeStats(await api.listMatches().catch(() => []));
  $('#stTotal').textContent = S.total; $('#stDecided').textContent = S.decided; $('#stPlayers').textContent = S.players.length;
  $('#stFav').textContent = S.fav ? animLabel(S.fav.id) : '—';
  if (!S.decided) { box.innerHTML = '<div class="placeholder"><b>Aún no hay ganadores</b>Juega una pachanga y marca el equipo ganador con 🏆 para ver las estadísticas.</div>'; return; }
  const rowP = (p, i) => `<div class="prow st-row"><span class="st-pos">${i + 1}</span>${avatarHTML(p.name)}<span class="nm">${esc(p.name)}</span>
    <span class="st-form">${p.last5.map((r) => `<i class="${r}">${r === 'W' ? 'V' : 'D'}</i>`).join('')}</span>
    <span class="st-meta">${p.wins}V · ${p.games - p.wins}D${p.streak ? ` · racha ${p.streak}` : ''}</span>${bar(p.wr)}</div>`;
  const rowS = (s) => `<div class="prow st-row">${duo(s)}<span class="st-meta">${s.wins}/${s.games}</span>${bar(s.wr)}</div>`;
  const nem = S.players.filter((p) => p.nemesis && p.nemesis.wins < p.nemesis.games / 2);
  box.innerHTML = `
    <div class="section"><div class="sec-head"><h3>Winrate por jugador</h3><span class="hint">solo partidos con ganador</span></div>${S.players.filter((p) => p.games).map(rowP).join('')}</div>
    <div class="st-grid">
      <div class="section"><div class="sec-head"><h3>💚 Mejor combinación</h3><span class="hint">mín. ${MIN_PAIR} partidos juntos</span></div>${S.best.map(rowS).join('') || '<p class="hint">Faltan partidos juntos.</p>'}</div>
      <div class="section"><div class="sec-head"><h3>💔 Peor combinación</h3><span class="hint">mejor no juntarlos</span></div>${S.worst.map(rowS).join('') || '<p class="hint">Faltan partidos juntos.</p>'}</div>
    </div>
    <div class="section"><div class="sec-head"><h3>😈 Némesis</h3><span class="hint">el rival contra el que más pierdes</span></div>${nem.map((p) => `<div class="prow st-row">${avatarHTML(p.name)}<span class="nm">${esc(p.name)}</span><span class="st-meta">contra</span>${avatarHTML(p.nemesis.name)}<span class="nm">${esc(p.nemesis.name)}</span>${bar(pct(p.nemesis.wins, p.nemesis.games))}</div>`).join('') || '<p class="hint">Nadie tiene todavía un némesis claro.</p>'}</div>`;
}
