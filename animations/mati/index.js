import '../jojo/style.css';
import './style.css';
import { JOJO, playJojo } from '../jojo/jojo.js';
import { eggMati, matiTwist, twistShark } from './egg.js';

// Mati JoJo: JoJo, pero el protagonista es Mati.
// Huevo de pascua: 3 toques en su foto o escribir «mati». En la repetición del ganador, giro final.
export default {
  label: 'Mati JoJo',
  order: 80,
  ...JOJO,
  key: 'jojo', variant: 'mati',
  hero: 'mati/hero.jpg',
  media: ['mati/bg.jpg', 'mati/hero.jpg', 'mati/croc.jpg'],
  title: 'Mati ha elegido', winTitle: '¡Victoria de oro!',

  winMessage: ({ team }) => `🏆 ${team.name} gana… pero el verdadero ganador es ${twistShark ? 'el tiburón' : 'Mati'}`,

  play(ctx) {
    const { win, later, stage } = ctx;
    ctx.onType('mati', () => eggMati(ctx));

    // 3 toques seguidos en la foto de Mati
    let tapN = 0, tapT = 0;
    const hero = stage.querySelector('#vsHero');
    const tap = (e) => {
      e.stopPropagation();
      const now = performance.now(); tapN = now - tapT < 700 ? tapN + 1 : 1; tapT = now;
      if (tapN >= 3) { tapN = 0; eggMati(ctx); }
    };
    hero.addEventListener('click', tap);
    ctx.onClose(() => hero.removeEventListener('click', tap));

    playJojo(ctx, {
      fx: () => `<div class="jj-mati" style="background-image:url(${ctx.url('mati/bg.jpg')})"></div>`,
      start: () => { if (win) stage.classList.add('lbx'); },
      holdExtra: () => (win ? 3000 : 0),
      onDone: () => {
        if (win) later(() => matiTwist(ctx), 1300);
        else if (Math.random() < 1 / 3) later(() => eggMati(ctx), 1600);
      },
    });
  },
};
