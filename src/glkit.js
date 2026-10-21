
  // ---------- base común para escenas Three.js ----------
  function glInit(opts = {}){
    const T = THREE, fx = $('#vsFx');
    const canvas = document.createElement('canvas'); canvas.className = 'three-cv'; fx.prepend(canvas);
    let W = innerWidth, H = innerHeight, renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch(e) { canvas.remove(); return null; }
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(W, H, false);
    renderer.outputEncoding = T.sRGBEncoding; renderer.setClearColor(opts.clear ?? 0x000000, 1);
    if (opts.clipping) renderer.localClippingEnabled = true;
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(opts.fov || 45, W / H, .1, 600);
    let composer = null;
    try { if (T.EffectComposer && T.UnrealBloomPass){ composer = new T.EffectComposer(renderer); composer.addPass(new T.RenderPass(scene, cam)); const b = opts.bloom || [.9, .5, .8]; composer.addPass(new T.UnrealBloomPass(new T.Vector2(W, H), b[0], b[1], b[2])); } } catch(e) { composer = null; }
    const onResize = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); composer && composer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); };
    addEventListener('resize', onResize);
    const tex = c => { const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; };
    let raf, fn = null; const t0 = performance.now(); let prev = t0;
    const loop = now => { const et = (now - t0) / 1000, dt = Math.min(.05, (now - prev) / 1000); prev = now; fn && fn(et, dt); composer ? composer.render() : renderer.render(scene, cam); raf = requestAnimationFrame(loop); };
    fxStop = () => {
      cancelAnimationFrame(raf); removeEventListener('resize', onResize);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { m.map && m.map.dispose(); m.dispose(); }); });
      try { renderer.dispose(); renderer.forceContextLoss(); } catch(e) {}
      canvas.remove();
    };
    return { T, scene, cam, renderer, tex, get W(){ return W; }, get H(){ return H; }, start(f){ fn = f; raf = requestAnimationFrame(loop); } };
  }
  function faceCanvas(name, color, img, label){
    const c = document.createElement('canvas'); c.width = 256; c.height = label ? 300 : 256; const g = c.getContext('2d');
    g.save(); g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.clip();
    if (img){ const s = Math.min(img.width, img.height); g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 16, 16, 224, 224); }
    else { g.font = '140px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emojiFor(name), 128, 140); }
    g.restore(); g.lineWidth = 12; g.strokeStyle = color; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
    if (label){
      g.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const w = Math.min(250, g.measureText(label).width + 26); rrect(g, 128 - w / 2, 252, w, 44, 14); g.fillStyle = '#120612'; g.fill(); g.fillStyle = '#fff'; g.fillText(label, 128, 275, 230);
    }
    return c;
  }
  function heartShape(T){
    const s = new T.Shape();
    s.moveTo(5, 5); s.bezierCurveTo(5, 5, 4, 0, 0, 0); s.bezierCurveTo(-6, 0, -6, 7, -6, 7); s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
    s.bezierCurveTo(12, 15.4, 16, 11, 16, 7); s.bezierCurveTo(16, 7, 16, 0, 10, 0); s.bezierCurveTo(7, 0, 5, 5, 5, 5);
    return s;
  }
  function heartGeo(T, size, depth){
    const g = new T.ExtrudeGeometry(heartShape(T), { depth: depth ?? 4, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 1.2, bevelThickness: 1.2, curveSegments: 18 });
    g.center(); g.rotateZ(Math.PI); g.scale(size / 22, size / 22, size / 22); return g;
  }
  function popSprite(ctx, text, pos, opts = {}){
    const { T } = ctx;
    const s = new T.Sprite(new T.SpriteMaterial({ map: ctx.tex(textCanvas(text, { size: opts.size || 150, w: 768, h: 220, grad: opts.grad || ['#fff59a', '#ffd23f', '#ff7a1a'], glow: opts.glow || '#ff2a4f', italic: true })), transparent: true, depthTest: false }));
    s.position.copy(pos); s.renderOrder = 999; ctx.scene.add(s);
    const h = opts.h || 1.6; s.userData = { t: 0, h, life: opts.life || .8 };
    return s;
  }
