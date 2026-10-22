// Chat y avisos de la «retransmisión» de GG EZ (los usan la escena 3D y la versión de DOM).
import { $, rand, esc } from '@kit';

const CHAT_USERS = [['xX_Sniper_Xx', '#ff6b9d'], ['tilted_mid', '#7ad7ff'], ['jungla_diff', '#9dff7a'], ['adc_main', '#ffd36b'], ['support_gap', '#c69bff'], ['lerelio_mod', '#3d8bff'], ['ff15enjoyer', '#ff9b5c'], ['gg_wp_', '#5cffd1']];
const CHAT_MSG = ['gg ez', 'EZ', 'ggwp', 'report jungla', '?', 'EZ Clap', '1v9', 'ff15', 'uninstall', 'diff', 'gg', 'lag', 'calculated', 'nt', 'tilted', 'gap', 'KEKW', 'W', 'L', 'POG', 'sin flash', 'GG EZ GG EZ'];

export const HUD = '<div class="hud"><span class="live">● LIVE</span><span class="viewers" id="ggViewers">👁 1.204</span></div><div class="chatbox" id="ggChat"></div>';

export const gg = {
  push: null,   // función para escribir un mensaje en el chat (null si no hay chat)
  alert(text) {
    const layer = $('#vsLayer'); layer.querySelectorAll('.alert').forEach((e) => e.remove());
    const d = document.createElement('div'); d.className = 'alert'; d.textContent = text; layer.appendChild(d);
  },
  chat(ctx) {
    const box = $('#ggChat'), vw = $('#ggViewers'); if (!box) return null;
    let viewers = 1204 + rand(400);
    const push = (text) => {
      const [u, col] = CHAT_USERS[rand(CHAT_USERS.length)];
      const p = document.createElement('p');
      p.innerHTML = `<b style="color:${col}">${u}</b>: ${esc(text || CHAT_MSG[rand(CHAT_MSG.length)])}`;
      box.appendChild(p); while (box.children.length > 24) box.firstChild.remove();
      viewers += rand(40); if (vw) vw.textContent = '👁 ' + viewers.toLocaleString('es-ES');
    };
    for (let i = 0; i < 6; i++) push();
    ctx.every(push, 260);
    return push;
  },
};
