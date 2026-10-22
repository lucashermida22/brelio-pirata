import '../cine/style.css';
import { CINE, playCine } from '../cine/common.js';

// Estudio de cine, versión clásica: campo de estrellas en 2D (sin WebGL).
export default {
  label: 'Estudio de cine (clásico)',
  order: 30,
  key: 'cine', variant: 'classic',
  ...CINE,
  play: (ctx) => playCine(ctx, true),
};
