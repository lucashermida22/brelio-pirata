const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Capturas de una animación en Chromium headless (WebGL por software).
// uso: NODE_PATH=$(npm root -g) node scripts/shot.cjs <id> <prefijo_salida> [ms_entre_capturas] [n] [url] [ancho] [alto] [teclas]
//   ej.: node scripts/shot.cjs furious /tmp/ff 2500 6 http://localhost:4177/ 960 540 nuclear
//   window.__ffSpeed acelera Fast & Furious (se fija con FF_SPEED=4). Los .mp4 no se decodifican en headless.
const [id, out, wait, nShots, url0, w0, h0, keys] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: +(w0 || 960), height: +(h0 || 540) } });
  if (process.env.FF_SPEED) await p.addInitScript(s => { window.__ffSpeed = +s; }, process.env.FF_SPEED);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/TUNNEL|favicon/.test(m.text()) && errs.push(m.type()+': '+m.text().slice(0,200)));
  await p.goto(url0 || 'http://localhost:4177/'); await sleep(1500);
  await p.selectOption('#animSel', id); await p.click('#go');
  if (keys){ await sleep(3000); await p.keyboard.type(keys); }
  for (let i = 0; i < +(nShots || 3); i++){ await sleep(+(wait||3000)); await p.screenshot({ path: `${out}_${i}.png` }); }
  console.log(JSON.stringify(errs.slice(0,12))); await b.close();
})();
