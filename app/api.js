// Capa de datos: habla con el Worker (/api/*) y, si no hay Worker (npm run dev
// sin `wrangler dev`), cae a localStorage para jugadores y pachangas.
import { ls } from './util.js';

const LS_PLAYERS = 'brelio-players-v2';   // [{id, name, photo_key}]
const LS_PHOTOS = 'brelio-photos-local';  // {'local/<id>': dataURL}  (fotos subidas sin Worker)
const LS_MATCHES = 'brelio-matches';
const LS_FOLDERS = 'brelio-folders';

export const DEMO_PLAYERS = ['Lucía', 'Mateo', 'Sara', 'Pablo', 'Clara', 'Diego', 'Ana', 'Hugo'];
export const DEMO_PHOTOS = Array.from({ length: 8 }, (_, i) => `jugadores/p${i + 1}.jpg`);

class NoApi extends Error {}
export class AuthError extends Error {}

// 'remote' (Worker) | 'local' (localStorage) | 'unknown' (aún no sabemos)
export const backend = { mode: 'unknown', mediaApi: null, user: null };

let askKey = null; // lo pone la UI: () => Promise<string|null>
export const onAuthRequired = (fn) => { askKey = fn; };

async function req(path, { method = 'GET', json, form, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method, signal, credentials: 'same-origin',
      headers: json !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: json !== undefined ? JSON.stringify(json) : form,
    });
  } catch (e) { throw new NoApi(e.message); }
  if (res.status === 401) throw new AuthError('No autorizado');
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) throw new NoApi('Respuesta que no es JSON (¿sin Worker?)');
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status });
  return data;
}

async function login() {
  for (let i = 0; i < 3; i++) {
    const key = askKey ? await askKey(i > 0) : null;
    if (!key) return false;
    try { await req('/api/login', { method: 'POST', json: { key } }); return true; }
    catch (e) { if (!(e instanceof AuthError) && e.status !== 401) throw e; }
  }
  return false;
}

// ---- arranque ---------------------------------------------------------------
export async function init() {
  try {
    let rows;
    try { rows = await req('/api/players'); }
    catch (e) { if (e instanceof AuthError && await login()) rows = await req('/api/players'); else throw e; }
    backend.mode = 'remote';
    backend.cache = rows;
    req('/api/me').then((m) => { backend.user = m.user; }).catch(() => {});
  } catch (e) {
    backend.mode = 'local';
  }
  return backend.mode;
}

// ---- jugadores --------------------------------------------------------------
const localPlayers = () => ls.json(LS_PLAYERS, null);
const saveLocalPlayers = (list) => ls.setJson(LS_PLAYERS, list);

export const localPhotos = () => ls.json(LS_PHOTOS, {});

// URL de una clave de foto (R2 o local)
export function mediaUrl(key) {
  if (!key) return null;
  if (key.startsWith('data:')) return key;
  if (key.startsWith('local/')) return localPhotos()[key] || null;
  return '/media/' + key.split('/').map(encodeURIComponent).join('/');
}

// Datos antiguos (v1): lista de nombres + asignaciones de foto → formato nuevo
function legacyPlayers() {
  const names = ls.json('brelio-people', []);
  if (!names.length) return [];
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const assign = ls.json('brelio-assign', {});
  const extra = ls.json('brelio-photos-extra', []);
  const photos = localPhotos();
  return names.map((name) => {
    const id = assign[norm(name)];
    let key = null;
    if (/^p[1-8]$/.test(id || '')) key = `jugadores/${id}.jpg`;
    else if (id) { const ex = extra.find((x) => x.id === id); if (ex) { key = 'local/' + id; photos[key] = ex.src; } }
    return { id: crypto.randomUUID(), name, photo_key: key };
  }).map((p) => { ls.setJson(LS_PHOTOS, photos); return p; });
}

export async function listPlayers() {
  if (backend.mode === 'remote') {
    if (backend.cache) { const r = backend.cache; backend.cache = null; return r; }
    return req('/api/players');
  }
  let list = localPlayers();
  if (!list) {
    list = legacyPlayers();
    if (!list.length) list = DEMO_PLAYERS.map((name) => ({ id: crypto.randomUUID(), name, photo_key: null }));
    saveLocalPlayers(list);
  }
  return list;
}

export async function addPlayer(name, photo_key = null) {
  if (backend.mode === 'remote') return req('/api/players', { method: 'POST', json: { name, photo_key } });
  const list = localPlayers() || [];
  const p = { id: crypto.randomUUID(), name, photo_key };
  list.push(p); saveLocalPlayers(list);
  return p;
}

export async function removePlayer(id) {
  if (backend.mode === 'remote') return req('/api/players/' + encodeURIComponent(id), { method: 'DELETE' });
  saveLocalPlayers((localPlayers() || []).filter((p) => p.id !== id));
  return { ok: true };
}

export async function patchPlayer(id, fields) {
  if (backend.mode === 'remote') return req('/api/players/' + encodeURIComponent(id), { method: 'PATCH', json: fields });
  const list = localPlayers() || [];
  const p = list.find((x) => x.id === id);
  if (p) Object.assign(p, fields);
  saveLocalPlayers(list);
  return p;
}

// Importa una sola vez las asignaciones del localStorage v1 al Worker
export async function migrateLegacy(remotePlayers) {
  if (backend.mode !== 'remote' || ls.get('brelio-migrated-v2')) return false;
  const old = legacyPlayers();
  ls.set('brelio-migrated-v2', '1');
  if (!old.length) return false;
  const have = new Set(remotePlayers.map((p) => p.name.toLowerCase()));
  let n = 0;
  for (const p of old) {
    if (have.has(p.name.toLowerCase())) continue;
    let key = p.photo_key;
    if (key && key.startsWith('local/')) {
      try { const blob = await (await fetch(mediaUrl(key))).blob(); key = (await uploadMedia(new File([blob], p.name + '.jpg', { type: 'image/jpeg' }), 'jugadores')).key; }
      catch (e) { key = null; }
    }
    try { await addPlayer(p.name, key); n++; } catch (e) { /* ya existe o fallo suelto */ }
  }
  return n > 0;
}

// ---- recursos ---------------------------------------------------------------
export async function listMedia(folder) {
  try {
    const rows = await req('/api/media' + (folder ? '?folder=' + encodeURIComponent(folder) : ''));
    backend.mediaApi = true;
    return rows;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    backend.mediaApi = false;
    return [];
  }
}

// Sube un fichero con progreso. Devuelve la fila creada ({key, url, …}).
export function uploadMedia(file, folder, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('folder', folder || 'comun');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onerror = () => reject(new NoApi('Sin conexión con el Worker'));
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) { return reject(new NoApi('Sin Worker')); }
      if (xhr.status === 401) return reject(new AuthError('No autorizado'));
      if (xhr.status >= 400) return reject(new Error(data.error || 'Error ' + xhr.status));
      backend.mediaApi = true;
      resolve(Array.isArray(data) ? data[0] : data);
    };
    xhr.send(form);
  });
}

// Foto de avatar: R2 si hay Worker; si no, se queda en este navegador
export async function uploadPhoto(file, name) {
  if (backend.mode === 'remote' || backend.mediaApi !== false) {
    try { return (await uploadMedia(file, 'jugadores')).key; }
    catch (e) { if (!(e instanceof NoApi)) throw e; }
  }
  const key = 'local/u' + Date.now();
  const photos = localPhotos();
  photos[key] = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  if (!ls.setJson(LS_PHOTOS, photos)) throw new Error('Este navegador no tiene sitio para guardar la foto');
  return key;
}

export async function deleteMedia(key) {
  return req('/api/media/' + key.split('/').map(encodeURIComponent).join('/'), { method: 'DELETE' });
}

export const localFolders = () => ls.json(LS_FOLDERS, []);
export const saveLocalFolders = (f) => ls.setJson(LS_FOLDERS, f);

// ---- pachangas --------------------------------------------------------------
const slimTeams = (teams) => teams.map((t) => ({
  name: t.name, service: t.svc, price: t.price, status: t.status?.t,
  members: t.members.map((m) => ({ name: m.name, role: m.role || null, dx: m.dx })),
}));

export async function saveMatch(animation, teams) {
  const body = { animation, teams: slimTeams(teams) };
  if (backend.mode === 'remote') { try { return await req('/api/matches', { method: 'POST', json: body }); } catch (e) { return null; } }
  const list = ls.json(LS_MATCHES, []);
  const row = { id: crypto.randomUUID(), played_at: Date.now(), winner: null, ...body };
  list.unshift(row); ls.setJson(LS_MATCHES, list.slice(0, 50));
  return row;
}

export async function setWinner(id, winner) {
  if (!id) return null;
  if (backend.mode === 'remote') { try { return await req('/api/matches/' + encodeURIComponent(id), { method: 'PATCH', json: { winner } }); } catch (e) { return null; } }
  const list = ls.json(LS_MATCHES, []);
  const m = list.find((x) => x.id === id);
  if (m) { m.winner = winner; ls.setJson(LS_MATCHES, list); }
  return m;
}
