// Catálogo de «Approved»: los clips de Knuckles, qué veredicto da cada uno y cómo se reparten por equipo.
// Los únicos recursos son los vídeos de media/approved/; todo lo demás es DOM/CSS.

// Tipos de veredicto (en orden de equipo): nombre del equipo, emoji, color y marca del sello
export const KINDS = {
  ok:   { name: 'Aprobados',          emoji: '✅', color: '#16a34a', ink: '#e2336f', mark: '✓' },
  no:   { name: 'No aprobados',       emoji: '❌', color: '#dc2626', ink: '#c81d25', mark: '✗' },
  ill:  { name: 'Ilegales',           emoji: '🚨', color: '#ea580c', ink: '#b3141b', mark: '!' },
  ban:  { name: 'Desterrados',        emoji: '🚪', color: '#7c3aed', ink: '#6d28d9', mark: '→' },
  idk:  { name: 'Ni idea',            emoji: '🤷', color: '#2563eb', ink: '#1d4ed8', mark: '?' },
  free: { name: 'Sin consecuencias',  emoji: '😎', color: '#0891b2', ink: '#0e7490', mark: '~' },
};
export const ORDER = ['ok', 'no', 'ill', 'ban', 'idk', 'free'];

// Cada clip: duración (s), momentos en que Knuckles golpea con el sello en el vídeo (s), tipo, texto del sello y subtítulo
export const CLIPS = {
  'aprobado-1':  { dur: 2.33, hits: [0.7], kind: 'ok',   stamp: 'APROBADO',            cap: '¡Aprobado!' },
  'aprobado-2':  { dur: 1.8, hits: [1.44], kind: 'ok',   stamp: 'APROBADO',            cap: 'Feliz cumpleaños, ¡aprobado!' },
  'aprobado-3':  { dur: 2.97, hits: [1.85], kind: 'ok',   stamp: 'APROBADO',            cap: 'Excelente argumento. Aprobado.' },
  'aprobado-4':  { dur: 2.83, hits: [1.82], kind: 'ok',   stamp: 'APROBADO',            cap: 'No hay tiempo para leer la lista. Aprobado. Siguiente.' },
  'aprobado-5':  { dur: 3.5, hits: [1.95], kind: 'ok',   stamp: 'APROBADO',            cap: '¡Aprobado!' },
  'rechazado-1': { dur: 5.1, kind: 'no',   stamp: 'NO APROBADO',         cap: 'Uh, madura ya, Sonic.' },
  'rechazado-2': { dur: 3.97, hits: [0.22, 0.92, 1.56, 2.28, 3.6], kind: 'no',   stamp: 'NO APROBADO',         cap: '¡Nada de bumeranes, ni martillos, ni inventos, ni ataques giratorios, ni mayonesa!' },
  'ilegal-1':    { dur: 4.63, hits: [2.85], kind: 'ill',  stamp: 'AHORA ES ILEGAL',     cap: 'Ahora es ilegal.' },
  'ilegal-2':    { dur: 1.57, hits: [1.2], kind: 'ill',  stamp: 'ES ILEGAL',           cap: 'Es ilegal.' },
  'desterrado-1':{ dur: 5.37, kind: 'ban',  stamp: 'DESTERRADO',          cap: 'Mírate, tú que fuiste tan orgulloso. Vete ahora y no vuelvas jamás.' },
  'dudoso-1':    { dur: 1.73, kind: 'idk',  stamp: 'NI IDEA',             cap: 'No sé.' },
  'sinconsecuencias-1': { dur: 7.2, hits: [6.92], kind: 'free', stamp: 'SIN CONSECUENCIAS', cap: '¿Qué es lo peor que podría pasar? ¿Ves? ¡Sin consecuencias!' },
};
export const clipKey = (id) => `approved/${id}.mp4`;
const ids = (kind) => Object.keys(CLIPS).filter((k) => CLIPS[k].kind === kind);

const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI'];

// Qué es el equipo nº i cuando hay n equipos: { kind, name, pool }
export function catFor(n, i) {
  const kind = ORDER[i % ORDER.length], round = Math.floor(i / ORDER.length);
  let pool = ids(kind);
  if (round === 0 && kind === 'no' && n === 2) pool = [...ids('no'), ...ids('ill'), ...ids('ban')];
  else if (round === 0 && kind === 'no' && n === 3) pool = [...ids('no'), ...ids('ban')];
  const k = KINDS[kind];
  return { kind, pool, color: k.color, name: `${k.name} ${k.emoji}${ROMAN[round] ?? ' ' + (round + 1)}` };
}
