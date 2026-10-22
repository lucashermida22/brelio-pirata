import './style.css';
import { gg, HUD } from './gg.js';
import { loadThree } from '@kit';

// GG EZ: retransmisión de esports con chat en directo. 3D con WebGL; si no, versión de DOM.
export default {
  label: 'GG EZ',
  order: 40,
  song: 'ggez/ggez.mp3', soundAt: .23, beat: 465,
  title: 'GG EZ', winTitle: 'VICTORY', sub: 'ez game · ez life', btn: 'GG ✓',
  upAt: 2325, arenaAt: 3255, cardsAt: 930, pops: ['EZ', 'GG', '+1', '👾'], hold: 3720,

  warm: () => Promise.all([loadThree(), import('./scene.js')]),

  async play(ctx) {
    const { win, teams, stage, fx, kit } = ctx;
    if (kit.webglOK()) {
      stage.classList.add('gl');
      fx.innerHTML = HUD;
      gg.push = gg.chat(ctx);
      const { playGG3D } = await import('./scene.js');
      return playGG3D(ctx);
    }
    const { dom, rand } = kit;
    dom.play(ctx, {
      shape: undefined,
      fx: () => '<div class="tunnel ceil3d"></div><div class="tunnel floor3d"></div><div class="ring">' + Array.from({ length: 8 }, (_, i) => `<b style="--i:${i}">${i % 2 ? 'EZ' : 'GG'}</b>`).join('') + '</div><div class="scan"></div>' + HUD,
      start: () => { gg.push = gg.chat(ctx); },
      reveal(el, name, A) {
        el.classList.add('spin');
        el.querySelector('.vs-face').innerHTML = '<span class="ggback">GG</span>';
        ctx.later(() => {
          dom.land(el, name, A);
          const team = el.closest('.vs-team').querySelector('.vs-team-name span').textContent;
          gg.alert(`🎮 ${name} se une a ${team}`);
          if (gg.push) gg.push(['gg ' + name, name + ' 1v9', 'EZ ' + name, name + ' diff'][rand(4)]);
        }, A.beat * .9);
      },
      onDone: () => gg.alert(win ? `🏆 ${teams[0].name} gana. GG EZ` : '✅ Partida lista · GG EZ'),
    });
  },
};
