import './style.css';

// Bruh: sin música, solo el «bruh» de cada carta aterrizando.
export default {
  label: 'Bruh',
  order: 50,
  media: ['bruh/bruh.mp3'],
  title: 'bruh.', winTitle: 'they won. bruh.', sub: '', btn: 'bruh',
  upAt: 1500, arenaAt: 2400, cardsAt: 900, step: [520, 520], pops: [], hold: 3100,
  async play(ctx) {
    const { dom } = ctx.kit;
    const base = await ctx.audio('bruh/bruh.mp3');
    const bruh = (vol) => { if (!base) return; const a = base.cloneNode(); a.volume = vol ?? .9; a.play().catch(() => {}); };
    ctx.onClosing(() => bruh(1));
    bruh(1);
    dom.play(ctx, {
      shape: 'pile', p3d: true,
      fx: () => '<div class="vign"></div>',
      reveal(el, name, A) { el.style.setProperty('--tilt', (ctx.kit.rand(13) - 6) + 'deg'); dom.land(el, name, A); bruh(.8); dom.punch(el); },
      onUp: () => bruh(1),
      onArena: () => bruh(1),
      onShake: () => bruh(1),
      onDone: () => bruh(1),
    });
  },
};
