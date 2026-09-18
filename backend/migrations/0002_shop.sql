CREATE TABLE IF NOT EXISTS inventory (
  user_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  source TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS equipped (
  user_id INTEGER NOT NULL,
  slot TEXT NOT NULL,
  item_id TEXT NOT NULL,
  PRIMARY KEY (user_id, slot)
);
