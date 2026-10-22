import './style.css';
import { loadThree } from '@kit';

// Singularidad 3D: warp, Big Bang y un agujero negro que escupe a cada jugador hasta su formación.
export default {
  label: 'Singularidad 3D',
  order: 120,
  needsWebGL: true,
  title: 'SINGULARIDAD', winTitle: 'SUPERNOVA', sub: 'los equipos nacen de un agujero negro', btn: 'Volver a la Tierra',
  pops: [], hold: 4200,
  warm: () => Promise.all([loadThree(), import('./scene.js')]),
  async play(ctx) {
    const { playThree } = await import('./scene.js');
    return playThree(ctx);
  },
};
