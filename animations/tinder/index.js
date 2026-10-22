import { loadThree } from '@kit';
// Tinder («brinder»): el chico hace swipe a cada jugador. Derecha = like → su equipo. Izquierda = nope → el otro.
export default {
  label: 'Tinder',
  order: 100,
  needsWebGL: true, gl: true,
  song: 'tinder/drown.mp3', soundAt: 0, beat: 581,
  title: 'brinder', winTitle: 'brinder', sub: '', btn: 'Cerrar la app',
  pops: [], hold: 4500,
  rename(teams) { ['Matches ❤️', 'Nope 💔', 'Super likes ⭐', 'Bloqueados 🚫'].forEach((nm, i) => { if (teams[i]) teams[i].name = nm; }); },
  winMessage: ({ team, matchWin }) => (matchWin ? '💘 Ganan tus matches: os habéis enamorado' : `💔 Ganan ${team.name}… y tú te quedas sin match`),
  warm: () => Promise.all([loadThree(), import('./scene.js')]),
  async play(ctx) {
    const { playTinder } = await import('./scene.js');
    return playTinder(ctx);
  },
};
