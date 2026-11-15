import './style.css';
import { loadThree } from '@kit';
// La Boda: suena «yo me opongo» del vídeo y, cuando arranca la canción, los jugadores entran en 3D
// a la cubierta del barco y se ponen a bailar por equipos con el vídeo de fondo en la pantalla gigante.
export default {
  label: 'La Boda · Yo me opongo',
  order: 95,
  needsWebGL: false, gl: false,          // la escena 3D llega a mitad: no queremos pantalla de carga al principio
  title: 'YO ME OPONGO', winTitle: '¡VIVAN LOS NOVIOS!', sub: '', btn: 'Salir del banquete',
  pops: [], hold: 6000,
  rename(teams) { if (teams.length >= 2) { teams[0].name = 'Familia del novio'; teams[1].name = 'Familia de la novia'; } },
  warm: () => Promise.all([loadThree(), import('./scene.js')]),
  async play(ctx) {
    const { playBoda } = await import('./scene.js');
    return playBoda(ctx);
  },
};
