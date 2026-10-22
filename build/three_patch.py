HEAD_SCRIPTS = """<script defer src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js"></script>
"""
THREE_CSS = open("src/endshapes.css").read() + open("src/egg.css").read() + open("src/p3d.css").read() + open("src/furious.css").read() + """.three-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
.three-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
.three-flash.go{animation:threeFlash 1.1s ease-out}
@keyframes threeFlash{0%{opacity:0}6%{opacity:1}100%{opacity:0}}
#vsLayer[data-anim="three"]{background:#03000c}
#vsLayer[data-anim="three"] #vsHero{display:none}
#vsLayer[data-anim="three"] .vs-title{z-index:2;font:900 clamp(26px,5vw,62px)/1 "Orbitron",system-ui,sans-serif;letter-spacing:.24em;-webkit-text-stroke:0;text-shadow:none;color:transparent;
  background:linear-gradient(90deg,#7ff8ff,#b38bff,#ff5bd2,#ffd27a,#7ff8ff);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 0 14px rgba(179,139,255,.7))}
#vsLayer[data-anim="three"].up .vs-title{animation:singIn 1.1s cubic-bezier(.2,.8,.2,1) .4s both,iris 4s linear 1.5s infinite}
@keyframes singIn{from{opacity:0;letter-spacing:1.2em;filter:blur(12px)}to{opacity:1}}
@keyframes iris{to{background-position:-300% 0}}
#vsLayer[data-anim="three"] .vs-sub{z-index:2;font:700 clamp(10px,1.1vw,13px)/1 "Orbitron",sans-serif;letter-spacing:.34em;text-transform:uppercase;color:#b9a6ff}
#vsLayer[data-anim="three"] #vsSkip{z-index:2;background:rgba(255,255,255,.08);color:#fff;box-shadow:inset 0 0 0 1px rgba(185,166,255,.6),0 0 24px rgba(179,139,255,.5);backdrop-filter:blur(6px);font:800 13px/1 "Orbitron",sans-serif;letter-spacing:.14em;text-transform:uppercase}
#vsLayer[data-anim="three"].shake{animation:none}
"""
rep = [
    ('<link href="https://fonts.googleapis.com/css2?', HEAD_SCRIPTS + '<link href="https://fonts.googleapis.com/css2?'),
    (".team .members li{animation", THREE_CSS + ".team .members li{animation"),
    ("  // ---- events ----", open('src/three3d.js').read() + open('src/gg3d.js').read() + open('src/earth3d.js').read() + open('src/egg.js').read() + open('src/glkit.js').read() + open('src/feria3d.js').read() + open('src/tinder3d.js').read() + open('src/furious3d.js').read().replace('__FF_TORETTO__', 'data:image/jpeg;base64,' + __import__('base64').b64encode(open('ff_toretto.jpg','rb').read()).decode()).replace('__FF_PAUL__', 'data:image/jpeg;base64,' + __import__('base64').b64encode(open('ff_paul.jpg','rb').read()).decode()) + "\n  // ---- events ----"),
]
for a, b in rep:
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)
