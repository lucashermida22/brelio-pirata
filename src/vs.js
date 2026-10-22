  // ---- fotos por nombre (sin mayúsculas ni tildes) ----
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9ñ ]/g,' ').replace(/\s+/g,' ').trim();
  const PHOTO_MAP = new Map();
  PHOTOS.forEach(p => p.names.forEach(n => PHOTO_MAP.set(norm(n), p.src)));
  // asociaciones manuales: nombre normalizado → id de foto ('emoji' = sin foto)
  let ASSIGN = {}, EXTRA = [];
  try { ASSIGN = JSON.parse(localStorage.getItem('brelio-assign') || '{}'); } catch(e) {}
  try { EXTRA = JSON.parse(localStorage.getItem('brelio-photos-extra') || '[]'); } catch(e) {}
  const saveAssign = () => { try { localStorage.setItem('brelio-assign', JSON.stringify(ASSIGN)); localStorage.setItem('brelio-photos-extra', JSON.stringify(EXTRA)); return true; } catch(e) { return false; } };
  const allPhotos = () => [...PHOTOS, ...EXTRA];
  function photoFor(name){
    const n = norm(name);
    if (n in ASSIGN){ const p = allPhotos().find(x => x.id === ASSIGN[n]); return p ? p.src : null; }
    if (PHOTO_MAP.has(n)) return PHOTO_MAP.get(n);
    const first = n.split(' ')[0];
    if (PHOTO_MAP.has(first)) return PHOTO_MAP.get(first);
    return null;
  }
  const EMOJIS = ['🐸','🐙','🦄','🐼','🦊','🐵','🐷','🐨','🐯','👽','🤡','🥸','🐧','🦖','🐹','🐻','🦁','🐔','🤠','👻'];
  function emojiFor(name){ let h=0; for (const c of norm(name)) h=(h*31+c.charCodeAt(0))>>>0; return EMOJIS[h % EMOJIS.length]; }
  const faceInner = name => { const src = photoFor(name); return src ? `<img src="${src}" alt="">` : `<span class="emo">${emojiFor(name)}</span>`; };
  const avatarHTML = name => { const src = photoFor(name); return src ? `<span class="avatar ph"><img src="${src}" alt=""></span>` : `<span class="avatar emo">${emojiFor(name)}</span>`; };

  // ---- animación VS ----
  let vsTimers = [], vsPending = null, vsOpen = false;
  const later = (fn, ms) => vsTimers.push(setTimeout(fn, ms));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function layoutArena(teams, key){
    const arena = $('#vsArena');
    const vw = innerWidth, vh = innerHeight, narrow = vw <= 640;
    const n = teams.length, per = Math.max(...teams.map(t => t.members.length));
    const vsw = narrow ? 52 : Math.max(52, Math.min(96, vw * .075));
    const gap = narrow ? 10 : 14;
    const stands = key === 'jojo', ST = stands ? (narrow ? .9 : 1.45) : 0;   // altura del Stand respecto a la carta
    const maxCols = stands && !narrow ? per : narrow ? 4 : Math.max(1, Math.ceil(Math.sqrt(per * (n <= 2 ? 1.3 : .8))));
    const cols = Math.ceil(per / Math.ceil(per / maxCols));
    const rows = Math.ceil(per / cols);
    let availW, availH;
    if (narrow){ availW = vw - 24 - 24; availH = (vh * .62 - (n-1)*(vsw+gap*2)) / n - 40; }
    else { availW = (vw * .94 - (n-1)*(vsw + gap*2)) / n - 24; availH = vh * .58 - 44; }
    const cg = key === 'jojo' && !narrow ? 26 : 10, nameH = teams.some(t => t.members.some(m => m.role)) ? 54 : 30;
    if (stands) availH = vh * .6 - 50;
    let card = Math.min(140, (availW - (cols-1)*cg) / cols, ((availH - (rows-1)*cg) / rows - nameH - (stands ? 6 : 0)) / (1 + ST));
    card = Math.max(narrow ? 46 : 54, Math.floor(card));
    arena.style.setProperty('--gap', gap + 'px');
    arena.style.setProperty('--vsw', vsw + 'px');
    arena.style.setProperty('--card', card + 'px');
    arena.style.setProperty('--cols', cols);
    arena.style.setProperty('--standH', Math.floor(card * ST) + 'px');
    arena.style.setProperty('--cgap', cg + 'px');
    arena.style.setProperty('--nfs', Math.max(11, Math.min(16, card * .15)) + 'px');
  }

  function burst(el, chars){
    const r = el.getBoundingClientRect(), layer = $('#vsLayer');
    for (let k = 0; k < 6; k++){
      const s = document.createElement('span');
      s.className = 'vs-pop'; s.textContent = chars[k % chars.length];
      const a = (Math.PI * 2 * k) / 6 + Math.random() * .6, d = 40 + Math.random() * 30;
      s.style.left = (r.left + r.width/2 - 10) + 'px'; s.style.top = (r.top + r.height/2 - 10) + 'px';
      s.style.setProperty('--dx', Math.cos(a)*d + 'px'); s.style.setProperty('--dy', Math.sin(a)*d + 'px');
      layer.appendChild(s); setTimeout(() => s.remove(), 900);
    }
  }

  // ---- variantes ----
  const ANIMS = {
    kawaii: { label:'Kawaii', title:'¡EQUIPOS GENERADOS!', winTitle:'¡CAMPEONES! 💖', sub:'', btn:'Ver en la agenda ✨', sound:'#teamSound', upAt:1650, arenaAt:2350, cardsAt:700, step:[130,320], reveal:'slot', pops:['💖','✨','💕','⭐'], hold:3700 },
    cine:   { label:'Estudio de cine', title:'BRELIO PICTURES', winTitle:'Y EL GANADOR ES…', sub:'presenta · los equipos de hoy', btn:'Ver los créditos', sound:'#uniSound', upAt:4200, arenaAt:5300, cardsAt:1400, step:[300,600], reveal:'spot', pops:['✦','✧','✦'], hold:4700 },
    cineclassic: { label:'Estudio de cine (clásico)', variant:'classic', base:'cine', title:'BRELIO PICTURES', winTitle:'Y EL GANADOR ES…', sub:'presenta · los equipos de hoy', btn:'Ver los créditos', sound:'#uniSound', upAt:4200, arenaAt:5300, cardsAt:1400, step:[300,600], reveal:'spot', pops:['✦','✧','✦'], hold:4700 },
    ggez:   { label:'GG EZ', title:'GG EZ', winTitle:'VICTORY', sub:'ez game · ez life', btn:'GG ✓', sound:'#ggezSound', soundAt:.23, beat:465, upAt:2325, arenaAt:3255, cardsAt:930, reveal:'flip3d', pops:['EZ','GG','+1','👾'], hold:3720 },
    bruh:   { label:'Bruh', title:'bruh.', winTitle:'they won. bruh.', sub:'', btn:'bruh', sound:null, upAt:1500, arenaAt:2400, cardsAt:900, step:[520,520], reveal:'bruh', pops:[], hold:3100 },
    perreo: { label:'Reggaetón', title:'¡DEMBOW ASIGNADO!', winTitle:'¡LOS REYES DEL PERREO!', sub:'brelio records · perreo edition', btn:'Seguir perreando 🔥', sound:'#gargSound', soundAt:0, beat:652, upAt:1956, arenaAt:2608, cardsAt:652, reveal:'drop', pops:['🔥','💎','🎶','😎'], hold:3912 },
    jojo:   { label:'JoJo · Menacing', title:'El destino ha elegido', winTitle:'¡Victoria de oro!', sub:'ゴ ゴ ゴ ゴ ゴ ゴ', btn:'Continuará ⟶', sound:'#ventoSound', soundAt:0, beat:441, upAt:1764, arenaAt:2646, cardsAt:1323, reveal:'impact', pops:['ゴ','ド','ゴ','!'], hold:14410 },
    mati:   { label:'Mati JoJo', variant:'mati', base:'jojo', title:'Mati ha elegido', winTitle:'¡Victoria de oro!', sub:'ゴ ゴ ゴ ゴ ゴ ゴ', btn:'Continuará ⟶', sound:'#ventoSound', soundAt:0, beat:441, upAt:1764, arenaAt:2646, cardsAt:1323, reveal:'impact', pops:['ゴ','ド','ゴ','!'], hold:14410 },
    feria:  { label:'Feria · Coches de choque', three:true, scene:'feria', title:'COCHES DE CHOQUE', winTitle:'¡CAMPEONES DE LA FERIA!', sub:'', btn:'Bajarse del coche', sound:'#choqueSound', soundAt:0, beat:372, pops:[], hold:4500 },
    tinder: { label:'Tinder', three:true, scene:'tinder', title:'brinder', winTitle:'brinder', sub:'', btn:'Cerrar la app', sound:'#drownSound', soundAt:0, beat:581, pops:[], hold:4500 },
    furious: { label:'Fast & Furious', three:true, scene:'furious', title:'EL ÚLTIMO VIAJE', winTitle:'LA ÚLTIMA VICTORIA', sub:'los equipos de hoy', btn:'Nos vemos', sound:'#ffSound', soundAt:0, pops:[], hold:6000 },
    three:  { label:'Singularidad 3D', title:'SINGULARIDAD', winTitle:'SUPERNOVA', sub:'los equipos nacen de un agujero negro', btn:'Volver a la Tierra', sound:null, three:true, pops:[], hold:4200 },
  };
  const ANIM_KEYS = Object.keys(ANIMS);
  let animPref = 'random', lastAnim = null, randFace = () => '', fxStop = null;
  try { animPref = localStorage.getItem('brelio-anim') || 'random'; } catch(e) {}
  function pickAnim(){
    if (ANIMS[animPref] && (!ANIMS[animPref].three || threeOK())) return animPref;
    const ks = ANIM_KEYS.filter(k => k !== lastAnim && (!ANIMS[k].three || threeOK()));
    return ks[rand(ks.length)];
  }
  const BRUH = $('#bruhSound');
  function bruh(vol){ if (!BRUH) return; const a = BRUH.cloneNode(); a.volume = vol ?? .9; a.play().catch(() => {}); }
  const SCR = '!<>-_\\/[]{}=+*^?#01ZXK';
  const scramble = s => [...s].map(c => c === ' ' ? ' ' : SCR[rand(SCR.length)]).join('');

  const CHAT = ['gg ez','ez','ggwp','report jungla','?','ez clap','1v9','ff15','uninstall','diff','noob','gg','lag','ez','calculated','nt','tilted','gap'];
  const FX = {
    cine: () => threeOK() && $('#vsLayer').dataset.variant !== 'classic' ? '<canvas class="earth-cv"></canvas><div class="lb t"></div><div class="lb b"></div>' : '<canvas class="stars"></canvas><div class="planet"></div><div class="flare"></div><div class="lb t"></div><div class="lb b"></div>',
    ggez3d: () => '<div class="hud"><span class="live">● LIVE</span><span class="viewers" id="ggViewers">👁 1.204</span></div><div class="chatbox" id="ggChat"></div>',
    ggez: () => '<div class="tunnel ceil3d"></div><div class="tunnel floor3d"></div><div class="ring">' + Array.from({length: 8}, (_, i) => `<b style="--i:${i}">${i % 2 ? 'EZ' : 'GG'}</b>`).join('') + '</div><div class="scan"></div><div class="hud"><span class="live">● LIVE</span><span class="viewers" id="ggViewers">👁 1.204</span></div><div class="chatbox" id="ggChat"></div>',
    bruh: () => '<div class="vign"></div>',
    jojo: () => '<div class="jj-bg"></div><div class="jj-lines"></div><div class="jj-tone"></div><div class="jj-go">' + Array.from({length: 16}, (_, i) => {
        const side = i % 2, x = side ? 72 + Math.random() * 24 : Math.random() * 22, y = 4 + (i / 16) * 86 + Math.random() * 6;
        return `<span style="left:${x}%;top:${y}%;--s:${28 + Math.random() * 60}px;--d:${.2 + i * .12}s;--r:${(Math.random() - .5) * 24}deg;--o:${.75 + Math.random() * .25}">ゴ</span>`;
      }).join('') + '</div><div class="jj-do">ドドドド</div><div class="jj-tbc"><b>CONTINUARÁ</b><i></i></div>',
    perreo: () => '<div class="lasers"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="floor"></div>',
  };
  const CHAT_USERS = [['xX_Sniper_Xx','#ff6b9d'],['tilted_mid','#7ad7ff'],['jungla_diff','#9dff7a'],['adc_main','#ffd36b'],['support_gap','#c69bff'],['brelio_mod','#3d8bff'],['ff15enjoyer','#ff9b5c'],['gg_wp_','#5cffd1']];
  const CHAT_MSG = ['gg ez','EZ','ggwp','report jungla','?','EZ Clap','1v9','ff15','uninstall','diff','gg','lag','calculated','nt','tilted','gap','KEKW','W','L','POG','sin flash','GG EZ GG EZ'];
  function ggChat(){
    const box = $('#ggChat'), vw = $('#ggViewers'); if (!box) return;
    let viewers = 1204 + rand(400);
    const push = text => {
      const [u, col] = CHAT_USERS[rand(CHAT_USERS.length)];
      const p = document.createElement('p');
      p.innerHTML = `<b style="color:${col}">${u}</b>: ${esc(text || CHAT_MSG[rand(CHAT_MSG.length)])}`;
      box.appendChild(p); while (box.children.length > 24) box.firstChild.remove();
      viewers += rand(40); if (vw) vw.textContent = '👁 ' + viewers.toLocaleString('es-ES');
    };
    for (let i = 0; i < 6; i++) push();
    vsTimers.push(setInterval(push, 260));
    return push;
  }
  let ggPush = null;
  function ggAlert(text){
    const layer = $('#vsLayer'); layer.querySelectorAll('.alert').forEach(e => e.remove());
    const d = document.createElement('div'); d.className = 'alert'; d.textContent = text; layer.appendChild(d);
  }
  function starfield(c){
    const ctx = c.getContext('2d'); let raf, w, h;
    const S = Array.from({length: 320}, () => ({ x: Math.random()*2-1, y: Math.random()*2-1, z: Math.random() }));
    const d = Math.min(2, devicePixelRatio || 1);
    w = c.width = c.clientWidth * d; h = c.height = c.clientHeight * d;
    const t0 = performance.now();
    const tick = t => {
      const e = (t - t0) / 1000, sp = e < 1.6 ? .022 : e < 3 ? .008 : .0025;
      ctx.fillStyle = 'rgba(2,4,12,.32)'; ctx.fillRect(0, 0, w, h);
      for (const s of S){
        s.z -= sp; if (s.z <= .02){ s.z = 1; s.x = Math.random()*2-1; s.y = Math.random()*2-1; }
        const k = .45 / s.z, x = w/2 + s.x*k*w/2, y = h*.42 + s.y*k*h/2, r = Math.max(.6, (1 - s.z) * 2.4) * d;
        ctx.fillStyle = `rgba(255,${235 + rand(20)},${200 + rand(40)},${Math.min(1, 1.2 - s.z)})`; ctx.fillRect(x, y, r, r);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }
  const songPos = {};
  function stopSounds(fade){
    document.querySelectorAll('audio.vs-snd').forEach(a => {
      if (a.paused) return;
      songPos[a.id] = a.currentTime; a.playbackRate = 1;
      if (!fade){ a.pause(); a.currentTime = 0; return; }
      const v0 = a.volume, t0 = performance.now();
      const iv = setInterval(() => { const k = (performance.now() - t0) / 450; if (k >= 1){ clearInterval(iv); a.pause(); a.currentTime = 0; a.volume = 1; } else a.volume = v0 * (1 - k); }, 30);
    });
  }

  const HUES = [0, 95, 160, 215, 280, 320];
  function impactFrame(){
    const l = $('#vsLayer'); l.classList.add('impact'); later(() => l.classList.remove('impact'), 70);
    if (l.dataset.anim === 'jojo' && !l.classList.contains('done')){ l.style.setProperty('--hue', HUES[rand(HUES.length)] + 'deg'); l.style.setProperty('--sat', (1 + Math.random() * .6).toFixed(2)); }
  }
  const ST_AURA = ['#3ff0ff', '#ffd23f', '#c46bff', '#7dff6a', '#ff6ab8', '#ff9a3c'], ST_HUE = [200, 40, 260, 120, 320, 10];
  function standHTML(m, ti, k){
    const src = photoFor(m.name), j = (ti * 3 + k) % 6;
    return `<div class="jj-st" style="--sh:${ST_HUE[j]}deg;--aura:${ST_AURA[j]}"><div class="ph">${src ? `<img src="${src}" alt="">` : `<span class="emo">${emojiFor(m.name)}</span>`}</div>` +
      Array.from({ length: 3 }, () => `<i style="left:${10 + Math.random() * 75}%;top:${5 + Math.random() * 60}%;--z:${10 + Math.random() * 10}px;--td:${Math.random() * 1.4}s">✦</i>`).join('') + '</div>';
  }
  function jojoStands(teams){
    const auras = ['#3ff0ff', '#ffd23f', '#c46bff', '#7dff6a'], shifts = [200, 40, 260, 120];
    $('#vsArena').querySelectorAll('.vs-team').forEach((box, i) => {
      const lead = teams[i].members[0]; if (!lead) return;
      const src = photoFor(lead.name);
      const st = document.createElement('div'); st.className = 'jj-stand';
      st.style.cssText = `--sd:${.5 + i * .25}s;--sh:${shifts[i % 4]}deg;--aura:${auras[i % 4]}`;
      st.innerHTML = `<div class="ph">${src ? `<img src="${src}" alt="">` : `<span class="emo">${emojiFor(lead.name)}</span>`}</div>` +
        Array.from({ length: 6 }, () => `<i style="left:${10 + Math.random() * 80}%;top:${8 + Math.random() * 70}%;--z:${14 + Math.random() * 18}px;--td:${Math.random() * 1.4}s">✦</i>`).join('');
      box.appendChild(st);
    });
  }
  // final de JoJo: rush ORA/MUDA → tiempo detenido → pose
  function jojoFinale(teams, win, t, snd){
    const layer = $('#vsLayer'), fx = $('#vsFx');
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
      layer.classList.add('rushing'); impactFrame();
      const iv = setInterval(() => { spawn('l'); if (!win) spawn('r'); if (Math.random() < .25) impactFrame(); }, 55); vsTimers.push(iv);
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
        layer.classList.remove('frozen'); impactFrame();
        if (snd){ snd.playbackRate = 1; }
        za.remove(); txt.remove();
      }, 2900);
    }, tZ);
    return tZ + 3000 - t;
  }
  function land(el, name, A){
    const face = el.querySelector('.vs-face');
    face.innerHTML = faceInner(name);
    el.classList.remove('spin'); el.classList.add('landed');
    if (A.pops.length) burst(face, A.pops);
  }
  function punch(el){
    const arena = $('#vsArena'), r = el.getBoundingClientRect(), a = arena.getBoundingClientRect();
    arena.style.transformOrigin = `${r.left - a.left + r.width/2}px ${r.top - a.top + r.height/2 + arena.scrollTop}px`;
    arena.style.setProperty('--tilt', (rand(2) ? 1 : -1) * (3 + rand(5)) + 'deg');
    arena.classList.remove('punch'); void arena.offsetWidth; arena.classList.add('punch');
  }
  const REVEAL = {
    slot(el, name, A){
      el.classList.add('spin');
      const face = el.querySelector('.vs-face');
      const iv = setInterval(() => { face.innerHTML = randFace(); }, 70); vsTimers.push(iv);
      later(() => { clearInterval(iv); land(el, name, A); }, 480);
    },
    spot(el, name, A){ el.classList.add('spin'); later(() => land(el, name, A), 650); },
    glitch(el, name, A){
      el.classList.add('spin');
      const nm = el.querySelector('.vs-nm');
      const iv = setInterval(() => { nm.textContent = scramble(name); }, 45); vsTimers.push(iv);
      later(() => { clearInterval(iv); nm.textContent = name; land(el, name, A); }, A.beat * .8);
    },
    flip3d(el, name, A){
      el.classList.add('spin');
      el.querySelector('.vs-face').innerHTML = '<span class="ggback">GG</span>';
      later(() => {
        land(el, name, A);
        const team = el.closest('.vs-team').querySelector('.vs-team-name span').textContent;
        ggAlert(`🎮 ${name} se une a ${team}`);
        if (ggPush) ggPush(['gg ' + name, name + ' 1v9', 'EZ ' + name, name + ' diff'][rand(4)]);
      }, A.beat * .9);
    },
    bruh(el, name, A){ el.style.setProperty('--tilt', (rand(13) - 6) + 'deg'); land(el, name, A); bruh(.8); punch(el); },
    impact(el, name, A){
      el.style.setProperty('--tilt', (rand(2) ? 1 : -1) * (2 + rand(4)) + 'deg');
      el.classList.add('spin');
      later(() => { land(el, name, A); impactFrame(); }, A.beat * .5);
    },
    drop(el, name, A){ el.classList.add('spin'); later(() => land(el, name, A), A.beat * .6); },
  };

  function playVersus(teams, onDone, opts = {}){
    const layer = $('#vsLayer'), arena = $('#vsArena'), fx = $('#vsFx');
    vsTimers.forEach(clearTimeout); vsTimers = [];
    stopSounds(false); if (fxStop){ fxStop(); fxStop = null; }
    layer.querySelectorAll('.vs-pop').forEach(e => e.remove());
    const picked = ANIMS[opts.anim] ? opts.anim : pickAnim(); lastAnim = picked;
    const variant = ANIMS[picked].variant || '', key = variant ? ANIMS[picked].base : picked, A = ANIMS[picked];
    const win = !!opts.win;
    vsPending = onDone; vsOpen = true;
    layer.className = ''; layer.dataset.anim = key; layer.querySelectorAll('.alert').forEach(e => e.remove()); arena.innerHTML = ''; arena.className = '';
    $('#vsTitle').textContent = win ? A.winTitle : A.title; $('#vsSub').textContent = win ? '' : A.sub; $('#vsSkip').textContent = A.btn;
    layer.style.setProperty('--beat', (A.beat || 600) + 'ms');
    layer.dataset.variant = variant;
    const gl3d = key === 'ggez' && threeOK();
    fx.innerHTML = gl3d ? FX.ggez3d() : FX[key] ? FX[key]() : '';
    layer.dataset.variant = variant;
    if (variant === 'mati') fx.insertAdjacentHTML('afterbegin', `<div class="jj-mati" style="background-image:url(${$('#matiBg').src})"></div>`);
    // foto principal: en la variante Mati, el protagonista de la ilustración
    const heroEl = $('#vsHero'); if (!heroEl.dataset.orig) heroEl.dataset.orig = heroEl.src;
    heroEl.src = variant === 'mati' ? $('#matiHero').src : heroEl.dataset.orig;
    if (reduced){ closeVersus(); return; }
    void layer.offsetWidth;
    layer.classList.add('active', 'intro'); if (win) layer.classList.add('win');
    if (win && variant === 'mati') layer.classList.add('lbx');
    if (['kawaii', 'cine', 'bruh', 'perreo'].includes(key) && variant !== 'classic') layer.classList.add('p3d');
    document.body.classList.add('party-mode');
    if (gl3d) layer.classList.add('gl');
    if (key === 'cine') fxStop = threeOK() && variant !== 'classic' ? cineEarth(fx.querySelector('.earth-cv'), A) : starfield(fx.querySelector('canvas'));
    const snd = A.sound && $(A.sound);
    if (snd){
      let at = A.soundAt || 0;
      if (win && songPos[snd.id] != null && songPos[snd.id] < snd.duration - 3){   // el ganador sigue la canción, cuadrando el compás
        at = songPos[snd.id];
        if (A.beat){ const b = A.beat / 1000; at = (A.soundAt || 0) + Math.ceil((at - (A.soundAt || 0)) / b) * b; }
      }
      snd.volume = 1; snd.currentTime = at; snd.play().catch(() => {});
    }
    ggPush = key === 'ggez' ? ggChat() : null;
    if (!win && A.scene === 'feria' && teams.length >= 2){ teams[0].name = 'Gitanos'; teams[1].name = 'Payos'; }
    if (!win && A.scene === 'furious'){ const FF = ['Team Toretto', 'Team Paul', 'Team Letty', 'Team Roman', 'Team Tej', 'Team Han', 'Team Mia', 'Team Hobbs', 'Team Shaw', 'Team Gisele']; teams.forEach((t, i) => { t.name = FF[i] || 'Familia ' + (i + 1); }); }
    if (!win && A.scene === 'tinder'){ ['Matches ❤️', 'Nope 💔', 'Super likes ⭐', 'Bloqueados 🚫'].forEach((nm, i) => { if (teams[i]) teams[i].name = nm; }); }
    if (A.three){ if (A.scene) layer.classList.add('gl'); (A.scene === 'feria' ? playFeria : A.scene === 'tinder' ? playTinder : A.scene === 'furious' ? playFurious : playThree)(teams, A, win, opts); return; }
    if (gl3d){ playGG3D(teams, A, win); return; }
    if (key === 'bruh') bruh(1);
    if (key === 'jojo') later(impactFrame, 60);

    const pool = [...new Set([...allPhotos().map(p => p.src), ...teams.flatMap(t => t.members.map(m => photoFor(m.name)))])].filter(Boolean);
    randFace = () => pool.length && Math.random() < .75 ? `<img src="${pool[rand(pool.length)]}" alt="">` : `<span class="emo">${EMOJIS[rand(EMOJIS.length)]}</span>`;

    // 1) la foto sube y se queda arriba
    later(() => { layer.classList.remove('intro'); layer.classList.add('up'); if (key === 'bruh') bruh(1); }, A.upAt);

    // 2) equipos a los lados del VS
    later(() => {
      layoutArena(teams, key);
      arena.innerHTML = teams.map((t, i) => `${i ? '<div class="vs-badge"><span>VS</span></div>' : ''}
        <div class="vs-team ${i % 2 ? 'from-r' : 'from-l'}" style="animation-delay:${key === 'cine' ? i*350 : i*90}ms;--tc:${t.bar}">
          <div class="vs-team-name"><i style="background:${t.bar}"></i><span>${esc(t.name)}</span></div>
          <div class="vs-grid">${t.members.map((m, k) => `<div class="vs-card">${key === 'jojo' ? standHTML(m, i, k) : ''}<div class="vs-face">${faceInner(m.name)}</div><div class="vs-nm">${esc(m.name)}</div>${m.role ? `<div class="vs-lane" style="--lc:${LANE_COLORS[m.role]}">${m.role}</div>` : ''}</div>`).join('')}</div>
        </div>`).join('');
      if (key === 'bruh') bruh(1);
      later(() => { layer.classList.add('shake'); if (key === 'bruh') bruh(1); if (key === 'jojo') impactFrame(); }, key === 'cine' ? 700 : key === 'jojo' ? 1100 : 260);

      // 3) revelado de caras, alternando equipos
      const cols = [...arena.querySelectorAll('.vs-team')].map(t => [...t.querySelectorAll('.vs-card')]);
      const order = [];
      const maxLen = Math.max(...cols.map(c => c.length));
      for (let r = 0; r < maxLen; r++) cols.forEach((c, ti) => { if (c[r]) order.push({ el: c[r], name: teams[ti].members[r].name }); });
      const step = A.beat ? (order.length > 10 ? A.beat / 2 : A.beat) : Math.max(A.step[0], Math.min(A.step[1], 2600 / order.length));
      order.forEach(({ el, name }, k) => later(() => REVEAL[A.reveal](el, name, A), A.cardsAt + k * step));
      let end = A.cardsAt + order.length * step + 700;
      if (key === 'jojo') end += jojoFinale(teams, win, end, snd);
      later(() => {
        layer.classList.remove('shake'); void layer.offsetWidth;
        layer.classList.add('done');
        endShape(key);
        if (key === 'bruh') bruh(1);
        if (key === 'jojo'){ impactFrame(); if (variant === 'mati' && win) later(matiTwist, 1300); if (variant === 'mati' && !win && Math.random() < 1 / 3) later(eggMati, 1600); later(() => layer.classList.add('tbc'), (A.hold || 3200) + (variant === 'mati' && win ? 3000 : 0) - 2800); }
        if (key === 'ggez') ggAlert(win ? `🏆 ${teams[0].name} gana. GG EZ` : '✅ Partida lista · GG EZ');
        if (win && A.pops.length){
          const cards = [...arena.querySelectorAll('.vs-face')];
          vsTimers.push(setInterval(() => burst(cards[rand(cards.length)], A.pops), 280));
        }
      }, end);
      later(closeVersus, end + (A.hold || 3200) + (variant === 'mati' && win ? 3000 : 0));
    }, A.arenaAt);
  }

  function closeVersus(){
    if (!vsOpen) return;
    if (typeof eggOn !== 'undefined' && eggOn){ setTimeout(closeVersus, 500); return; }
    vsOpen = false;
    vsTimers.forEach(clearTimeout); vsTimers = [];
    const layer = $('#vsLayer');
    stopSounds(true);
    const finish = () => {
      if (fxStop){ fxStop(); fxStop = null; }
      layer.className = ''; $('#vsArena').innerHTML = ''; $('#vsFx').innerHTML = '';
      document.body.classList.remove('party-mode');
      const cb = vsPending; vsPending = null; cb && cb();
    };
    if (reduced || !layer.classList.contains('active')) return finish();
    if (layer.dataset.anim === 'bruh') bruh(1);
    layer.classList.add('closing');
    setTimeout(finish, 430);
  }
  $('#vsLayer').addEventListener('click', closeVersus);
  addEventListener('keydown', e => { if (vsOpen && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); closeVersus(); } });

  function generate(){
    if (people.length < 2){ toast('Faltan pacientes en la sala de espera'); return; }
    if (vsOpen) return;
    const teams = makeTeams();
    $('#result').innerHTML = `<div class="placeholder"><b>Asignando equipos…</b>Los pacientes están entrando en consulta.</div>`;
    playVersus(teams, () => {
      showTeams(teams);
      $('#result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    teams.anim = lastAnim;
  }

  const sel = $('#animSel');
  sel.innerHTML = '<option value="random">Aleatoria</option>' + ANIM_KEYS.map(k => `<option value="${k}">${ANIMS[k].label}</option>`).join('');
  sel.value = ANIMS[animPref] ? animPref : 'random';
  sel.addEventListener('change', () => { animPref = sel.value; try { localStorage.setItem('brelio-anim', animPref); } catch(e) {} });

  // ---- elegir ganador: repite la animación solo con el equipo ganador ----
  $('#result').addEventListener('click', e => {
    const b = e.target.closest('.win-btn'); if (!b || !lastTeams || vsOpen) return;
    const t = lastTeams[+b.dataset.win];
    lastTeams.forEach(x => x.winner = false); t.winner = true;
    const matchWin = lastTeams.indexOf(t) === 0;
    playVersus([t], () => { showTeams(lastTeams); toast(lastTeams.anim === 'tinder' ? (matchWin ? '💘 Ganan tus matches: os habéis enamorado' : `💔 Ganan ${t.name}… y tú te quedas sin match`) : lastTeams.anim === 'mati' ? `🏆 ${t.name} gana… pero el verdadero ganador es ${twistShark ? 'el tiburón' : 'Mati'}` : `🏆 ${t.name} gana la pachanga`); }, { win: true, anim: lastTeams.anim, matchWin });
  });

  // ---- formas finales por estilo (los equipos se recolocan al terminar) ----
  const SHAPES = { kawaii: 'heart', cine: 'poster', bruh: 'pile', perreo: 'ring', jojo: 'lineup' };
  function endShape(key){
    const kind = SHAPES[key]; if (!kind) return;
    const p3d = $('#vsLayer').classList.contains('p3d');
    $('#vsArena').querySelectorAll('.vs-team').forEach((team, ti) => {
      const cards = [...team.querySelectorAll('.vs-card')], N = cards.length; if (!N) return;
      // medidas de maquetación (no les afectan las transformaciones 3D)
      const W = team.offsetWidth, H = team.offsetHeight, nm = team.querySelector('.vs-team-name');
      const top = nm.offsetTop + nm.offsetHeight + 6, cx = W / 2, cy = top + (H - top) / 2;
      const cw = cards[0].offsetWidth, chh = cards[0].offsetHeight;
      const lc = c => [c.offsetLeft + c.offsetWidth / 2, c.offsetTop + c.offsetHeight / 2];
      const rx = Math.max(cw * .3, W / 2 - cw * .42), ry = Math.max(chh * .2, (H - top) / 2 - chh * .36);
      const bg = document.createElement('div'); bg.className = 'shape-bg ' + kind;
      bg.style.cssText = `left:${cx}px;top:${cy}px;width:${rx * 2 + cw}px;height:${ry * 2 + chh}px`;
      team.prepend(bg); team.classList.add('shaped', 'shape-' + kind);
      let pts = [];
      if (kind === 'heart'){
        pts = cards.map((_, i) => {
          const t = N === 1 ? Math.PI : (i / N) * Math.PI * 2 + Math.PI / N;
          const x = 16 * Math.sin(t) ** 3, y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          return [cx + x / 16 * rx * 1.08, cy + (y + 3) / 14 * ry, Math.sin(x) * 4, .74, null, p3d ? `translateZ(${(Math.cos(t) * 50).toFixed(0)}px) rotateY(${(-x / 16 * 28).toFixed(1)}deg)` : ''];
        });
      } else if (kind === 'poster'){
        const k = Math.max(.7, Math.min(1.5, (H - top) * .78 / chh, W * .96 / (cw * (1 + (N - 1) * .62))));
        const sp = N > 1 ? Math.min(cw * k * .74, (W - cw * k) / (N - 1)) : 0;
        pts = cards.map((_, i) => { const d = i - (N - 1) / 2, a = Math.abs(d); return [cx + d * sp, cy + a * a * chh * k * .035, d * 3.5, k * (1.06 - a * .08), 20 - Math.round(a * 2), p3d ? `translateZ(${-a * 70}px) rotateY(${-d * 16}deg)` : '']; });
      } else if (kind === 'lineup'){
        // cada uno con su Stand en su columna: solo escalonado vertical, sin moverse de lado (nunca se pisan)
        pts = cards.map((card, i) => { const [x, y] = lc(card), d = i - (N - 1) / 2; return [x, y + Math.abs(d) * -6 + (i % 2 ? 4 : -4), 0, 1, 20 - Math.round(Math.abs(d) * 2), '']; });
      } else if (kind === 'pose'){
        const sp = N > 1 ? Math.min(cw * .95, (W * 1.12 - cw * .8) / (N - 1)) : 0;
        pts = cards.map((_, i) => { const d = i - (N - 1) / 2, a = Math.abs(d), sg = d < 0 ? -1 : 1; return [cx + d * sp, cy - a * chh * .16 + chh * .08 + (i % 2 ? chh * .05 : -chh * .05), sg * (5 + a * 4) * (i % 2 ? 1 : -.6), 1.1 - a * .09, 20 - Math.round(a * 2), '']; });
      } else if (kind === 'pile'){
        pts = cards.map((_, i) => [cx + (Math.random() - .5) * cw * .6, cy + (Math.random() - .5) * chh * .35, (Math.random() - .5) * 50, .92, rand(20), p3d ? `translateZ(${i * 8}px) rotateX(${12 + rand(16)}deg)` : '']);
      } else if (kind === 'ring'){
        const R3 = Math.max(cw * .9, Math.min(W * .48, (N * cw * 1.15) / (2 * Math.PI)));
        cards.forEach((card, i) => {
          const [x, y] = lc(card);
          card.style.setProperty('--tx', cx - x + 'px'); card.style.setProperty('--ty', cy - y + 'px');
          card.style.setProperty('--a', (i / N) * 360 - 90 + 'deg');
          card.style.setProperty('--rx', (N === 1 ? 0 : rx) + 'px'); card.style.setProperty('--ry', (N === 1 ? 0 : ry) + 'px');
          card.style.setProperty('--r3', (N === 1 ? 0 : R3) + 'px');
          card.style.setProperty('--sc', Math.min(innerWidth <= 640 ? .78 : .92, (Math.PI * (rx + ry)) / (N * cw * 1.05)));
        });
        team.classList.add('ring-on');
        later(() => team.classList.add('ring-spin'), 950);
        return;
      }
      cards.forEach((card, i) => {
        const [x0, y0] = lc(card), [x, y, rot, s, z, extra] = pts[i];
        card.style.zIndex = z ?? '';
        card.style.transform = `translate(${x - x0}px, ${y - y0}px) ${extra || ''} rotate(${rot}deg) scale(${s})`;
      });
    });
  }

