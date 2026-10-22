// Aplica ../schema.sql a la D1 local antes de cada fichero de tests
import { env } from 'cloudflare:workers';
import schema from '../../schema.sql?raw';

const statements = schema
  .replace(/--.*$/gm, '')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);
await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
