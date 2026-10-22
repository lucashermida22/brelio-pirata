import '../jojo/style.css';   // el ¡ZA WARUDO! reutiliza sus clases
import './style.css';
import { loadThree } from '@kit';

// Fast & Furious: «el último viaje». Huevo de pascua: escribe «mati» durante la animación.
export default {
  label: 'Fast & Furious',
  order: 110,
  needsWebGL: true, gl: true,
  song: 'furious/last_ride.mp3', songLoop: true, soundAt: 0,
  media: ['furious/toretto.jpg', 'furious/paul.jpg', 'mati/hero.jpg', 'mati/croc.jpg', 'jojo/vento.mp3'],
  title: 'EL ÚLTIMO VIAJE', winTitle: 'LA ÚLTIMA VICTORIA', sub: 'los equipos de hoy', btn: 'Nos vemos',
  pops: [], hold: 6000,
  rename(teams) {
    const FF = ['Team Toretto', 'Team Paul', 'Team Letty', 'Team Roman', 'Team Tej', 'Team Han', 'Team Mia', 'Team Hobbs', 'Team Shaw', 'Team Gisele'];
    teams.forEach((t, i) => { t.name = FF[i] || 'Familia ' + (i + 1); });
  },
  warm: () => Promise.all([loadThree(), import('./scene.js')]),
  async play(ctx) {
    const { playFurious } = await import('./scene.js');
    return playFurious(ctx);
  },
};
