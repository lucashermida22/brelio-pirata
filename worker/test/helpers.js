import { env } from 'cloudflare:workers';
import worker from '../index.js';

const ctx = { waitUntil() {}, passThroughOnException() {} };

// Llama al Worker directamente con un env ajustable (modo de auth, claves...)
export const call = (path, init = {}, extraEnv = {}) =>
  worker.fetch(new Request(`https://brelio.test${path}`, init), { ...env, ...extraEnv }, ctx);

export const jsonInit = (method, body, headers = {}) => ({
  method,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

export const form = (fields) => {
  const f = new FormData();
  for (const [k, v] of fields) f.append(k, v);
  return f;
};
