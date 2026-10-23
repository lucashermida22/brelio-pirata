import './style.css';
import { catFor } from './catalog.js';

// Approved: cada jugador presenta su «solicitud» a Knuckles; según lo que diga en el vídeo, va a un equipo u otro.
// Sin canción: el audio es el de cada clip.
export default {
  label: 'Approved',
  order: 110,
  song: null,
  title: 'Approved', winTitle: 'Approved!', sub: '', btn: 'Archivar expedientes 🗂️',
  pops: [], hold: 4200,
  // los equipos se llaman como los veredictos (Aprobados ✅, No aprobados ❌…)
  rename(teams) { teams.forEach((t, i) => { t.name = catFor(teams.length, i).name; }); },
  winMessage: ({ team }) => `✅ ${team.name}: Knuckles lo aprueba`,
  warm: () => import('./scene.js'),
  async play(ctx) {
    const { playApproved } = await import('./scene.js');
    return playApproved(ctx);
  },
};
