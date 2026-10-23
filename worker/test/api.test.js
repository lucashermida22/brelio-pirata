import { describe, expect, it } from 'vitest';
import { call, form, jsonInit } from './helpers.js';

// 1x1 png y "mp3" falso de 100 bytes
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const MP3 = Uint8Array.from({ length: 100 }, (_, i) => i);

// Los mismos tests en los tres modos; solo cambian env y cabeceras
const modes = {
  dev: { env: { AUTH_MODE: 'dev' }, headers: {}, user: 'dev' },
  key: { env: { AUTH_MODE: 'key', GROUP_KEY: 's3cret' }, headers: { 'x-group-key': 's3cret', 'x-user-name': 'lucas' }, user: 'lucas' },
};

for (const [name, m] of Object.entries(modes)) {
  describe(`API (modo ${name})`, () => {
    const api = (path, init = {}) => call(path, { ...init, headers: { ...m.headers, ...init.headers } }, m.env);

    it('me', async () => {
      const r = await api('/api/me');
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ user: m.user, mode: name });
    });

    it('jugadores: crear, listar ordenado, editar, borrar', async () => {
      const b = await (await api('/api/players', jsonInit('POST', { name: 'Beto' }))).json();
      const a = await (await api('/api/players', jsonInit('POST', { name: 'ana', photo_key: 'jugadores/ana-abcde.png' }))).json();
      expect(a.created_by).toBe(m.user);
      const list = await (await api('/api/players')).json();
      expect(list.map((p) => p.name)).toEqual(['ana', 'Beto']);

      const patched = await (await api(`/api/players/${b.id}`, jsonInit('PATCH', { name: 'Berto', photo_key: 'x/y.png' }))).json();
      expect(patched).toMatchObject({ name: 'Berto', photo_key: 'x/y.png' });
      const cleared = await (await api(`/api/players/${b.id}`, jsonInit('PATCH', { photo_key: null }))).json();
      expect(cleared.photo_key).toBeNull();

      expect((await api('/api/players', jsonInit('POST', { name: '  ' }))).status).toBe(400);
      expect((await api('/api/players/nope', jsonInit('PATCH', { name: 'x' }))).status).toBe(404);
      expect((await api(`/api/players/${b.id}`, { method: 'DELETE' })).status).toBe(200);
      expect((await api(`/api/players/${b.id}`, { method: 'DELETE' })).status).toBe(404);
      await api(`/api/players/${a.id}`, { method: 'DELETE' });
    });

    it('recursos: subir imagen+mp3, listar, servir, Range, 304, reemplazar, borrar', async () => {
      const up = await api('/api/media', {
        method: 'POST',
        body: form([
          ['folder', 'Fast & Furious!'],
          ['file', new File([PNG], 'Paul Walker.png', { type: 'image/png' })],
          ['file', new File([MP3], 'last ride.mp3', { type: 'audio/mpeg' })],
        ]),
      });
      expect(up.status).toBe(201);
      const [img, mp3] = await up.json();
      expect(img.key).toMatch(/^fast-furious\/paul-walker-[a-z0-9]{5}\.png$/);
      expect(mp3.key).toMatch(/^fast-furious\/last-ride-[a-z0-9]{5}\.mp3$/);
      expect(img).toMatchObject({ folder: 'fast-furious', type: 'image/png', size: PNG.length, uploaded_by: m.user, url: `/media/${img.key}` });

      // listado por carpeta
      const listed = await (await api('/api/media?folder=fast-furious')).json();
      expect(listed.map((r) => r.key).sort()).toEqual([img.key, mp3.key].sort());
      expect(await (await api('/api/media?folder=otra')).json()).toEqual([]);

      // servir
      const got = await api(mp3.url);
      expect(got.status).toBe(200);
      expect(got.headers.get('content-type')).toBe('audio/mpeg');
      expect(got.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      expect(got.headers.get('accept-ranges')).toBe('bytes');
      expect(new Uint8Array(await got.arrayBuffer())).toEqual(MP3);
      const etag = got.headers.get('etag');
      expect(etag).toBeTruthy();

      // Range -> 206
      const part = await api(mp3.url, { headers: { range: 'bytes=10-19' } });
      expect(part.status).toBe(206);
      expect(part.headers.get('content-range')).toBe('bytes 10-19/100');
      expect(new Uint8Array(await part.arrayBuffer())).toEqual(MP3.slice(10, 20));
      const open = await api(mp3.url, { headers: { range: 'bytes=90-' } });
      expect(open.status).toBe(206);
      expect(open.headers.get('content-range')).toBe('bytes 90-99/100');

      // condicional -> 304
      const nm = await api(mp3.url, { headers: { 'if-none-match': etag } });
      expect(nm.status).toBe(304);

      // reemplazar (crudo) bajo la misma clave
      const NEW = new Uint8Array(30).fill(7);
      const rep = await api(`/api/media/${mp3.key}`, { method: 'PUT', headers: { 'content-type': 'audio/mpeg' }, body: NEW });
      expect(rep.status).toBe(200);
      expect(await rep.json()).toMatchObject({ key: mp3.key, size: 30 });
      expect(new Uint8Array(await (await api(mp3.url)).arrayBuffer())).toEqual(NEW);
      // reemplazar (multipart) y tipo no permitido
      const rep2 = await api(`/api/media/${img.key}`, { method: 'PUT', body: form([['file', new File([PNG, PNG], 'a.png', { type: 'image/png' })]]) });
      expect((await rep2.json()).size).toBe(PNG.length * 2);
      expect((await api(`/api/media/${img.key}`, { method: 'PUT', headers: { 'content-type': 'text/html' }, body: '<b>' })).status).toBe(415);
      expect((await api('/api/media/nada/no-existe.png', { method: 'PUT', headers: { 'content-type': 'image/png' }, body: PNG })).status).toBe(404);

      // borrar
      expect((await api(`/api/media/${mp3.key}`, { method: 'DELETE' })).status).toBe(200);
      expect((await api(mp3.url)).status).toBe(404);
      expect((await api(`/api/media/${mp3.key}`, { method: 'DELETE' })).status).toBe(404);
      await api(`/api/media/${img.key}`, { method: 'DELETE' });
      expect(await (await api('/api/media')).json()).toEqual([]);
    });

    it('recursos: validaciones', async () => {
      const bad = await api('/api/media', { method: 'POST', body: form([['folder', 'x'], ['file', new File(['hola'], 'a.txt', { type: 'text/plain' })]]) });
      expect(bad.status).toBe(415);
      expect((await api('/api/media', { method: 'POST', body: form([['folder', 'x']]) })).status).toBe(400);
      expect((await api('/api/media', jsonInit('POST', {}))).status).toBe(400);
      expect((await api('/media/../secreto.png')).status).toBeGreaterThanOrEqual(400);
      // name personalizado y carpeta por defecto
      const ok = await api('/api/media', { method: 'POST', body: form([['name', 'Mi Foto!'], ['file', new File([PNG], 'z.png', { type: 'image/png' })]]) });
      const [row] = await ok.json();
      expect(row.key).toMatch(/^comun\/mi-foto-[a-z0-9]{5}\.png$/);
      await api(`/api/media/${row.key}`, { method: 'DELETE' });
    });

    it('pachangas: crear, listar, ganador', async () => {
      const teams = [{ name: 'A', members: ['ana'] }, { name: 'B', members: ['beto'] }];
      const c = await api('/api/matches', jsonInit('POST', { animation: 'furious', teams }));
      expect(c.status).toBe(201);
      const match = await c.json();
      expect(match).toMatchObject({ animation: 'furious', teams, winner: null, created_by: m.user });

      const p = await api(`/api/matches/${match.id}`, jsonInit('PATCH', { winner: 1 }));
      expect((await p.json()).winner).toBe(1);
      const list = await (await api('/api/matches?limit=5')).json();
      expect(list[0]).toMatchObject({ id: match.id, winner: 1, teams });
      expect((await (await api(`/api/matches/${match.id}`, jsonInit('PATCH', { winner: null }))).json()).winner).toBeNull();

      expect((await api(`/api/matches/${match.id}`, jsonInit('PATCH', { winner: 5 }))).status).toBe(400);
      expect((await api(`/api/matches/${match.id}`, jsonInit('PATCH', { winner: 'a' }))).status).toBe(400);
      expect((await api('/api/matches/nope', jsonInit('PATCH', { winner: 0 }))).status).toBe(404);
      expect((await api('/api/matches', jsonInit('POST', { animation: 'x' }))).status).toBe(400);
      expect((await api('/api/matches?limit=abc')).status).toBe(400);
    });

    it('errores: 404 en /api desconocido, 405, JSON roto', async () => {
      const r = await api('/api/nada');
      expect(r.status).toBe(404);
      expect(await r.json()).toHaveProperty('error');
      expect((await api('/api/me', { method: 'DELETE' })).status).toBe(405);
      const broken = await api('/api/players', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
      expect(broken.status).toBe(400);
    });
  });
}

describe('autenticación', () => {
  const keyEnv = { AUTH_MODE: 'key', GROUP_KEY: 's3cret' };

  it('modo key: 401 sin clave o con clave mala; cookie válida', async () => {
    for (const path of ['/api/me', '/api/players', '/media/a/b.png']) {
      expect((await call(path, {}, keyEnv)).status).toBe(401);
      expect((await call(path, { headers: { 'x-group-key': 'mala' } }, keyEnv)).status).toBe(401);
    }
    const r = await call('/api/me', { headers: { cookie: 'a=b; brelio_key=s3cret' } }, keyEnv);
    expect(await r.json()).toEqual({ user: 'grupo', mode: 'key' });
  });

  it('modo automático: GROUP_KEY activa key; login pone cookie', async () => {
    expect((await call('/api/me', {}, { GROUP_KEY: 'k' })).status).toBe(401);
    const bad = await call('/api/login', jsonInit('POST', { key: 'x' }), keyEnv);
    expect(bad.status).toBe(401);
    const ok = await call('/api/login', jsonInit('POST', { key: 's3cret' }), keyEnv);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('set-cookie')).toContain('brelio_key=s3cret');
  });

  it('modo access sin cabecera o mal configurado: 401', async () => {
    expect((await call('/api/me', {}, { ACCESS_AUD: 'aud', ACCESS_TEAM: 't.cloudflareaccess.com' })).status).toBe(401);
    expect((await call('/api/me', { headers: { 'cf-access-jwt-assertion': 'a.b.c' } }, { AUTH_MODE: 'access' })).status).toBe(401);
  });
});

it('sin configurar, fuera de localhost no se abre', async () => {
  expect((await call('/api/me', {}, {})).status).toBe(503);
  // …pero los recursos se pueden leer y no se puede subir
  expect((await call('/media/nada/x.jpg', {}, {})).status).toBe(404);
  expect((await call('/api/media', { method: 'POST' }, {})).status).toBe(503);
});
