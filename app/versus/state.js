// Estado del overlay de animación (singleton). Lo usan el runtime, el kit y los helpers.
export const vs = {
  open: false,          // hay una animación en marcha
  pending: null,        // callback al cerrar
  timers: [],           // setTimeout/setInterval de la animación (se limpian solos)
  fxStop: null,         // limpieza de la escena (Three.js, rAF…)
  hold: false,          // la animación pide no cerrarse todavía (huevo de pascua)
  anim: null,           // id de la animación actual
  song: null,           // <audio> actual
  sounds: new Set(),    // otros <audio> que haya usado la animación
  teardown: [],         // funciones a ejecutar al cerrar
  types: [],            // [{seq, fn}] huevos de pascua por teclado
  keyBuf: '',
  songPos: {},          // clave de canción → posición donde se quedó (el ganador sigue la canción)
};
