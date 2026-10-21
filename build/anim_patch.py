b64a=lambda f: base64.b64encode(open(f,'rb').read()).decode()
rep=[
('family=Geist:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap',
 'family=Geist:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Cinzel:wght@600;700;800&family=Orbitron:wght@700;900&family=Anton&family=Bungee&display=swap'),
('  <div class="vs-title">¡EQUIPOS GENERADOS!</div>\n', '  <div class="vs-title" id="vsTitle">¡EQUIPOS GENERADOS!</div>\n  <div class="vs-sub" id="vsSub"></div>\n'),
('  <div class="vs-rays"></div>\n', '  <div class="vs-rays"></div>\n  <div id="vsFx"></div>\n'),
('<audio id="teamSound"', '<audio id="teamSound" class="vs-snd"'),
('<div class="toast" id="toast"></div>', '<audio id="uniSound" class="vs-snd" preload="auto" src="data:audio/mpeg;base64,%s"></audio>\n<audio id="ggezSound" class="vs-snd" preload="auto" src="data:audio/mpeg;base64,%s"></audio>\n<audio id="gargSound" class="vs-snd" preload="auto" src="data:audio/mpeg;base64,%s"></audio>\n<audio id="ventoSound" class="vs-snd" preload="auto" src="data:audio/mpeg;base64,%s"></audio>\n<img id="matiBg" hidden alt="" src="data:image/jpeg;base64,%s">\n<img id="matiHero" hidden alt="" src="data:image/jpeg;base64,%s">\n<img id="matiCroc" hidden alt="" src="data:image/jpeg;base64,%s">\n<audio id="choqueSound" class="vs-snd" preload="auto" src="data:audio/mpeg;base64,%s"></audio>\n<audio id="drownSound" class="vs-snd" preload="auto" src="data:audio/mpeg;base64,%s"></audio>\n<audio id="bruhSound" preload="auto" src="data:audio/mpeg;base64,%s"></audio>\n<div class="toast" id="toast"></div>' % tuple(b64a('aud/'+f) for f in ['uni_c.mp3','ggez_c.mp3','garg_c.mp3','vento_c.mp3','../mati_bg.jpg','../mati_hero.jpg','../mati_croc.jpg','choque_c.mp3','drown_c.mp3','bruh.mp3'])),
('<button class="btn block lol-toggle" id="lol"', '<label class="anim-row" for="animSel"><span>Animación</span><select class="field" id="animSel"></select></label>\n                <button class="btn block lol-toggle" id="lol"'),
(".team .members li{animation", open('src/themes.css').read() + open('src/jojo.css').read() + "\n.team .members li{animation"),
]
for a,b in rep:
    assert s.count(a)==1, a[:60]
    s=s.replace(a,b)
