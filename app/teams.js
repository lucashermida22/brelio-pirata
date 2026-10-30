// Reparto de equipos: aleatorio, por nº de equipos o por tamaño, y roles de LOL.
import { rand, shuffle } from './util.js';
import { state } from './state.js';
import { BARS, SERVICES, DIAGNOSES, TEAM_NAMES, STATUS, PRICES } from './data.js';

export const LANES = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];
const DROP = ['SUPPORT', 'JUNGLA', 'TOP', 'ADC']; // orden en que se quitan si faltan jugadores
export const LANE_COLORS = { TOP: '#dc2626', JUNGLA: '#15803d', MID: '#1a5ddc', ADC: '#d97706', SUPPORT: '#9333ea', BANQUILLO: '#71717a' };

export function teamCount(numValue) {
  const v = Math.max(1, parseInt(numValue) || 1);
  return state.mode === 'teams' ? v : Math.ceil(state.players.length / v);
}

export function makeTeams(numValue) {
  const names = state.players.map((p) => p.name);
  const t = Math.min(teamCount(numValue), names.length);
  const shuffled = shuffle(names);
  const services = shuffle(SERVICES);
  const dxs = shuffle(DIAGNOSES);
  const tnames = shuffle(TEAM_NAMES);
  const teams = Array.from({ length: t }, (_, i) => ({
    name: tnames[i % tnames.length], svc: services[i % services.length], bar: BARS[i % BARS.length],
    status: STATUS[rand(STATUS.length)], price: PRICES[rand(PRICES.length)], members: [],
  }));
  // «personas por equipo»: se llenan los equipos completos y el que sobra va con los restantes (4 en equipos de 3 → 3 + 1)
  const per = state.mode === 'teams' ? 0 : Math.max(1, parseInt(numValue) || 1);
  shuffled.forEach((p, i) => teams[per ? Math.min(t - 1, Math.floor(i / per)) : i % t].members.push({ name: p, dx: dxs[i % dxs.length] }));
  return teams;
}

export function assignLanes(teams) {
  teams.forEach((t) => {
    let lanes = [...LANES];
    for (let k = 0; lanes.length > t.members.length && k < DROP.length; k++) lanes = lanes.filter((l) => l !== DROP[k]);
    const roles = shuffle(lanes);
    shuffle(t.members.map((_, i) => i)).forEach((mi, k) => { t.members[mi].role = roles[k] || 'BANQUILLO'; });
    const o = (r) => (r === 'BANQUILLO' ? 99 : LANES.indexOf(r));
    t.members.sort((a, b) => o(a.role) - o(b.role));
  });
}
