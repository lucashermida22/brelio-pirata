// Fotos y avatares de los jugadores.
import { esc, norm } from './util.js';
import { state } from './state.js';
import { mediaUrl } from './api.js';

const EMOJIS = ['🐸', '🐙', '🦄', '🐼', '🦊', '🐵', '🐷', '🐨', '🐯', '👽', '🤡', '🥸', '🐧', '🦖', '🐹', '🐻', '🦁', '🐔', '🤠', '👻'];
export { EMOJIS };

const byName = (name) => { const n = norm(name); return state.players.find((p) => norm(p.name) === n); };

// URL de la foto de un jugador, o null (entonces va su emoji)
export function photoFor(name) {
  const p = byName(name);
  return p && p.photo_key ? mediaUrl(p.photo_key) : null;
}

export function emojiFor(name) {
  let h = 0;
  for (const c of norm(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return EMOJIS[h % EMOJIS.length];
}

export const faceInner = (name) => {
  const src = photoFor(name);
  return src ? `<img decoding="async" src="${esc(src)}" alt="">` : `<span class="emo">${emojiFor(name)}</span>`;
};

export const avatarHTML = (name) => {
  const src = photoFor(name);
  return src ? `<span class="avatar ph"><img decoding="async" src="${esc(src)}" alt=""></span>` : `<span class="avatar emo">${emojiFor(name)}</span>`;
};
