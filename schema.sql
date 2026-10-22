-- Esquema de D1 para Brelio. Idempotente: se puede ejecutar varias veces.
--   wrangler d1 execute brelio --remote --file schema.sql

CREATE TABLE IF NOT EXISTS players (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  photo_key  TEXT,                 -- clave en R2
  created_by TEXT,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_players_name ON players (name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS media (
  key         TEXT PRIMARY KEY,    -- carpeta/nombre-abc12.ext
  folder      TEXT,
  type        TEXT,                -- audio/mpeg, image/jpeg, image/gif, video/webm...
  size        INTEGER,
  uploaded_by TEXT,
  created_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_media_folder_created ON media (folder, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_created ON media (created_at DESC);

CREATE TABLE IF NOT EXISTS matches (
  id         TEXT PRIMARY KEY,
  played_at  INTEGER,
  animation  TEXT,
  teams      TEXT,                 -- JSON: equipos, miembros, roles LOL, capitanes
  winner     INTEGER,              -- indice del equipo ganador (NULL si no se eligio)
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_matches_played ON matches (played_at DESC);
