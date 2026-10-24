// Selector de foto de un jugador: elige una existente, sube una nueva o déjalo con emoji.
import { $, esc, toast, norm } from './util.js';
import { state } from './state.js';
import * as api from './api.js';

let pickId = null;       // jugador que está eligiendo foto
let onChange = () => {};
let library = [];        // claves de foto disponibles

export const photoLibrary = () => library;

// Fotos disponibles = carpeta «jugadores» (R2) + las que ya tengan los jugadores + las locales
export async function refreshLibrary() {
  let keys = [];
  if (api.backend.mode === 'remote' || api.backend.mediaApi !== false) {
    const rows = await api.listMedia('jugadores');
    keys = rows.filter((r) => r.type.startsWith('image/')).map((r) => r.key);
  }
  if (!keys.length && api.backend.mode !== 'remote') keys = [...api.DEMO_PHOTOS];
  Object.keys(api.localPhotos()).forEach((k) => keys.push(k));
  state.players.forEach((p) => { if (p.photo_key && !keys.includes(p.photo_key)) keys.push(p.photo_key); });
  library = [...new Set(keys)];
  state.pool = library.map((k) => api.mediaUrl(k)).filter(Boolean);
  return library;
}

export async function openPicker(id) {
  const p = state.players.find((x) => x.id === id); if (!p) return;
  pickId = id;
  $('#pickTitle').textContent = 'Foto de ' + p.name;
  $('#pickSub').textContent = api.backend.mode === 'remote' ? 'Elige su foto. Se guarda para todo el grupo.' : 'Elige su foto. Se guarda en este navegador.';
  $('#picker').hidden = false;
  await refreshLibrary();
  paint();
}

function paint() {
  const p = state.players.find((x) => x.id === pickId); if (!p) return;
  $('#pickGrid').innerHTML = library.map((key) => {
    const owners = state.players.filter((q) => q.photo_key === key).map((q) => q.name);
    const sel = p.photo_key === key;
    return `<button class="pick-ph${sel ? ' sel' : ''}" type="button" data-key="${esc(key)}"><img decoding="async" loading="lazy" src="${esc(api.mediaUrl(key))}" alt=""><span>${owners.length ? esc(owners.join(', ')) : 'Libre'}</span></button>`;
  }).join('');
}

function close() { $('#picker').hidden = true; pickId = null; }

async function assign(key) {
  const p = state.players.find((x) => x.id === pickId); if (!p) return;
  try {
    await api.patchPlayer(p.id, { photo_key: key });
    p.photo_key = key;
    toast(key ? `Foto asignada a ${p.name}` : `${p.name} va sin foto`);
  } catch (e) { toast('No se pudo guardar: ' + e.message); }
  close(); onChange();
}

// Recorta en cuadrado y reduce (como siempre): sale un JPG pequeño
function squareJpeg(file, size = 512) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const m = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/jpeg', .85);
    };
    img.onerror = () => rej(new Error('No se pudo leer esa imagen'));
    img.src = url;
  });
}

export function initPicker(changed) {
  onChange = changed;
  $('#pickGrid').addEventListener('click', (e) => { const b = e.target.closest('.pick-ph'); if (b) assign(b.dataset.key); });
  $('#pickEmoji').addEventListener('click', () => assign(null));
  $('#pickClose').addEventListener('click', close);
  $('#picker').addEventListener('click', (e) => { if (e.target.id === 'picker') close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#picker').hidden) close(); });
  $('#pickUpload').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const p = state.players.find((x) => x.id === pickId); if (!p) return;
    try {
      const blob = await squareJpeg(f);
      const key = await api.uploadPhoto(new File([blob], norm(p.name).replace(/ /g, '-') + '.jpg', { type: 'image/jpeg' }), p.name);
      await assign(key);
    } catch (err) { toast(err.message || 'No se pudo subir la foto'); }
  });
}
