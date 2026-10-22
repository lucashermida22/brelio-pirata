import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = path.join(root, 'media');

const TYPES = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  webm: 'video/webm', mp4: 'video/mp4',
};
const extOf = (f) => path.extname(f).slice(1).toLowerCase();
const slug = (s, fb) => String(s ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || fb;
const send = (res, status, data) => { res.statusCode = status; res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); };

function listMedia() {
  const rows = [];
  const walk = (dir, rel) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name), key = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(full, key);
      else if (TYPES[extOf(e.name)]) {
        const st = fs.statSync(full);
        rows.push({ key, folder: key.split('/')[0], type: TYPES[extOf(e.name)], size: st.size, uploaded_by: 'dev', created_at: Math.round(st.mtimeMs), url: '/media/' + key });
      }
    }
  };
  walk(MEDIA_DIR, '');
  return rows.sort((a, b) => b.created_at - a.created_at);
}

// Parser multipart mínimo (solo para el modo dev; en producción lo hace el Worker)
function parseMultipart(buf, boundary) {
  const sep = Buffer.from('--' + boundary), parts = [];
  let i = buf.indexOf(sep);
  while (i !== -1) {
    const j = buf.indexOf(sep, i + sep.length);
    if (j === -1) break;
    const part = buf.subarray(i + sep.length + 2, j - 2);
    const h = part.indexOf('\r\n\r\n');
    const head = part.subarray(0, h).toString('utf8');
    const name = /name="([^"]*)"/.exec(head)?.[1], filename = /filename="([^"]*)"/.exec(head)?.[1];
    parts.push({ name, filename, data: part.subarray(h + 4) });
    i = j;
  }
  return parts;
}

// Sirve media/ en /media/<clave> (con Range, para que el <audio> pueda saltar) y, solo en dev,
// simula /api/media sobre esa misma carpeta. Si defines API_PROXY=http://localhost:8787 (wrangler dev),
// todo /api y /media se reenvía al Worker en su lugar.
function mediaPlugin() {
  const mw = (req, res, next) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/media/')) {
      let key; try { key = decodeURIComponent(url.pathname.slice(7)); } catch { res.statusCode = 400; return res.end(); }
      const file = path.join(MEDIA_DIR, key);
      if (!file.startsWith(MEDIA_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end('No encontrado'); }
      const size = fs.statSync(file).size, type = TYPES[extOf(file)] || 'application/octet-stream';
      res.setHeader('content-type', type); res.setHeader('accept-ranges', 'bytes'); res.setHeader('cache-control', 'no-cache');
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (m) {
        const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
        res.statusCode = 206; res.setHeader('content-range', `bytes ${start}-${end}/${size}`); res.setHeader('content-length', end - start + 1);
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.setHeader('content-length', size);
      return fs.createReadStream(file).pipe(res);
    }
    if (url.pathname === '/api/media' && req.method === 'GET') {
      const folder = url.searchParams.get('folder');
      return send(res, 200, listMedia().filter((r) => !folder || r.folder === slug(folder, '')));
    }
    if (url.pathname === '/api/media' && req.method === 'POST') {
      const chunks = []; req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const ct = req.headers['content-type'] || '', b = /boundary=(.+)$/.exec(ct)?.[1];
        if (!b) return send(res, 400, { error: 'Se esperaba multipart/form-data' });
        const parts = parseMultipart(Buffer.concat(chunks), b);
        const folder = slug(parts.find((p) => p.name === 'folder')?.data.toString(), 'comun');
        const out = [];
        for (const p of parts.filter((x) => x.name === 'file' && x.filename)) {
          const ext = extOf(p.filename);
          if (!TYPES[ext]) return send(res, 415, { error: `Tipo no permitido (.${ext}): solo image/*, audio/* y video/*` });
          const base = slug(p.filename.replace(/\.[^.]*$/, ''), 'recurso');
          const key = `${folder}/${base}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
          fs.mkdirSync(path.dirname(path.join(MEDIA_DIR, key)), { recursive: true });
          fs.writeFileSync(path.join(MEDIA_DIR, key), p.data);
          out.push({ key, folder, type: TYPES[ext], size: p.data.length, uploaded_by: 'dev', created_at: Date.now(), url: '/media/' + key });
        }
        send(res, out.length ? 201 : 400, out.length ? out : { error: 'Falta el campo "file"' });
      });
      return;
    }
    if (url.pathname.startsWith('/api/media/') && req.method === 'DELETE') {
      const key = decodeURIComponent(url.pathname.slice(11)), file = path.join(MEDIA_DIR, key);
      if (!file.startsWith(MEDIA_DIR + path.sep) || !fs.existsSync(file)) return send(res, 404, { error: 'Recurso no encontrado' });
      fs.unlinkSync(file); return send(res, 200, { ok: true });
    }
    // sin Worker no hay jugadores ni pachangas: responde 200 «mock» (así la consola queda limpia) y la web cae a localStorage
    if (url.pathname === '/api/players' && req.method === 'GET') return send(res, 200, { mock: true });
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Sin Worker: usa `wrangler dev` o API_PROXY' });
    next();
  };
  return {
    name: 'brelio-media',
    configureServer(server) { server.middlewares.use(mw); },
    configurePreviewServer(server) { server.middlewares.use(mw); },
  };
}

const proxy = process.env.API_PROXY;
const proxyCfg = proxy ? { '/api': { target: proxy, changeOrigin: true }, '/media': { target: proxy, changeOrigin: true } } : undefined;

export default defineConfig({
  plugins: proxy ? [] : [mediaPlugin()],
  resolve: { alias: { '@kit': path.join(root, 'app/versus/kit.js') } },
  server: { proxy: proxyCfg },
  preview: { proxy: proxyCfg },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 800 },
});
