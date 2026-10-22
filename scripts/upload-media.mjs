#!/usr/bin/env node
// Sube todo lo que haya en media/ al bucket R2 «brelio-media» (y lo apunta en D1 para que salga en «Recursos»).
//
//   npm run upload-media                 sube todo
//   npm run upload-media -- --dry-run    solo enseña qué subiría
//   npm run upload-media -- furious      solo las claves que empiecen por «furious»
//   npm run upload-media -- --no-db      sin apuntar en D1
//
// La clave de cada fichero es su ruta dentro de media/ (media/furious/paul.jpg → furious/paul.jpg).
// Necesita haber hecho `npx wrangler login` y que existan el bucket y la base de datos.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = path.join(root, 'media');
const BUCKET = 'brelio-media';
const DB = 'brelio';
const TYPES = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  webm: 'video/webm', mp4: 'video/mp4',
};

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const noDb = args.includes('--no-db');
const prefixes = args.filter((a) => !a.startsWith('--'));

function walk(dir, rel = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const key = rel ? `${rel}/${e.name}` : e.name;
    return e.isDirectory() ? walk(path.join(dir, e.name), key) : [key];
  });
}

const files = walk(MEDIA)
  .filter((k) => TYPES[path.extname(k).slice(1).toLowerCase()])
  .filter((k) => !prefixes.length || prefixes.some((p) => k.startsWith(p)))
  .sort();

if (!files.length) { console.log('No hay nada que subir en media/' + (prefixes.length ? ' con ese prefijo.' : '.')); process.exit(0); }

const wrangler = (a) => spawnSync('npx', ['wrangler', ...a], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
let ok = 0, fail = 0;
const rows = [];

for (const key of files) {
  const file = path.join(MEDIA, key);
  const type = TYPES[path.extname(key).slice(1).toLowerCase()];
  const size = fs.statSync(file).size;
  console.log(`${dry ? '[dry-run] ' : ''}${key}  (${type}, ${(size / 1024).toFixed(0)} KB)`);
  if (dry) continue;
  const r = wrangler(['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--content-type', type, '--remote']);
  if (r.status === 0) { ok++; rows.push({ key, type, size }); } else { fail++; console.error(`  ✗ falló ${key}`); }
}

if (!dry && !noDb && rows.length) {
  // apunta los ficheros en D1 (tabla media) para que aparezcan en la página «Recursos»
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const sql = rows.map((r) =>
    `INSERT OR REPLACE INTO media (key, folder, type, size, uploaded_by, created_at) VALUES (${q(r.key)}, ${q(r.key.split('/')[0])}, ${q(r.type)}, ${r.size}, 'upload-media', ${Date.now()});`).join('\n');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'brelio-')), 'media.sql');
  fs.writeFileSync(tmp, sql + '\n');
  const r = wrangler(['d1', 'execute', DB, '--remote', '--file', tmp]);
  if (r.status !== 0) { console.error('✗ No se pudo apuntar en D1 (los ficheros sí están en R2).'); fail++; }
}

if (!dry) console.log(`\nSubidos a R2: ${ok}${fail ? ` · fallos: ${fail}` : ''}`);
process.exit(fail ? 1 : 0);
