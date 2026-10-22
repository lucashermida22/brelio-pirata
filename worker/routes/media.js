// Recursos: /api/media (D1 + R2) y /media/<clave> (servir desde R2)
import { HttpError, json } from '../http.js';

const MAX_BYTES = 40 * 1024 * 1024; // límite por fichero
const ALLOWED = /^(image|audio|video)\//;
const KEY_RE = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)+$/;

// Tipos por extensión, por si el navegador manda application/octet-stream
const EXT_TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', webm: 'video/webm', mp4: 'video/mp4' };
const TYPE_EXTS = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'video/webm': 'webm', 'video/mp4': 'mp4' };

const slug = (s, fallback) => String(s ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || fallback;
const rand5 = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => (b % 36).toString(36)).join('');
const fileExt = (name) => (/\.([a-z0-9]{1,5})$/i.exec(name || '')?.[1] || '').toLowerCase();
const isFile = (v) => v && typeof v === 'object' && typeof v.arrayBuffer === 'function';

// Clave de la URL (con barras) -> validada y sin ".."
function keyFrom(raw) {
  let key;
  try { key = decodeURIComponent(raw); } catch { throw new HttpError(400, 'Clave inválida'); }
  if (!KEY_RE.test(key) || key.split('/').includes('..')) throw new HttpError(400, 'Clave inválida');
  return key;
}

// Valida el fichero y devuelve su content-type
function checkFile(file) {
  const ext = fileExt(file.name);
  let type = (file.type || '').split(';')[0].trim().toLowerCase();
  if (!type || type === 'application/octet-stream') type = EXT_TYPES[ext] || type;
  if (!ALLOWED.test(type)) throw new HttpError(415, `Tipo no permitido (${type || 'desconocido'}): solo image/*, audio/* y video/*`);
  if (file.size > MAX_BYTES) throw new HttpError(413, `Fichero demasiado grande (máx. ${MAX_BYTES / 1024 / 1024} MB)`);
  return type;
}

const withUrl = (r) => ({ ...r, url: `/media/${r.key}` });

// ---- /api/media -------------------------------------------------------------
async function list({ env, url }) {
  const folder = url.searchParams.get('folder');
  const q = folder
    ? env.DB.prepare('SELECT * FROM media WHERE folder = ? ORDER BY created_at DESC, key').bind(slug(folder, ''))
    : env.DB.prepare('SELECT * FROM media ORDER BY created_at DESC, key');
  const { results } = await q.all();
  return json(results.map(withUrl));
}

async function upload({ request, env, user }) {
  let form;
  try { form = await request.formData(); } catch { throw new HttpError(400, 'Se esperaba multipart/form-data'); }
  const files = form.getAll('file').filter(isFile);
  if (!files.length) throw new HttpError(400, 'Falta el campo "file"');
  const folder = slug(form.get('folder'), 'comun');
  const wanted = typeof form.get('name') === 'string' ? form.get('name') : '';
  const types = files.map(checkFile); // validar todo antes de subir nada

  const rows = [];
  for (const [i, file] of files.entries()) {
    const ext = fileExt(file.name) || TYPE_EXTS[types[i]] || 'bin';
    // "name" solo aplica si se sube un único fichero
    const base = slug(files.length === 1 && wanted ? wanted : file.name.replace(/\.[^.]*$/, ''), 'recurso');
    const key = `${folder}/${base}-${rand5()}.${slug(ext, 'bin')}`;
    await env.MEDIA.put(key, file, { httpMetadata: { contentType: types[i] } });
    const row = { key, folder, type: types[i], size: file.size, uploaded_by: user, created_at: Date.now() };
    try {
      await env.DB.prepare('INSERT INTO media (key, folder, type, size, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(row.key, row.folder, row.type, row.size, row.uploaded_by, row.created_at).run();
    } catch (e) {
      await env.MEDIA.delete(key); // no dejar huérfanos en R2
      throw e;
    }
    rows.push(withUrl(row));
  }
  return json(rows, 201);
}

// Reemplaza el contenido bajo la misma clave (multipart con "file" o cuerpo crudo)
async function replace({ request, env, user, params: [raw] }) {
  const key = keyFrom(raw);
  const existing = await env.DB.prepare('SELECT * FROM media WHERE key = ?').bind(key).first();
  if (!existing) throw new HttpError(404, 'Recurso no encontrado');

  let blob, type;
  if ((request.headers.get('content-type') || '').startsWith('multipart/form-data')) {
    let form;
    try { form = await request.formData(); } catch { throw new HttpError(400, 'multipart inválido'); }
    blob = form.get('file');
    if (!isFile(blob)) throw new HttpError(400, 'Falta el campo "file"');
    type = checkFile(blob);
  } else {
    blob = await request.arrayBuffer();
    if (!blob.byteLength) throw new HttpError(400, 'Cuerpo vacío');
    const ct = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    type = checkFile({ name: key, type: ct, size: blob.byteLength });
  }
  const size = blob.size ?? blob.byteLength;
  await env.MEDIA.put(key, blob, { httpMetadata: { contentType: type } });
  await env.DB.prepare('UPDATE media SET type = ?, size = ?, uploaded_by = ? WHERE key = ?').bind(type, size, user, key).run();
  return json(withUrl({ ...existing, type, size, uploaded_by: user }));
}

async function remove({ env, params: [raw] }) {
  const key = keyFrom(raw);
  const row = await env.DB.prepare('SELECT key FROM media WHERE key = ?').bind(key).first();
  const obj = row ? null : await env.MEDIA.head(key);
  if (!row && !obj) throw new HttpError(404, 'Recurso no encontrado');
  await env.MEDIA.delete(key);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM media WHERE key = ?').bind(key),
    env.DB.prepare('UPDATE players SET photo_key = NULL WHERE photo_key = ?').bind(key), // jugadores que la usaban
  ]);
  return json({ ok: true });
}

export default [
  ['GET', /^\/api\/media$/, list],
  ['POST', /^\/api\/media$/, upload],
  ['PUT', /^\/api\/media\/(.+)$/, replace],
  ['DELETE', /^\/api\/media\/(.+)$/, remove],
];

// ---- GET /media/<clave> -----------------------------------------------------
export async function serveMedia({ request, env, params: [raw] }) {
  const key = keyFrom(raw);
  let obj;
  try {
    // R2 interpreta Range e If-None-Match/If-Match directamente de las cabeceras
    obj = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers });
  } catch {
    return new Response('Rango no satisfacible', { status: 416 });
  }
  if (!obj) throw new HttpError(404, 'Recurso no encontrado');

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  if (!headers.get('content-type')) headers.set('content-type', 'application/octet-stream');
  headers.set('etag', obj.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('content-security-policy', "sandbox; default-src 'none'"); // un SVG subido no puede ejecutar scripts

  if (!('body' in obj) || !obj.body) return new Response(null, { status: 304, headers }); // condicional fallida

  let status = 200;
  headers.set('content-length', String(obj.size));
  if (obj.range && request.headers.has('range')) {
    const start = obj.range.offset ?? 0;
    const len = obj.range.length ?? obj.size - start;
    status = 206;
    headers.set('content-range', `bytes ${start}-${start + len - 1}/${obj.size}`);
    headers.set('content-length', String(len));
  }
  return new Response(obj.body, { status, headers });
}
