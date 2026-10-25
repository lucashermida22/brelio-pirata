// Arranque de Lerelio: estilos, datos (Worker o localStorage), animaciones y rutas.
import './styles/base.css';
import './styles/app.css';
import './styles/recursos.css';
import { $, toast } from './util.js';
import { state } from './state.js';
import * as api from './api.js';
import { loadAnimations, initRuntime, warmAll } from './versus/runtime.js';
import { initUI, render, showTeams } from './ui.js';
import { initRecursos, showRecursos } from './recursos.js';
import { initPulse } from './pulse/index.js';
import { getVolume, setVolume } from './volume.js';
import { askWhoLeaves } from './despedida.js';
import './styles/despedida.css';

// «Recursos» es una página más: #recursos. El resto es la agenda.
function route() {
  const rec = location.hash === '#recursos';
  document.body.dataset.view = rec ? 'recursos' : 'app';
  $('#recursosView').hidden = !rec;
  $('#app').hidden = rec;
  $('#heroSec').hidden = rec;
  $('#storiesSec').hidden = rec;
  $('#navRecursos').setAttribute('aria-current', rec ? 'page' : 'false');
  if (rec) { showRecursos(); window.scrollTo(0, 0); }
}

// Modo «key» del Worker: pide la clave del grupo
function askGroupKey(retry) {
  return new Promise((resolve) => {
    const k = window.prompt(retry ? 'Clave incorrecta. Prueba otra vez:' : 'Clave del grupo:');
    resolve(k && k.trim() ? k.trim() : null);
  });
}

async function boot() {
  api.onAuthRequired(askGroupKey);
  initRuntime();
  const [, mode] = await Promise.all([loadAnimations(), api.init()]);
  state.players = await api.listPlayers();
  if (mode === 'remote' && !state.players.length) state.players = await api.seedPlayers(state.players).catch(() => []);
  if (mode === 'remote') {
    api.migrateLegacy(state.players).then(async (changed) => { if (changed) { state.players = await api.listPlayers(); render(); } }).catch(() => {});
  } else {
    document.body.dataset.backend = 'local';
  }
  initUI();
  // Ajustes: volumen general
  { const pop = $('#ajustesPop'), r = $('#vol'), out = $('#volVal'), show = () => { out.textContent = Math.round(getVolume() * 100) + '%'; };
    r.value = Math.round(getVolume() * 100); show();
    $('#ajustes').addEventListener('click', (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; });
    document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) pop.hidden = true; });
    r.addEventListener('input', () => { setVolume(r.value / 100); show(); }); }
  $('#leave').addEventListener('click', askWhoLeaves);
  initRecursos();
  initPulse();   // la onda de color de los botones que no hacen nada
  addEventListener('hashchange', route);
  route();
  warmAll(state.animPref !== 'random' ? state.animPref : null);
  window.__brelio = { state, api, showTeams };   // para depurar desde la consola
  if (mode === 'local') console.info('[brelio] Sin Worker: jugadores y pachangas en localStorage.');
}

boot().catch((e) => { console.error(e); toast('Algo ha fallado al arrancar'); });
