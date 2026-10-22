// Utilidades pequeñas compartidas por toda la web.
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rand = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
export const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const eur = (n) => n.toFixed(2).replace('.', ',') + ' €';
export const initials = (n) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
// nombre sin mayúsculas ni tildes, para comparar
export const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// localStorage que nunca revienta (modo privado, cuota…)
export const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  json(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  setJson(k, v) { return ls.set(k, JSON.stringify(v)); },
};

export const bytes = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';

// Se pregunta una sola vez: cada contexto de prueba cuenta para el límite del navegador (~16), y
// al pasarse este tira el más viejo (que puede ser el de la onda o el de una animación en marcha)
let glOK = null;
export function webglOK() {
  if (glOK != null) return glOK;
  try {
    const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl');
    glOK = !!g;
    g?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (e) { glOK = false; }
  return glOK;
}
