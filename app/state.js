// Estado compartido de la web (una sola fuente de verdad).
export const state = {
  players: [],        // [{id, name, photo_key}]
  mode: 'teams',      // 'teams' (nº de equipos) | 'size' (personas por equipo)
  lastTeams: null,    // equipos del último reparto
  lolMode: false,
  animPref: 'random',
  matchId: null,      // id de la pachanga guardada (para marcar ganador)
};
