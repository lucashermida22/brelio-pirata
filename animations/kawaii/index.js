import './style.css';

// Kawaii: corazones, brillitos y caras que giran como una tragaperras.
export default {
  label: 'Kawaii',
  order: 10,
  song: 'kawaii/team.mp3',
  title: '¡EQUIPOS GENERADOS!', winTitle: '¡CAMPEONES! 💖', sub: '', btn: 'Ver en la agenda ✨',
  upAt: 1650, arenaAt: 2350, cardsAt: 700, step: [130, 320], pops: ['💖', '✨', '💕', '⭐'], hold: 3700,
  play(ctx) {
    ctx.kit.dom.play(ctx, { reveal: 'slot', shape: 'heart', p3d: true });
  },
};
