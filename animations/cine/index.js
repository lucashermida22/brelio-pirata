import './style.css';
import { CINE, playCine } from './common.js';

// Estudio de cine: la Tierra en 3D, créditos y cada jugador en su cartel.
export default {
  label: 'Estudio de cine',
  order: 20,
  ...CINE,
  play: (ctx) => playCine(ctx, false),
};
