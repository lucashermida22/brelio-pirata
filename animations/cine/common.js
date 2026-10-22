// Estudio de cine: lo comparten «cine» (Tierra 3D) y «cineclassic» (campo de estrellas).
// La Tierra 3D va en earth.js y solo se descarga cuando hace falta.


export const CINE = {
  title: 'BRELIO PICTURES', winTitle: 'Y EL GANADOR ES…', sub: 'presenta · los equipos de hoy', btn: 'Ver los créditos',
  song: 'cine/uni.mp3',
  upAt: 4200, arenaAt: 5300, cardsAt: 1400, step: [300, 600], pops: ['✦', '✧', '✦'], hold: 4700,
};

function starfield(c) {
  const rand = (n) => Math.random() * n;
  const ctx = c.getContext('2d'); let raf, w, h;
  const S = Array.from({ length: 320 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
  const d = Math.min(2, devicePixelRatio || 1);
  w = c.width = c.clientWidth * d; h = c.height = c.clientHeight * d;
  const t0 = performance.now();
  const tick = (t) => {
    const e = (t - t0) / 1000, sp = e < 1.6 ? .022 : e < 3 ? .008 : .0025;
    ctx.fillStyle = 'rgba(2,4,12,.32)'; ctx.fillRect(0, 0, w, h);
    for (const s of S) {
      s.z -= sp; if (s.z <= .02) { s.z = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; }
      const k = .45 / s.z, x = w / 2 + s.x * k * w / 2, y = h * .42 + s.y * k * h / 2, r = Math.max(.6, (1 - s.z) * 2.4) * d;
      ctx.fillStyle = `rgba(255,${235 + Math.floor(rand(20))},${200 + Math.floor(rand(40))},${Math.min(1, 1.2 - s.z)})`; ctx.fillRect(x, y, r, r);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export async function playCine(ctx, classic) {
  const use3d = !classic && ctx.kit.webglOK();
  let earth = null;
  if (use3d) { await ctx.kit.loadThree(); earth = await import('./earth.js'); if (!ctx.isOpen()) return; }
  ctx.kit.dom.play(ctx, {
    reveal: 'spot', shape: 'poster', p3d: !classic,
    teamDelay: (i) => i * 350, shakeAt: 700,
    fx: () => use3d
      ? '<canvas class="earth-cv"></canvas><div class="lb t"></div><div class="lb b"></div>'
      : '<canvas class="stars"></canvas><div class="planet"></div><div class="flare"></div><div class="lb t"></div><div class="lb b"></div>',
    fxStart: (c, fx) => (use3d ? earth.cineEarth(c, fx.querySelector('.earth-cv')) : starfield(fx.querySelector('canvas'))),
  });
}
