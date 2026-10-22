// Verificación del JWT de Access con un par RSA generado en el test y JWKS simulado
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { call } from './helpers.js';
import { _resetJwksCache } from '../auth.js';

const TEAM = 'amigos.cloudflareaccess.com';
const AUD = 'aud-123';
const ENV = { ACCESS_TEAM: TEAM, ACCESS_AUD: AUD };
const b64 = (o) => btoa(typeof o === 'string' ? o : JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64bytes = (buf) => b64(String.fromCharCode(...new Uint8Array(buf)));

let pair, jwk;
beforeAll(async () => {
  pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
});
afterEach(() => { vi.restoreAllMocks(); _resetJwksCache(); });

async function sign(claims, { key = pair.privateKey, kid = 'k1' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = { iss: `https://${TEAM}`, aud: [AUD], email: 'lucas@example.com', iat: now, exp: now + 600, ...claims };
  const head = `${b64({ alg: 'RS256', kid, typ: 'JWT' })}.${b64(body)}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head));
  return `${head}.${b64bytes(sig)}`;
}
const mockJwks = () => vi.spyOn(globalThis, 'fetch').mockImplementation(async (u) => {
  expect(String(u)).toBe(`https://${TEAM}/cdn-cgi/access/certs`);
  return Response.json({ keys: [jwk] });
});
const withJwt = (t) => ({ headers: { 'cf-access-jwt-assertion': t } });

describe('modo access', () => {
  it('acepta un JWT válido y saca el email; cachea el JWKS', async () => {
    const spy = mockJwks();
    const r = await call('/api/me', withJwt(await sign({})), ENV);
    expect(await r.json()).toEqual({ user: 'lucas@example.com', mode: 'access' });
    await call('/api/me', withJwt(await sign({})), ENV);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('rechaza aud, iss, exp incorrectos, firma ajena y kid desconocido', async () => {
    mockJwks();
    const now = Math.floor(Date.now() / 1000);
    const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign']);
    const bad = [
      await sign({ aud: ['otra'] }),
      await sign({ iss: 'https://evil.example.com' }),
      await sign({ exp: now - 10 }),
      await sign({}, { key: other.privateKey }),
      await sign({}, { kid: 'desconocido' }),
      'basura',
    ];
    for (const t of bad) expect((await call('/api/me', withJwt(t), ENV)).status).toBe(401);
    expect((await call('/api/me', {}, ENV)).status).toBe(401);
  });
});
