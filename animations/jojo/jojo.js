// Piezas de JoJo que comparten «jojo» y «mati»: fotograma de impacto, Stands y el final ORA/MUDA.
const HUES = [0, 95, 160, 215, 280, 320];
export function impactFrame(ctx){
  const l = ctx.stage, { rand } = ctx.kit; l.classList.add('impact'); ctx.later(() => l.classList.remove('impact'), 70);
  if (l.dataset.anim === 'jojo' && !l.classList.contains('done')){ l.style.setProperty('--hue', HUES[rand(HUES.length)] + 'deg'); l.style.setProperty('--sat', (1 + Math.random() * .6).toFixed(2)); }
}

const ST_AURA = ['#3ff0ff', '#ffd23f', '#c46bff', '#7dff6a', '#ff6ab8', '#ff9a3c'], ST_HUE = [200, 40, 260, 120, 320, 10];
export function standHTML(kit, m, ti, k){
  const { photoFor, emojiFor } = kit, src = photoFor(m.name), j = (ti * 3 + k) % 6;
  return `<div class="jj-st" style="--sh:${ST_HUE[j]}deg;--aura:${ST_AURA[j]}"><div class="ph">${src ? `<img src="${src}" alt="">` : `<span class="emo">${emojiFor(m.name)}</span>`}</div>` +
    Array.from({ length: 3 }, () => `<i style="left:${10 + Math.random() * 75}%;top:${5 + Math.random() * 60}%;--z:${10 + Math.random() * 10}px;--td:${Math.random() * 1.4}s">✦</i>`).join('') + '</div>';
}

export function jojoFinale(ctx, t){
  const layer = ctx.stage, fx = ctx.fx, win = ctx.win, snd = ctx.song, later = ctx.later, rand = ctx.kit.rand;
  const rush = document.createElement('div'); rush.className = 'jj-rush'; fx.appendChild(rush);
  const W1 = win ? ['¡ORA!', '¡ORA ORA!', '👊'] : ['¡ORA!', '¡ORA ORA!', 'ORA', '👊'], W2 = ['¡MUDA!', '¡MUDA MUDA!', 'MUDA', '👊'];
  const spawn = side => {
    const b = document.createElement('b'), words = side === 'l' ? W1 : W2, w = words[rand(words.length)];
    b.className = side + (w === '👊' ? ' f' : ''); b.textContent = w;
    b.style.cssText = `top:${30 + Math.random() * 55}%;${side === 'l' ? 'left' : 'right'}:${2 + Math.random() * 14}%;--s:${26 + Math.random() * 46}px`;
    if (win) b.style.cssText += ';left:' + (8 + Math.random() * 80) + '%;right:auto';
    rush.appendChild(b); setTimeout(() => b.remove(), 600);
  };
  const tR = t - 300;
  later(() => {
    layer.classList.add('rushing'); impactFrame(ctx);
    const iv = ctx.every(() => { spawn('l'); if (!win) spawn('r'); if (Math.random() < .25) impactFrame(ctx); }, 55);
    later(() => { clearInterval(iv); layer.classList.remove('rushing'); }, 2000);
  }, tR);
  // ¡ZA WARUDO! (solo a veces)
  const tZ = tR + 2150;
  if (Math.random() > .4) return tZ - t;
  later(() => {
    const za = document.createElement('div'); za.className = 'jj-za'; fx.appendChild(za);
    const txt = document.createElement('div'); txt.className = 'jj-world'; txt.innerHTML = '<b>¡ZA WARUDO!</b><small>toki yo tomare</small>'; fx.appendChild(txt);
    layer.classList.add('frozen');
    za.animate([{ transform: 'translate(-50%,-50%) scale(0)' }, { transform: 'translate(-50%,-50%) scale(330)', offset: .3 }, { transform: 'translate(-50%,-50%) scale(260)', offset: .45 }, { transform: 'translate(-50%,-50%) scale(260)', offset: .78 }, { transform: 'translate(-50%,-50%) scale(0)' }], { duration: 2900, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
    txt.querySelector('b').animate([{ opacity: 0, transform: 'skewX(-10deg) scale(2.4)' }, { opacity: 1, transform: 'skewX(-10deg) scale(1)', offset: .12 }, { opacity: 1, offset: .7 }, { opacity: 0, transform: 'skewX(-10deg) scale(1.1)' }], { duration: 2900, fill: 'forwards' });
    const sm = txt.querySelector('small');
    sm.animate([{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: 2900, fill: 'forwards' });
    later(() => { sm.textContent = '1 segundo…'; }, 1100); later(() => { sm.textContent = '2 segundos…'; }, 1700);
    if (snd){ snd.preservesPitch = false; snd.mozPreservesPitch = false; snd.webkitPreservesPitch = false; snd.playbackRate = .5; }
    later(() => {
      layer.classList.remove('frozen'); impactFrame(ctx);
      if (snd){ snd.playbackRate = 1; }
      za.remove(); txt.remove();
    }, 2900);
  }, tZ);
  return tZ + 3000 - t;
}

export const jojoFx = () => '<div class="jj-bg"></div><div class="jj-lines"></div><div class="jj-tone"></div><div class="jj-go">' + Array.from({length: 16}, (_, i) => {
    const side = i % 2, x = side ? 72 + Math.random() * 24 : Math.random() * 22, y = 4 + (i / 16) * 86 + Math.random() * 6;
    return `<span style="left:${x}%;top:${y}%;--s:${28 + Math.random() * 60}px;--d:${.2 + i * .12}s;--r:${(Math.random() - .5) * 24}deg;--o:${.75 + Math.random() * .25}">ゴ</span>`;
  }).join('') + '</div><div class="jj-slab"></div><div class="jj-do2">ド</div><div class="jj-do">ドドドド</div><div class="jj-tbc"><b>CONTINUARÁ</b><i></i></div>';

export const JOJO = {
  song: 'jojo/vento.mp3', soundAt: 0, beat: 441,
  sub: 'ゴ ゴ ゴ ゴ ゴ ゴ', btn: 'Continuará ⟶',
  upAt: 1764, arenaAt: 2646, cardsAt: 1323, pops: ['ゴ', 'ド', 'ゴ', '!'], hold: 14410,
};

// Flujo de JoJo; «mati» lo reutiliza añadiendo su fondo, su fin y su huevo de pascua (extra).
export function playJojo(ctx, extra = {}) {
  const { win, kit, later } = ctx;
  const { dom, rand } = kit;
  dom.play(ctx, {
    shape: 'lineup', shakeAt: 1100,
    fx: () => (extra.fx ? extra.fx(ctx) : '') + jojoFx(),
    start: () => { later(() => impactFrame(ctx), 60); extra.start && extra.start(ctx); },
    cardExtra: (m, ti, k) => standHTML(kit, m, ti, k),
    reveal(el, name, A) {
      el.style.setProperty('--tilt', (rand(2) ? 1 : -1) * (2 + rand(4)) + 'deg');
      el.classList.add('spin');
      later(() => { dom.land(el, name, A); impactFrame(ctx); }, A.beat * .5);
    },
    onShake: () => impactFrame(ctx),
    finale: (c, end) => jojoFinale(c, end),
    holdExtra: extra.holdExtra,
    onDone: () => {
      impactFrame(ctx);
      extra.onDone && extra.onDone(ctx);
      const A = ctx.A;
      later(() => ctx.stage.classList.add('tbc'), (A.hold || 3200) + (extra.holdExtra ? extra.holdExtra(ctx) : 0) - 2800);
    },
  });
}
