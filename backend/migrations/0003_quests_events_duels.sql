CREATE TABLE IF NOT EXISTS quest_progress (
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, quest_id)
);

CREATE TABLE IF NOT EXISTS event_progress (
  user_id INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS duels (
  id TEXT PRIMARY KEY,
  level INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  creator_id INTEGER NOT NULL,
  opponent_id INTEGER,
  creator_score INTEGER,
  creator_wave INTEGER,
  opponent_score INTEGER,
  opponent_wave INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS duels_creator ON duels (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS duels_opponent ON duels (opponent_id, created_at DESC);
