# ids for built-in photos, names empty (manual association)
s=s.replace('  const PHOTOS = [\n','  const PHOTOS = [\n',1)
import re
k=[0]
def addid(m):
    k[0]+=1; return '    { id: "p%d", names: [], src:' % k[0]
s=re.sub(r'    \{ names: \[[^\]]*\], src:', addid, s)
assert k[0]==8
rep=[
('<ul class="plist" id="people"></ul>', '''<p class="pick-tip">Toca el avatar de un paciente para ponerle su foto.</p>
                <ul class="plist" id="people"></ul>'''),
('${avatarHTML(p)}\n        <span class="nm">', '<button class="av-btn" type="button" data-pick="${i}" title="Elegir foto de ${esc(p)}">${avatarHTML(p)}</button>\n        <span class="nm">'),
('<div class="toast" id="toast"></div>', '''<div class="picker" id="picker" hidden>
  <div class="picker-card" role="dialog" aria-modal="true" aria-labelledby="pickTitle">
    <div class="picker-head">
      <div><p class="sec-title" id="pickTitle">Foto de</p><p class="sec-sub">Elige su foto. Se guarda en este navegador.</p></div>
      <button class="x" id="pickClose" type="button" aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="pick-grid" id="pickGrid"></div>
    <div class="pick-actions">
      <button class="btn" id="pickEmoji" type="button">Sin foto (emoji)</button>
      <label class="btn" for="pickUpload"><svg viewBox="0 0 24 24"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>Subir foto</label>
      <input id="pickUpload" type="file" accept="image/*" hidden>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>'''),
("  $('#people').addEventListener('click', e => {\n", '''  // ---- selector de fotos ----
  let pickName = null;
  function openPicker(name){
    pickName = name;
    $('#pickTitle').textContent = 'Foto de ' + name;
    const cur = norm(name);
    const owner = id => people.filter(p => ASSIGN[norm(p)] === id);
    $('#pickGrid').innerHTML = allPhotos().map(ph => {
      const own = owner(ph.id), sel = ASSIGN[cur] === ph.id || (!(cur in ASSIGN) && photoFor(name) === ph.src);
      return `<button class="pick-ph${sel ? ' sel' : ''}" type="button" data-id="${ph.id}"><img src="${ph.src}" alt=""><span>${own.length ? esc(own.join(', ')) : 'Libre'}</span></button>`;
    }).join('');
    $('#picker').hidden = false;
  }
  function closePicker(){ $('#picker').hidden = true; pickName = null; }
  function setPhoto(id){
    if (!pickName) return;
    ASSIGN[norm(pickName)] = id;
    const ok = saveAssign();
    render(); if (lastTeams) showTeams(lastTeams);
    toast(ok ? (id === 'emoji' ? `${pickName} va sin foto` : `Foto asignada a ${pickName}`) : 'Asignada, pero este navegador no la guardará');
    closePicker();
  }
  $('#pickGrid').addEventListener('click', e => { const b = e.target.closest('.pick-ph'); if (b) setPhoto(b.dataset.id); });
  $('#pickEmoji').addEventListener('click', () => setPhoto('emoji'));
  $('#pickClose').addEventListener('click', closePicker);
  $('#picker').addEventListener('click', e => { if (e.target.id === 'picker') closePicker(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#picker').hidden) closePicker(); });
  $('#pickUpload').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const S = 320, c = document.createElement('canvas'); c.width = c.height = S;
      const m = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
      URL.revokeObjectURL(url);
      const id = 'u' + Date.now();
      EXTRA.push({ id, names: [], src: c.toDataURL('image/jpeg', .82) });
      setPhoto(id);
    };
    img.onerror = () => toast('No se pudo leer esa imagen');
    img.src = url;
  });

  $('#people').addEventListener('click', e => {
    const pk = e.target.closest('.av-btn'); if (pk){ openPicker(people[+pk.dataset.pick]); return; }
'''),
# confirm() doesn't work inside the artifact viewer: in-page double tap instead
("    if (confirm('¿Dar de alta a todos los pacientes? (borra la lista)')){ people=[]; save(); render(); }", '''    const b = $('#clearAll');
    if (!b._armed){ b._armed = true; toast('Pulsa otra vez para dar de alta a todos'); clearTimeout(b._t); b._t = setTimeout(() => b._armed = false, 3000); return; }
    b._armed = false; people = []; save(); render(); toast('Lista vaciada');'''),
(".team .members li{animation", '''.pick-tip{font-size:12px;color:var(--muted);margin:10px 0 0}
.av-btn{padding:0;border:0;background:none;border-radius:999px;cursor:pointer;flex:none;transition:transform .15s}
.av-btn:hover{transform:scale(1.12)}
.av-btn:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.picker[hidden]{display:none}
.picker{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:16px;background:rgba(24,24,27,.38);backdrop-filter:blur(4px)}
.picker-card{width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:var(--r-card);box-shadow:var(--shadow-card);padding:16px;display:flex;flex-direction:column;gap:12px;animation:popIn .35s cubic-bezier(.2,.8,.2,1) both}
.picker-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.picker-head .sec-sub{margin-bottom:0}
.pick-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
@media (max-width:420px){.pick-grid{grid-template-columns:repeat(3,1fr)}}
.pick-ph{display:flex;flex-direction:column;gap:4px;padding:4px;border:1px solid var(--ring);border-radius:var(--r-ctl);background:#fff;cursor:pointer;min-width:0}
.pick-ph img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block}
.pick-ph span{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
.pick-ph:hover{border-color:var(--line)}
.pick-ph.sel{border-color:var(--focus);box-shadow:0 0 0 3px #0385f733}
.pick-ph.sel span{color:var(--focus);font-weight:500}
.pick-actions{display:flex;gap:8px;flex-wrap:wrap}
.pick-actions .btn{flex:1}
.team .members li{animation'''),
]
for a,b in rep:
    assert s.count(a)==1, a
    s=s.replace(a,b)
