let schemaInitialized = false;

export const initializeSchema = async (db) => {
  if (schemaInitialized) return;

  await db.prepare(`CREATE TABLE IF NOT EXISTS cabinets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS queue_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cabinet_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    players TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    is_playing INTEGER NOT NULL DEFAULT 0,
    request_hash TEXT,
    owner_id TEXT,
    started_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cabinet_id) REFERENCES cabinets(id) ON DELETE CASCADE
  )`).run();

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_queue_items_cabinet_position ON queue_items(cabinet_id, position)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_queue_items_request_hash ON queue_items(request_hash)').run();

  schemaInitialized = true;
};