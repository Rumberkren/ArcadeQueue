import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('*', cors({ origin: '*' }));

let schemaInitialized = false;

const initializeSchema = async (db) => {
  if (schemaInitialized) return;

  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS cabinets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS queue_items (
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
      )`,
    },
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_queue_items_cabinet_position ON queue_items(cabinet_id, position)',
    },
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_queue_items_request_hash ON queue_items(request_hash)',
    },
  ]);

  schemaInitialized = true;
};

app.use('*', async (c, next) => {
  try {
    await initializeSchema(c.env.arcadeq);
  } catch (error) {
    console.error('Schema initialization failed:', error);
  }
  return next();
});

const normalizePlayers = (players) => {
  if (!Array.isArray(players)) {
    throw new Error('players must be an array');
  }
  const normalized = players
    .map((player) => String(player || '').trim().toLowerCase())
    .filter((player) => player.length > 0)
    .sort();

  if (normalized.length < 1 || normalized.length > 2) {
    throw new Error('players must contain 1 or 2 names');
  }

  return normalized;
};

const formatQueueItem = (row) => ({
  id: row.id,
  cabinet_id: row.cabinet_id,
  type: row.type,
  players: row.players ? JSON.parse(row.players) : [],
  position: row.position,
  is_playing: row.is_playing === 1 || row.is_playing === true,
  request_hash: row.request_hash,
  owner_id: row.owner_id,
  started_at: row.started_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const getAutoFinishMinutes = (c) => {
  const raw = c.env.AUTO_FINISH_MINUTES || '17';
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? 17 : Math.max(1, parsed);
};

const runQuery = async (db, sql, bindings = []) => db.prepare(sql).bind(...bindings);

const getCabinet = async (db, id) => {
  const result = await db.prepare('SELECT * FROM cabinets WHERE id = ?').bind(id).first();
  return result || null;
};

const getQueueItem = async (db, id) => {
  const result = await db.prepare('SELECT * FROM queue_items WHERE id = ?').bind(id).first();
  return result || null;
};

const finishQueueItem = async (db, item) => {
  if (!item) return;

  const maxResult = await db
    .prepare('SELECT MAX(position) AS max_position FROM queue_items WHERE cabinet_id = ?')
    .bind(item.cabinet_id)
    .first();
  const maxPosition = maxResult?.max_position ?? 0;

  await db.batch([
    { sql: 'BEGIN' },
    {
      sql: 'UPDATE queue_items SET position = ?, is_playing = 0, started_at = NULL WHERE id = ?',
      bindings: [maxPosition + 1, item.id],
    },
    { sql: 'COMMIT' },
  ]);

  const next = await db
    .prepare(
      'SELECT * FROM queue_items WHERE cabinet_id = ? AND id != ? ORDER BY position ASC LIMIT 1'
    )
    .bind(item.cabinet_id, item.id)
    .first();

  if (next && !next.started_at) {
    await db
      .prepare('UPDATE queue_items SET started_at = datetime("now"), is_playing = 1 WHERE id = ?')
      .bind(next.id)
      .run();
  }
};

const expireOldItems = async (db, autoFinishMinutes) => {
  const expired = await db
    .prepare(
      'SELECT * FROM queue_items WHERE started_at IS NOT NULL AND started_at < datetime("now", ?)' 
    )
    .bind(`-${autoFinishMinutes} minutes`)
    .all();

  if (!expired.results?.length) {
    return;
  }

  for (const item of expired.results) {
    await finishQueueItem(db, item);
  }
};

const loadCabinetsWithItems = async (db) => {
  const cabinetsResult = await db.prepare('SELECT * FROM cabinets ORDER BY id ASC').all();
  const queueResult = await db.prepare('SELECT * FROM queue_items ORDER BY cabinet_id ASC, position ASC').all();

  const cabinets = (cabinetsResult.results || []).map((cabinet) => ({
    ...cabinet,
    queue_items: [],
  }));
  const cabinetMap = new Map(cabinets.map((cabinet) => [cabinet.id, cabinet]));

  for (const rawItem of queueResult.results || []) {
    const item = formatQueueItem(rawItem);
    const parentCabinet = cabinetMap.get(item.cabinet_id);
    if (parentCabinet) {
      parentCabinet.queue_items.push(item);
    }
  }

  return cabinets;
};

const getCabinetQueuePayload = async (db, cabinetId) => {
  const itemsResult = await db
    .prepare('SELECT * FROM queue_items WHERE cabinet_id = ? ORDER BY position ASC')
    .bind(cabinetId)
    .all();

  const items = (itemsResult.results || []).map(formatQueueItem);
  const currentSession = items.length > 0 ? items[0] : null;

  return {
    current_session: currentSession,
    queue_items: items.slice(1),
  };
};

app.get('/api/health', async (c) => {
  try {
    await c.env.arcadeq.prepare('SELECT 1').first();
    return c.json({ status: 'ok' });
  } catch (error) {
    return c.json({ status: 'error', message: error?.message || 'DB error' }, { status: 500 });
  }
});

app.get('/api/cabinets', async (c) => {
  await expireOldItems(c.env.arcadeq, getAutoFinishMinutes(c));
  const cabinets = await loadCabinetsWithItems(c.env.arcadeq);
  return c.json(cabinets);
});

app.post('/api/cabinets', async (c) => {
  const body = await c.req.json();
  const name = String(body?.name || '').trim();

  if (!name) {
    return c.json({ message: 'The name field is required.' }, { status: 422 });
  }

  await c.env.arcadeq
    .prepare('INSERT OR IGNORE INTO cabinets (name, created_at, updated_at) VALUES (?, datetime("now"), datetime("now"))')
    .bind(name)
    .run();

  const cabinet = await c.env.arcadeq.prepare('SELECT * FROM cabinets WHERE name = ?').bind(name).first();
  return c.json(cabinet, { status: 201 });
});

app.put('/api/cabinets/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const name = String(body?.name || '').trim();

  if (!name) {
    return c.json({ message: 'The name field is required.' }, { status: 422 });
  }

  const cabinet = await getCabinet(c.env.arcadeq, id);
  if (!cabinet) {
    return c.json({ message: 'Cabinet not found' }, { status: 404 });
  }

  await c.env.arcadeq.prepare('UPDATE cabinets SET name = ?, updated_at = datetime("now") WHERE id = ?').bind(name, id).run();
  const updated = await getCabinet(c.env.arcadeq, id);
  return c.json(updated);
});

app.delete('/api/cabinets/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.arcadeq.prepare('DELETE FROM cabinets WHERE id = ?').bind(id).run();
  return c.json({ message: 'Deleted' });
});

app.patch('/api/cabinets/:id/reorder', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const newOrder = body?.new_order;

  if (!Array.isArray(newOrder) || newOrder.length === 0) {
    return c.json({ message: 'new_order must be a non-empty array' }, { status: 422 });
  }

  const placeholder = newOrder.map(() => '?').join(',');
  const existingRows = await c.env.arcadeq
    .prepare(`SELECT id FROM queue_items WHERE id IN (${placeholder}) AND cabinet_id = ?`)
    .bind(...newOrder, id)
    .all();

  if (!existingRows.results || existingRows.results.length !== newOrder.length) {
    return c.json({ message: 'new_order contains invalid queue item ids' }, { status: 422 });
  }

  const positionsResult = await c.env.arcadeq
    .prepare(`SELECT id, position FROM queue_items WHERE id IN (${placeholder}) ORDER BY position ASC`)
    .bind(...newOrder)
    .all();

  const positions = (positionsResult.results || []).map((row) => row.position).sort((a, b) => a - b);

  for (let index = 0; index < newOrder.length; index += 1) {
    await c.env.arcadeq
      .prepare('UPDATE queue_items SET position = ? WHERE id = ?')
      .bind(positions[index], newOrder[index])
      .run();
  }

  return c.json({ message: 'Reordered' });
});

app.get('/api/queue', async (c) => {
  await expireOldItems(c.env.arcadeq, getAutoFinishMinutes(c));

  const queueResult = await c.env.arcadeq.prepare('SELECT * FROM queue_items ORDER BY position ASC').all();
  const items = (queueResult.results || []).map(formatQueueItem);
  return c.json(items);
});

app.get('/api/queue/:cabinetId/time-to-finish', async (c) => {
  const cabinetId = c.req.param('cabinetId');
  await expireOldItems(c.env.arcadeq, getAutoFinishMinutes(c));
  const row = await c.env.arcadeq
    .prepare('SELECT * FROM queue_items WHERE cabinet_id = ? ORDER BY position ASC LIMIT 1')
    .bind(cabinetId)
    .first();

  if (!row || !row.started_at) {
    return c.json({ remaining_seconds: null });
  }

  const autoFinishMinutes = getAutoFinishMinutes(c);
  const startedAt = new Date(row.started_at).getTime();
  const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const remainingSeconds = Math.max(0, autoFinishMinutes * 60 - elapsedSeconds);

  return c.json({ remaining_seconds: remainingSeconds });
});

app.get('/api/queue/:cabinetId', async (c) => {
  const cabinetId = c.req.param('cabinetId');
  await expireOldItems(c.env.arcadeq, getAutoFinishMinutes(c));
  const cabinet = await getCabinet(c.env.arcadeq, cabinetId);
  if (!cabinet) {
    return c.json({ message: 'Cabinet not found' }, { status: 404 });
  }

  return c.json(await getCabinetQueuePayload(c.env.arcadeq, cabinetId));
});

app.post('/api/queue', async (c) => {
  const body = await c.req.json();

  const cabinetId = body?.cabinet_id;
  const type = String(body?.type || '').trim();
  const ownerId = body?.owner_id ? String(body.owner_id) : null;

  const players = normalizePlayers(body?.players || []);
  if (!['solo', 'duo'].includes(type)) {
    return c.json({ message: 'type must be solo or duo' }, { status: 422 });
  }

  const cabinet = await getCabinet(c.env.arcadeq, cabinetId);
  if (!cabinet) {
    return c.json({ message: 'cabinet_id must point to an existing cabinet' }, { status: 422 });
  }

  const requestHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({
    cabinet_id: cabinetId,
    type,
    players,
    owner_id: ownerId,
  })));
  const hash = Array.from(new Uint8Array(requestHash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const existing = await c.env.arcadeq
    .prepare('SELECT * FROM queue_items WHERE request_hash = ?')
    .bind(hash)
    .first();

  if (existing) {
    return c.json(formatQueueItem(existing), { status: 200 });
  }

  const maxResult = await c.env.arcadeq
    .prepare('SELECT MAX(position) AS max_position FROM queue_items WHERE cabinet_id = ?')
    .bind(cabinetId)
    .first();
  const position = (maxResult?.max_position ?? 0) + 1;

  await c.env.arcadeq
    .prepare(
      'INSERT INTO queue_items (cabinet_id, type, players, position, request_hash, owner_id, is_playing, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, datetime("now"), datetime("now"))'
    )
    .bind(cabinetId, type, JSON.stringify(players), position, hash, ownerId)
    .run();

  const inserted = await c.env.arcadeq
    .prepare('SELECT * FROM queue_items WHERE request_hash = ?')
    .bind(hash)
    .first();

  return c.json(formatQueueItem(inserted), { status: 201 });
});

app.delete('/api/queue/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.arcadeq.prepare('DELETE FROM queue_items WHERE id = ?').bind(id).run();
  return c.json({ message: 'Deleted' });
});

app.post('/api/queue/:id/cycle', async (c) => {
  const id = c.req.param('id');
  const item = await getQueueItem(c.env.arcadeq, id);
  if (!item) {
    return c.json({ message: 'Queue item not found' }, { status: 404 });
  }

  const maxResult = await c.env.arcadeq
    .prepare('SELECT MAX(position) AS max_position FROM queue_items WHERE cabinet_id = ?')
    .bind(item.cabinet_id)
    .first();
  const maxPosition = (maxResult?.max_position ?? 0) + 1;

  await c.env.arcadeq.batch([
    { sql: 'BEGIN' },
    {
      sql: 'UPDATE queue_items SET position = ?, is_playing = 0, started_at = NULL WHERE id = ?',
      bindings: [maxPosition, id],
    },
    { sql: 'COMMIT' },
  ]);

  const next = await c.env.arcadeq
    .prepare('SELECT * FROM queue_items WHERE cabinet_id = ? AND id != ? ORDER BY position ASC LIMIT 1')
    .bind(item.cabinet_id, id)
    .first();

  if (next && !next.started_at) {
    await c.env.arcadeq
      .prepare('UPDATE queue_items SET started_at = datetime("now"), is_playing = 1 WHERE id = ?')
      .bind(next.id)
      .run();
  }

  return c.json({ message: 'Cycled' });
});

app.post('/api/queue/:id/finish', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const ownerId = body?.owner_id ? String(body.owner_id) : null;

  const item = await getQueueItem(c.env.arcadeq, id);
  if (!item) {
    return c.json({ message: 'Queue item not found' }, { status: 404 });
  }

  if (item.owner_id !== ownerId) {
    return c.json({ message: 'You do not have permission to finish this turn' }, { status: 403 });
  }

  await finishQueueItem(c.env.arcadeq, item);
  return c.json({ message: 'Turn finished' });
});

app.post('/api/queue/:id/move', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const targetCabinetId = body?.target_cabinet_id;

  if (!targetCabinetId) {
    return c.json({ message: 'target_cabinet_id is required' }, { status: 422 });
  }

  const targetCabinet = await getCabinet(c.env.arcadeq, targetCabinetId);
  if (!targetCabinet) {
    return c.json({ message: 'target_cabinet_id must point to an existing cabinet' }, { status: 422 });
  }

  const item = await getQueueItem(c.env.arcadeq, id);
  if (!item) {
    return c.json({ message: 'Queue item not found' }, { status: 404 });
  }

  const maxResult = await c.env.arcadeq
    .prepare('SELECT MAX(position) AS max_position FROM queue_items WHERE cabinet_id = ?')
    .bind(targetCabinetId)
    .first();

  const newPosition = (maxResult?.max_position ?? 0) + 1;
  await c.env.arcadeq
    .prepare('UPDATE queue_items SET cabinet_id = ?, position = ?, updated_at = datetime("now") WHERE id = ?')
    .bind(targetCabinetId, newPosition, id)
    .run();

  return c.json({ message: 'Moved' });
});

app.patch('/api/queue/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  if (!body?.players) {
    return c.json({ message: 'Nothing to update' }, { status: 400 });
  }

  const players = normalizePlayers(body.players);
  const item = await getQueueItem(c.env.arcadeq, id);
  if (!item) {
    return c.json({ message: 'Queue item not found' }, { status: 404 });
  }

  const newHashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify({
      cabinet_id: item.cabinet_id,
      type: item.type,
      players,
      owner_id: item.owner_id,
    }))
  );

  const newHash = Array.from(new Uint8Array(newHashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const collision = await c.env.arcadeq
    .prepare('SELECT id FROM queue_items WHERE request_hash = ? AND id != ?')
    .bind(newHash, id)
    .first();

  if (collision) {
    return c.json({ message: 'Duplicate queue entry detected' }, { status: 422 });
  }

  await c.env.arcadeq
    .prepare('UPDATE queue_items SET players = ?, request_hash = ?, updated_at = datetime("now") WHERE id = ?')
    .bind(JSON.stringify(players), newHash, id)
    .run();

  const updated = await getQueueItem(c.env.arcadeq, id);
  return c.json(formatQueueItem(updated));
});

// Export the Hono app as the default export so Wrangler publishes an ESM worker.
export default app;
