import { loadThree } from '@kit';
// Feria: coches de choque. Cada embestida asigna equipo y el coche se va a aparcar a su lado.
export default {
  label: 'Feria · Coches de choque',
  order: 90,
  needsWebGL: true, gl: true,
  song: 'feria/choque.mp3', soundAt: 0, beat: 372,
  title: 'COCHES DE CHOQUE', winTitle: '¡CAMPEONES DE LA FERIA!', sub: '', btn: 'Bajarse del coche',
  pops: [], hold: 4500,
  rename(teams) { if (teams.length >= 2) { teams[0].name = 'Gitanos'; teams[1].name = 'Payos'; } },
  warm: () => Promise.all([loadThree(), import('./scene.js')]),
  async play(ctx) {
    const { playFeria } = await import('./scene.js');
    return playFeria(ctx);
  },
};
