import './style.css';
import { JOJO, playJojo } from './jojo.js';

// JoJo: cada jugador con su Stand, ORA ORA ORA / MUDA MUDA y «Continuará».
export default {
  label: 'JoJo · Menacing',
  order: 70,
  ...JOJO,
  title: 'El destino ha elegido', winTitle: '¡Victoria de oro!',
  play: (ctx) => playJojo(ctx),
};
