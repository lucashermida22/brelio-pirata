import './style.css';

// Reggaetón: láseres, suelo de discoteca y las cartas cayendo al ritmo.
export default {
  label: 'Reggaetón',
  order: 60,
  song: 'perreo/garg.mp3', soundAt: 0, beat: 652,
  title: '¡DEMBOW ASIGNADO!', winTitle: '¡LOS REYES DEL PERREO!', sub: 'brelio records · perreo edition', btn: 'Seguir perreando 🔥',
  upAt: 1956, arenaAt: 2608, cardsAt: 652, pops: ['🔥', '💎', '🎶', '😎'], hold: 3912,
  play(ctx) {
    ctx.kit.dom.play(ctx, {
      reveal: 'drop', shape: 'ring', p3d: true,
      fx: () => '<div class="lasers"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="floor"></div>',
    });
  },
};
