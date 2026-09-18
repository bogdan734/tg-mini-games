CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT,
  photo TEXT,
  coins INTEGER NOT NULL DEFAULT 0,
  stars_total INTEGER NOT NULL DEFAULT 0,
  referrer_id INTEGER,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  user_id INTEGER NOT NULL,
  game TEXT NOT NULL,
  level INTEGER NOT NULL,
  score INTEGER NOT NULL,
  wave INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game, level)
);
CREATE INDEX IF NOT EXISTS scores_board ON scores (game, level, score DESC);

CREATE TABLE IF NOT EXISTS payments (
  charge_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  payload TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS coin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS coin_log_user ON coin_log (user_id, created_at DESC);
