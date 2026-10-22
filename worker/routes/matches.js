// Pachangas: /api/matches
import { HttpError, json, readJson } from '../http.js';

// teams se guarda como JSON en texto; al leer se parsea
const parse = (r) => {
  let teams = null;
  try { teams = JSON.parse(r.teams); } catch { /* fila corrupta: teams = null */ }
  return { ...r, teams };
};

export default [
  ['GET', /^\/api\/matches$/, async ({ env, url }) => {
    const raw = url.searchParams.get('limit');
    const limit = raw === null ? 50 : Number(raw);
    if (!Number.isInteger(limit) || limit < 1) throw new HttpError(400, 'limit debe ser un entero positivo');
    const { results } = await env.DB.prepare('SELECT * FROM matches ORDER BY played_at DESC LIMIT ?').bind(Math.min(limit, 500)).all();
    return json(results.map(parse));
  }],

  ['POST', /^\/api\/matches$/, async ({ request, env, user }) => {
    const { animation, teams } = await readJson(request);
    if (typeof animation !== 'string' || !animation.trim() || animation.length > 64) throw new HttpError(400, 'animation es obligatorio (texto, máx. 64)');
    if (!Array.isArray(teams) || !teams.length) throw new HttpError(400, 'teams debe ser una lista no vacía');
    const json_ = JSON.stringify(teams);
    if (json_.length > 100_000) throw new HttpError(400, 'teams demasiado grande');
    const row = { id: crypto.randomUUID(), played_at: Date.now(), animation: animation.trim(), teams: json_, winner: null, created_by: user };
    await env.DB.prepare('INSERT INTO matches (id, played_at, animation, teams, winner, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(row.id, row.played_at, row.animation, row.teams, row.winner, row.created_by).run();
    return json(parse(row), 201);
  }],

  ['PATCH', /^\/api\/matches\/([^/]+)$/, async ({ request, env, params: [id] }) => {
    const body = await readJson(request);
    if (!Object.prototype.hasOwnProperty.call(body, 'winner')) throw new HttpError(400, 'Falta winner (entero o null)');
    const { winner } = body;
    if (winner !== null && !(Number.isInteger(winner) && winner >= 0)) throw new HttpError(400, 'winner debe ser un entero >= 0 o null');
    const row = await env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(id).first();
    if (!row) throw new HttpError(404, 'Pachanga no encontrada');
    const m = parse(row);
    if (winner !== null && Array.isArray(m.teams) && winner >= m.teams.length) throw new HttpError(400, 'winner fuera de rango');
    await env.DB.prepare('UPDATE matches SET winner = ? WHERE id = ?').bind(winner, id).run();
    return json({ ...m, winner });
  }],
];
