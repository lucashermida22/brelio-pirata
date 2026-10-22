// Jugadores: /api/players
import { HttpError, json, readJson } from '../http.js';

const cleanName = (v) => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, 'name es obligatorio');
  if (v.trim().length > 60) throw new HttpError(400, 'name demasiado largo (máx. 60)');
  return v.trim();
};
const cleanPhoto = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' || v.length > 200) throw new HttpError(400, 'photo_key inválido');
  return v;
};

const getPlayer = (env, id) => env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();

export default [
  ['GET', /^\/api\/players$/, async ({ env }) => {
    const { results } = await env.DB.prepare('SELECT * FROM players ORDER BY name COLLATE NOCASE, created_at').all();
    return json(results);
  }],

  ['POST', /^\/api\/players$/, async ({ request, env, user }) => {
    const body = await readJson(request);
    const row = { id: crypto.randomUUID(), name: cleanName(body.name), photo_key: cleanPhoto(body.photo_key), created_by: user, created_at: Date.now() };
    await env.DB.prepare('INSERT INTO players (id, name, photo_key, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(row.id, row.name, row.photo_key, row.created_by, row.created_at).run();
    return json(row, 201);
  }],

  ['PATCH', /^\/api\/players\/([^/]+)$/, async ({ request, env, params: [id] }) => {
    const body = await readJson(request);
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
    if (!has('name') && !has('photo_key')) throw new HttpError(400, 'Nada que actualizar (name / photo_key)');
    const current = await getPlayer(env, id);
    if (!current) throw new HttpError(404, 'Jugador no encontrado');
    const name = has('name') ? cleanName(body.name) : current.name;
    const photo = has('photo_key') ? cleanPhoto(body.photo_key) : current.photo_key;
    await env.DB.prepare('UPDATE players SET name = ?, photo_key = ? WHERE id = ?').bind(name, photo, id).run();
    return json({ ...current, name, photo_key: photo });
  }],

  ['DELETE', /^\/api\/players\/([^/]+)$/, async ({ env, params: [id] }) => {
    const r = await env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id).run();
    if (!r.meta.changes) throw new HttpError(404, 'Jugador no encontrado');
    return json({ ok: true });
  }],
];
