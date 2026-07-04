import { Hono } from 'hono';
import { normalizePlayers, formatQueueItem, getAutoFinishMinutes, getCabinet, getQueueItem } from '../utils/helpers.js';
import { expireOldItems, getCabinetQueuePayload, finishQueueItem } from '../utils/queueOps.js';

const queue = new Hono();

queue.post('/', async (c) => {
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

  const existingCount = await c.env.arcadeq
    .prepare('SELECT COUNT(*) AS cnt FROM queue_items WHERE cabinet_id = ?')
    .bind(cabinetId)
    .first();
  const isFirst = (existingCount?.cnt ?? 0) === 0;

  await c.env.arcadeq
    .prepare(
      'INSERT INTO queue_items (cabinet_id, type, players, position, request_hash, owner_id, is_playing, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))'
    )
    .bind(
      cabinetId,
      type,
      JSON.stringify(players),
      position,
      hash,
      ownerId,
      isFirst ? 1 : 0,
      isFirst ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null
    )
    .run();

  const inserted = await c.env.arcadeq
    .prepare('SELECT * FROM queue_items WHERE request_hash = ?')
    .bind(hash)
    .first();

  return c.json(formatQueueItem(inserted), { status: 201 });
});

queue.get('/:cabinetId/time-to-finish', async (c) => {
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

queue.get('/:cabinetId', async (c) => {
  const cabinetId = c.req.param('cabinetId');
  await expireOldItems(c.env.arcadeq, getAutoFinishMinutes(c));
  const cabinet = await getCabinet(c.env.arcadeq, cabinetId);
  if (!cabinet) {
    return c.json({ message: 'Cabinet not found' }, { status: 404 });
  }

  return c.json(await getCabinetQueuePayload(c.env.arcadeq, cabinetId));
});

queue.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.arcadeq.prepare('DELETE FROM queue_items WHERE id = ?').bind(id).run();
  return c.json({ message: 'Deleted' });
});

queue.post('/:id/cycle', async (c) => {
  const requestId = Math.random().toString(36).substring(7);
  try {
    const id = c.req.param('id');
    const db = c.env.arcadeq;
    const item = await getQueueItem(db, id);
    
    if (!item) {
      return c.json({ message: 'Queue item not found' }, { status: 404 });
    }

    const maxResult = await db
      .prepare('SELECT MAX(position) AS max_position FROM queue_items WHERE cabinet_id = ?')
      .bind(item.cabinet_id)
      .first();
    const maxPosition = maxResult?.max_position ?? 0;
    const targetBackPosition = maxPosition + 1;

    await db.batch([
      db.prepare('UPDATE queue_items SET is_playing = 0, started_at = NULL, position = ?, updated_at = datetime("now") WHERE id = ?')
        .bind(targetBackPosition, id),
      db.prepare('UPDATE queue_items SET position = position - 1 WHERE cabinet_id = ? AND position > ? AND id != ?')
        .bind(item.cabinet_id, item.position, id)
    ]);

    const next = await db
      .prepare('SELECT * FROM queue_items WHERE cabinet_id = ? ORDER BY position ASC LIMIT 1')
      .bind(item.cabinet_id)
      .first();

    if (next) {
      await db
        .prepare('UPDATE queue_items SET started_at = datetime("now"), is_playing = 1 WHERE id = ?')
        .bind(next.id)
        .run();
    }

    const updatedItem = await getQueueItem(db, id);
    return c.json({ 
      message: 'Cycled', 
      item_id: id, 
      new_position: updatedItem?.position ?? targetBackPosition 
    });

  } catch (error) {
    console.error(`[CYCLE-${requestId}] ERROR:`, error);
    return c.json({ message: 'Error cycling queue', error: error?.message }, { status: 500 });
  }
});

queue.post('/:id/finish', async (c) => {
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

queue.post('/:id/move', async (c) => {
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

queue.patch('/:id', async (c) => {
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

export default queue;