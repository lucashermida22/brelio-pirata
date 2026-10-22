// Página «Recursos»: arrastra ficheros, elige carpeta, sube con progreso y gestiona la biblioteca.
import { $, esc, toast, bytes } from './util.js';
import * as api from './api.js';
import { state } from './state.js';
import { render } from './ui.js';

const DEFAULT_FOLDERS = ['comun', 'jugadores'];
let rows = [];          // recursos del servidor
let filter = '';        // carpeta filtrada ('' = todas)
let uploadFolder = 'comun';
let audio = null, audioKey = null;
const ICON = {
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
};

const folders = () => [...new Set([...DEFAULT_FOLDERS, ...api.localFolders(), ...rows.map((r) => r.folder)])].sort();
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

function paintFolderSelect() {
  const sel = $('#recFolder');
  sel.innerHTML = folders().map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('') + '<option value="__new">＋ Nueva carpeta…</option>';
  sel.value = folders().includes(uploadFolder) ? uploadFolder : 'comun';
}

function paintChips() {
  const count = (f) => rows.filter((r) => !f || r.folder === f).length;
  $('#recFolders').innerHTML = [''].concat(folders()).map((f) =>
    `<button class="chip" type="button" data-f="${esc(f)}" aria-pressed="${filter === f}">${f ? esc(f) : 'Todas'} <b>${count(f)}</b></button>`).join('');
}

function preview(r) {
  const u = esc(r.url);
  if (r.type.startsWith('image/')) return `<span class="rthumb"><img src="${u}" alt="" loading="lazy"></span>`;
  if (r.type.startsWith('audio/')) return `<button class="rthumb rplay" type="button" data-play="${esc(r.key)}" aria-label="Escuchar">${ICON.play}</button>`;
  if (r.type.startsWith('video/')) return `<button class="rthumb rvid" type="button" data-vid="${esc(r.key)}" aria-label="Ver"><video src="${u}#t=0.1" preload="metadata" muted playsinline loop></video></button>`;
  return `<span class="rthumb">${ICON.file}</span>`;
}

function paintList() {
  const list = rows.filter((r) => !filter || r.folder === filter);
  $('#recEmpty').hidden = list.length > 0;
  $('#recList').innerHTML = list.map((r) => `
    <li class="rrow" data-key="${esc(r.key)}">
      ${preview(r)}
      <span class="rinfo"><span class="rkey" title="${esc(r.key)}">${esc(r.key)}</span><span class="rmeta">${esc(r.type.split('/')[0])} · ${bytes(r.size)}${r.uploaded_by ? ' · ' + esc(r.uploaded_by) : ''}</span></span>
      <button class="x" type="button" data-copy="${esc(r.key)}" title="Copiar clave" aria-label="Copiar clave">${ICON.copy}</button>
      <button class="x" type="button" data-del="${esc(r.key)}" title="Borrar" aria-label="Borrar">${ICON.del}</button>
    </li>`).join('');
}

function paintAll() { paintFolderSelect(); paintChips(); paintList(); }

export async function showRecursos() {
  await refresh();
}

async function refresh() {
  try { rows = await api.listMedia(); }
  catch (e) { rows = []; toast('No se pudo cargar la biblioteca: ' + e.message); }
  const off = api.backend.mediaApi === false;
  $('#drop').classList.toggle('off', off);
  $('#recFiles').disabled = off;
  $('#recHint').textContent = off
    ? 'Sin Worker no se pueden subir recursos. Arranca `npm run dev` (guarda en media/) o `wrangler dev`.'
    : api.backend.mode === 'remote' ? 'Se guardan en R2: las canciones y fotos las ve todo el grupo.' : 'En local se guardan en la carpeta media/ del repo.';
  paintAll();
}

// ---- subida ----
const MAX = 40 * 1024 * 1024;
async function upload(files) {
  const list = [...files].filter((f) => /^(image|audio|video)\//.test(f.type) || /\.(mp3|wav|ogg|m4a|jpe?g|png|gif|webp|avif|webm|mp4)$/i.test(f.name));
  if (files.length && !list.length) { toast('Solo valen audio, imágenes y vídeo'); return; }
  const ul = $('#uploads');
  for (const file of list) {
    const li = document.createElement('li');
    li.className = 'urow';
    li.innerHTML = `<span class="uname">${esc(file.name)}</span><span class="ustate">Subiendo…</span><span class="ubar"><i></i></span>`;
    ul.prepend(li);
    const bar = li.querySelector('i'), st = li.querySelector('.ustate');
    if (file.size > MAX) { li.classList.add('err'); st.textContent = 'Pesa más de 40 MB'; continue; }
    try {
      const row = await api.uploadMedia(file, uploadFolder, (p) => { bar.style.width = Math.round(p * 100) + '%'; st.textContent = Math.round(p * 100) + '%'; });
      bar.style.width = '100%'; li.classList.add('ok'); st.textContent = row.key;
      rows.unshift(row);
      paintAll();
    } catch (e) {
      li.classList.add('err'); st.textContent = e.message || 'No se pudo subir';
    }
  }
}

// ---- eventos ----
function stopAudio() { if (audio) { audio.pause(); audio = null; } $('#recList').querySelectorAll('.rplay').forEach((b) => { b.innerHTML = ICON.play; }); audioKey = null; }

export function initRecursos() {
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'dragend'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (!drop.classList.contains('off')) upload(e.dataTransfer.files); });
  // soltar un fichero fuera del recuadro no debe abrirlo en el navegador
  ['dragover', 'drop'].forEach((ev) => addEventListener(ev, (e) => { if (document.body.dataset.view === 'recursos') e.preventDefault(); }));
  $('#recFiles').addEventListener('change', (e) => { upload(e.target.files); e.target.value = ''; });

  $('#recFolder').addEventListener('change', (e) => {
    if (e.target.value === '__new') { $('#newFolderRow').hidden = false; $('#newFolder').focus(); return; }
    uploadFolder = e.target.value; $('#newFolderRow').hidden = true;
  });
  $('#newFolderRow').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = slug($('#newFolder').value);
    if (!name) { toast('Pon un nombre de carpeta (letras y números)'); return; }
    api.saveLocalFolders([...new Set([...api.localFolders(), name])]);
    uploadFolder = name; $('#newFolder').value = ''; $('#newFolderRow').hidden = true;
    paintFolderSelect();
    toast(`Carpeta «${name}» lista: sube algo y se crea`);
  });

  $('#recFolders').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; filter = b.dataset.f; paintChips(); paintList(); });
  $('#recRefresh').addEventListener('click', refresh);

  $('#recList').addEventListener('click', async (e) => {
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      try { await navigator.clipboard.writeText(cp.dataset.copy); toast('Clave copiada: ' + cp.dataset.copy); }
      catch (err) { toast(cp.dataset.copy); }
      return;
    }
    const pl = e.target.closest('[data-play]');
    if (pl) {
      const key = pl.dataset.play, was = audioKey === key;
      stopAudio();
      if (was) return;
      audio = new Audio(api.mediaUrl(key)); audioKey = key;
      audio.addEventListener('ended', stopAudio);
      audio.play().catch(() => toast('No se pudo reproducir'));
      pl.innerHTML = ICON.pause;
      return;
    }
    const vd = e.target.closest('[data-vid]');
    if (vd) { const v = vd.querySelector('video'); if (v.paused) v.play(); else v.pause(); return; }
    const dl = e.target.closest('[data-del]');
    if (dl) {
      if (!dl._armed) { dl._armed = true; dl.classList.add('armed'); toast('Pulsa otra vez para borrarlo'); dl._t = setTimeout(() => { dl._armed = false; dl.classList.remove('armed'); }, 3000); return; }
      try {
        await api.deleteMedia(dl.dataset.del);
        rows = rows.filter((r) => r.key !== dl.dataset.del);
        if (audioKey === dl.dataset.del) stopAudio();
        // los jugadores que usaban esa foto se quedan sin ella
        state.players.forEach((p) => { if (p.photo_key === dl.dataset.del) p.photo_key = null; });
        paintAll(); render();
        toast('Recurso borrado');
      } catch (err) { toast('No se pudo borrar: ' + err.message); }
    }
  });
  addEventListener('hashchange', () => { if (location.hash !== '#recursos') stopAudio(); });
}
