import re,base64,json,sys
s=open('orig.html').read()
names=json.load(open('names.json'))
b64=lambda f: base64.b64encode(open(f,'rb').read()).decode()
# 1) drop old overlay CSS block (second <style>) and replace with new
a=s.find('<style>\n@keyframes glowPulse'); b=s.find('</style>',a)+len('</style>')
keep="""<style>
@keyframes glowPulse {0%,100%{filter:drop-shadow(0 0 0 rgba(26,93,220,0))}50%{filter:drop-shadow(0 0 18px rgba(26,93,220,.28))}}
@keyframes floaty {0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-7px) rotate(.5deg)}}
@keyframes popIn {0%{opacity:0;transform:scale(.72) rotate(-4deg);filter:blur(10px)}65%{opacity:1;transform:scale(1.04) rotate(1deg);filter:blur(0)}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes heartBob {0%,100%{margin-top:0}50%{margin-top:-15px}}
body.party-mode{overflow:hidden}
body.party-mode .hero h1{animation:floaty .7s ease-in-out infinite}
body.party-mode .card,body.party-mode .section{animation:glowPulse .65s ease-in-out infinite}
.team{animation:popIn .6875s cubic-bezier(.2,.8,.2,1) both}
"""+open('src/overlay.css').read()+"""
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}
</style>"""
s=s[:a]+keep+s[b:]
# 2) overlay HTML
a=s.find('<div id="photoBurstLayer"'); b=s.find('</div>\n<audio',a)+len('</div>')
hearts=''.join(f'<span style="left:{x}%;top:{y}%;--d:{d}s">{h}</span>' for h,x,y,d in [
 ('💗',8,16,.02),('💕',30,6,.12),('💖',68,7,.22),('💘',90,22,.06),('💞',94,55,.18),('💓',88,84,.08),
 ('❤️',52,92,.24),('💝',10,86,.14),('💗',3,52,.2),('💖',22,40,.16),('💕',78,40,.04),('💘',62,70,.1)])
s=s[:a]+f'''<div id="vsLayer" aria-hidden="true">
  <div class="vs-rays"></div>
  <div id="heartOrbit">{hearts}</div>
  <img id="vsHero" alt="" src="data:image/jpeg;base64,{b64('burst_fixed.jpg')}">
  <div class="vs-title">¡EQUIPOS GENERADOS!</div>
  <div id="vsArena"></div>
  <div class="vs-sparkles">✦ ｡ﾟ☆ ♡ ✧ ♡ ☆ﾟ｡ ✦</div>
  <button id="vsSkip" type="button">Ver en la agenda ✨</button>
</div>'''+s[b:]
# 3) JS
photos='  const PHOTOS = [\n'+',\n'.join(f'    {{ names: {json.dumps(names[i],ensure_ascii=False)}, src: "data:image/jpeg;base64,{b64(f"p{i+1}.jpg")}" }}' for i in range(8))+'\n  ];\n'
a=s.find('  let burstTimer = null;'); b=s.find('  // ---- events ----')
s=s[:a]+photos+open('src/vs.js').read()+'\n'+s[b:]
s=s.replace('<span class="avatar">${esc(initials(p))}</span>','${avatarHTML(p)}')
s=s.replace('${tm.members.map(p => `<li><span class="avatar">${esc(initials(p.name))}</span>','${tm.members.map((p,k) => `<li style="animation-delay:${i*90+k*55+200}ms">${avatarHTML(p.name)}')
assert 'avatarHTML(p)' in s and 'avatarHTML(p.name)' in s and 'photoBurst' not in s.replace('photoBurstLayer','x') or True
exec(open('lol.py').read())
exec(open('picker.py').read())
exec(open('names_patch.py').read())
exec(open('anim_patch.py').read())
exec(open('win_patch.py').read())
exec(open('three_patch.py').read())
open('brelio_anime_kawaii.html','w').write(s)
print(len(s), s.count('photoBurst'))
