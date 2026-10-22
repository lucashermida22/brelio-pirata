// Worker de Brelio: API (/api/*) y recursos (/media/*). La web estática la sirven los assets.
import { authenticate, authMode, safeEqual } from './auth.js';
import { HttpError, errorJson, json, readJson } from './http.js';
import players from './routes/players.js';
import media, { serveMedia } from './routes/media.js';
import matches from './routes/matches.js';

const routes = [
  ['GET', /^\/api\/me$/, ({ user, mode }) => json({ user, mode })],
  ...players,
  ...media,
  ...matches,
  ['GET', /^\/media\/(.+)$/, serveMedia],
  ['HEAD', /^\/media\/(.+)$/, serveMedia],
];

// Login opcional en modo "key": comprueba la clave y la guarda en una cookie (para <audio>/<img>)
async function login(request, env) {
  if (authMode(env) !== 'key') throw new HttpError(400, 'El login solo existe en modo key');
  const { key } = await readJson(request);
  if (typeof key !== 'string' || !(await safeEqual(key, env.GROUP_KEY || ''))) throw new HttpError(401, 'Clave incorrecta');
  const cookie = `brelio_key=${encodeURIComponent(key)}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`;
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    try {
      const isApi = pathname.startsWith('/api/');
      if (!isApi && !pathname.startsWith('/media/')) {
        // Normalmente no llega aquí (run_worker_first); por si acaso, delegar en los assets
        return env.ASSETS ? env.ASSETS.fetch(request) : errorJson(404, 'No encontrado');
      }
      if (request.method === 'POST' && pathname === '/api/login') return await login(request, env);

      const auth = await authenticate(request, env);

      // Buscar ruta: si el path existe pero no el método -> 405
      let pathMatched = false;
      for (const [method, re, handler] of routes) {
        const m = re.exec(pathname);
        if (!m) continue;
        pathMatched = true;
        if (method !== request.method) continue;
        return await handler({ request, env, ctx, url, params: m.slice(1), ...auth });
      }
      return pathMatched ? errorJson(405, 'Método no permitido') : errorJson(404, 'Ruta no encontrada');
    } catch (e) {
      if (e instanceof HttpError) return errorJson(e.status, e.message, e.status === 401 ? { 'www-authenticate': 'Brelio' } : {});
      console.error(e);
      return errorJson(500, 'Error interno');
    }
  },
};
