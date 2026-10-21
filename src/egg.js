
  // =====================================================================
  //  EASTER EGG (variante Mati): 3 toques en su foto, o escribir "mati".
  //  Mati libera todo su poder.
  // =====================================================================
  let eggOn = false, tapN = 0, tapT = 0, keyBuf = '';
  function eggMati(){
    const layer = $('#vsLayer');
    if (!vsOpen || layer.dataset.variant !== 'mati' || eggOn) return;
    eggOn = true;
    const T = (fn, ms) => setTimeout(fn, ms);
    const S = synth(); S && S.riser(2.6); S && S.drone();
    const snd = $('#ventoSound');
    if (snd){ snd.preservesPitch = false; snd.mozPreservesPitch = false; snd.webkitPreservesPitch = false; snd.playbackRate = .72; }
    layer.classList.add('egg');
    const box = document.createElement('div'); box.className = 'egg-box';
    box.innerHTML = `<div class="egg-dark"></div>
      <div class="egg-flames"><i></i><i></i><i></i><i></i></div>
      <img class="egg-croc" alt="" src="${$('#matiCroc').src}">
      <img class="egg-man" alt="" src="${$('#matiHero').src}">
      <svg class="egg-bolts" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
      <div class="egg-rocks">${Array.from({ length: 14 }, () => `<i style="left:${Math.random() * 100}%;--d:${Math.random() * 1.6}s;--s:${14 + Math.random() * 34}px;--r:${(Math.random() - .5) * 720}deg">🪨</i>`).join('')}</div>
      <div class="egg-go">${Array.from({ length: 6 }, (_, i) => `<b style="left:${i % 2 ? 70 + Math.random() * 22 : 2 + Math.random() * 20}%;top:${8 + i * 14}%;--d:${.3 + i * .18}s">ゴ</b>`).join('')}</div>
      <div class="egg-meter"><span>NIVEL DE PODER</span><b>0</b></div>
      <div class="egg-roar">¡ROAAAAR!</div>
      <div class="egg-txt"><b>¡MATI!</b><small>POTENCIA MÁXIMA</small></div>
      <div class="egg-flash"></div>`;
    layer.appendChild(box);
    // rayos
    const svg = box.querySelector('.egg-bolts');
    const bolt = () => {
      let d = ''; for (let k = 0; k < 3; k++){
        let x = 50 + (Math.random() - .5) * 30, y = 100; d += `M${x} ${y}`;
        while (y > 5){ y -= 6 + Math.random() * 10; x += (Math.random() - .5) * 14; d += ` L${x.toFixed(1)} ${y.toFixed(1)}`; }
      }
      svg.innerHTML = `<path d="${d}" stroke="#fff6c8" stroke-width=".6" fill="none" vector-effect="non-scaling-stroke"/><path d="${d}" stroke="#ffd23f" stroke-width="5" opacity=".35" fill="none" vector-effect="non-scaling-stroke"/>`;
    };
    const bi = setInterval(bolt, 90);
    // contador de poder
    const meter = box.querySelector('.egg-meter b'); const t0 = performance.now();
    const mi = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / 2500), v = Math.floor(Math.pow(10, k * 7.2));
      meter.textContent = k >= 1 ? '∞' : v.toLocaleString('es-ES');
      if (k >= 1) clearInterval(mi);
    }, 40);
    T(() => { box.classList.add('croc'); S && S.boom(false); layer.classList.add('rushing'); }, 1250);
    T(() => {
      box.classList.add('boom'); S && S.boom(true); S && S.chord();
      if (snd) snd.playbackRate = 1;
      document.querySelectorAll('#vsArena .vs-card').forEach((c, i) => { c.style.setProperty('--kx', (Math.random() - .5) * 60 + 'px'); c.style.setProperty('--kr', (Math.random() - .5) * 40 + 'deg'); c.classList.add('egg-hit'); });
    }, 2650);
    T(() => layer.classList.remove('rushing'), 3500);
    T(() => { box.classList.add('out'); layer.classList.remove('egg'); }, 4700);
    T(() => {
      // los rayos se quedan hasta el final de la animación
      if (vsOpen && !$('.egg-after')){
        const af = document.createElement('div'); af.className = 'egg-after'; af.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"></svg>';
        $('#vsFx').appendChild(af);
        const sv = af.querySelector('svg');
        const draw = () => {
          let d = ''; const n = 2 + rand(3);
          for (let k = 0; k < n; k++){
            let x = Math.random() * 100, y = -2; d += `M${x.toFixed(1)} ${y}`;
            const len = 35 + Math.random() * 70;
            while (y < len){ y += 4 + Math.random() * 8; x += (Math.random() - .5) * 10; d += ` L${x.toFixed(1)} ${y.toFixed(1)}`; }
          }
          sv.innerHTML = Math.random() < .25 ? '' : `<path d="${d}" stroke="#fff6c8" stroke-width="1.4" fill="none" vector-effect="non-scaling-stroke"/><path d="${d}" stroke="#ffd23f" stroke-width="6" opacity=".3" fill="none" vector-effect="non-scaling-stroke"/>`;
        };
        draw(); vsTimers.push(setInterval(draw, 110));
      }
    }, 4600);
    T(() => {
      clearInterval(bi); clearInterval(mi); box.remove(); S && S.close();
      document.querySelectorAll('#vsArena .vs-card.egg-hit').forEach(c => c.classList.remove('egg-hit'));
      eggOn = false;
    }, 5400);
  }
  $('#vsHero').addEventListener('click', e => {
    if ($('#vsLayer').dataset.variant !== 'mati') return;
    e.stopPropagation();
    const now = performance.now(); tapN = now - tapT < 700 ? tapN + 1 : 1; tapT = now;
    if (tapN >= 3){ tapN = 0; eggMati(); }
  });
  addEventListener('keydown', e => {
    if (!vsOpen || e.key.length !== 1) return;
    keyBuf = (keyBuf + e.key.toLowerCase()).slice(-4);
    if (keyBuf === 'mati') eggMati();
  });

  // ---- giro final del ganador en la variante Mati: el verdadero ganador es Mati ----
  let twistShark = false;
  function matiTwist(){
    twistShark = Math.random() < .5;
    const layer = $('#vsLayer'), fx = $('#vsFx'), S = synth();
    S && S.zap(1600); S && S.zap(900);
    const snd = $('#ventoSound'); if (snd){ snd.preservesPitch = false; snd.playbackRate = .55; }
    const q = document.createElement('div'); q.className = 'tw-q'; q.textContent = '…¿o no?'; fx.appendChild(q);
    later(() => {
      if (snd) snd.playbackRate = 1;
      S && S.boom(true); S && S.riser(.6);
      impactFrame(); layer.classList.add('twist', 'rushing');
      document.querySelectorAll('#vsArena .vs-card').forEach((c, i) => { c.style.setProperty('--kx', (i % 2 ? 1 : -1) * (60 + Math.random() * 30) + 'vw'); c.style.setProperty('--kr', (Math.random() - .5) * 720 + 'deg'); });
      const t = $('#vsTitle'); t.textContent = 'El verdadero ganador es…';
      t.classList.remove('tw-pop'); void t.offsetWidth; t.classList.add('tw-pop');
      const box = document.createElement('div'); box.className = 'tw-box' + (twistShark ? ' shark' : '');
      const man = $('#matiHero').src, croc = $('#matiCroc').src;
      const front = twistShark ? croc : man, stand = twistShark ? man : croc;
      const who = twistShark ? 'EL TIBURÓN' : 'MATI', sName = twistShark ? 'MATI' : 'EL TIBURÓN';
      box.innerHTML = `<div class="egg-flames"><i></i><i></i><i></i><i></i></div><div class="tw-summon"></div>` +
        `<div class="tw-stand"><img alt="" src="${stand}"></div><img class="tw-front" alt="" src="${front}">` +
        `<div class="tw-sname">「 Stand: ${sName} 」</div><div class="tw-cup">🏆</div><div class="tw-name">${who}</div>`;
      later(() => { S && S.boom(false); impactFrame(); }, 1150);
      fx.appendChild(box);
      later(() => { layer.classList.remove('rushing'); S && S.chord(); }, 900);
      later(() => S && S.close(), 5200);
    }, 1100);
  }
