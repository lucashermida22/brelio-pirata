// Autenticación: Cloudflare Access (JWT), clave de grupo o abierto (dev).
import { HttpError } from './http.js';

const enc = new TextEncoder();

// ---- Elección de modo -------------------------------------------------------
export function authMode(env) {
  const m = (env.AUTH_MODE || '').trim().toLowerCase();
  if (m === 'access' || m === 'key' || m === 'dev') return m;
  if (env.ACCESS_AUD) return 'access';
  if (env.GROUP_KEY) return 'key';
  return 'dev';
}

// Devuelve { user, mode } o lanza HttpError(401)
export async function authenticate(request, env) {
  const mode = authMode(env);
  if (mode === 'dev') return { user: 'dev', mode };

  if (mode === 'key') {
    if (!env.GROUP_KEY) throw new HttpError(401, 'Servidor sin GROUP_KEY configurada');
    const key = request.headers.get('x-group-key') || getCookie(request, 'brelio_key');
    if (!key || !(await safeEqual(key, env.GROUP_KEY))) throw new HttpError(401, 'Clave de grupo incorrecta o ausente');
    const name = (request.headers.get('x-user-name') || '').trim().slice(0, 40);
    return { user: name || 'grupo', mode };
  }

  // mode === 'access'
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) throw new HttpError(401, 'Falta la cabecera de Cloudflare Access');
  const claims = await verifyAccessJwt(token, env);
  return { user: claims.email || claims.sub || 'access', mode };
}

export function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return '';
      }
    }
  }
  return '';
}

// Comparación en tiempo constante (se comparan los hashes)
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  return crypto.subtle.timingSafeEqual(ha, hb);
}

// ---- JWT de Cloudflare Access (RS256) --------------------------------------
let jwksCache = { url: '', keys: [], at: 0 }; // caché en el módulo
const JWKS_TTL = 60 * 60 * 1000;
const JWKS_MIN_REFETCH = 30 * 1000; // evita martillear si llega un kid desconocido

const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

export const accessIssuer = (env) => {
  const team = (env.ACCESS_TEAM || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return team ? `https://${team}` : '';
};

async function getJwks(issuer, force) {
  const url = `${issuer}/cdn-cgi/access/certs`;
  const fresh = jwksCache.url === url && Date.now() - jwksCache.at < JWKS_TTL;
  if (fresh && !force) return jwksCache.keys;
  if (jwksCache.url === url && force && Date.now() - jwksCache.at < JWKS_MIN_REFETCH) return jwksCache.keys;
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(401, 'No se pudieron obtener las claves de Access');
  const { keys } = await res.json();
  jwksCache = { url, keys: keys || [], at: Date.now() };
  return jwksCache.keys;
}

export async function verifyAccessJwt(token, env) {
  const issuer = accessIssuer(env);
  if (!issuer || !env.ACCESS_AUD) throw new HttpError(401, 'Access sin configurar (ACCESS_TEAM / ACCESS_AUD)');
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'JWT mal formado');
  let header, claims;
  try {
    header = b64urlToJson(parts[0]);
    claims = b64urlToJson(parts[1]);
  } catch {
    throw new HttpError(401, 'JWT mal formado');
  }
  if (header.alg !== 'RS256') throw new HttpError(401, 'Algoritmo de JWT no admitido');

  let jwk = (await getJwks(issuer, false)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await getJwks(issuer, true)).find((k) => k.kid === header.kid); // rotación de claves
  if (!jwk) throw new HttpError(401, 'Clave de firma desconocida');

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new HttpError(401, 'Firma de JWT inválida');

  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD)) throw new HttpError(401, 'aud incorrecto');
  if (claims.iss !== issuer) throw new HttpError(401, 'iss incorrecto');
  if (typeof claims.exp !== 'number' || claims.exp < now) throw new HttpError(401, 'JWT caducado');
  if (typeof claims.nbf === 'number' && claims.nbf > now + 60) throw new HttpError(401, 'JWT aún no válido');
  return claims;
}

// Solo para tests: vaciar la caché de JWKS
export const _resetJwksCache = () => {
  jwksCache = { url: '', keys: [], at: 0 };
};
