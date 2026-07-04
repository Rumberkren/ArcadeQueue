import { formatQueueItem } from './helpers.js';

export const finishQueueItem = async (db, item) => {
  if (!item) return;

  const maxResult = await db
    .prepare('SELECT MAX(position) AS max_position FROM queue_items WHERE cabinet_id = ?')
    .bind(item.cabinet_id)
    .first();
  const maxPosition = maxResult?.max_position ?? 0;

  await db.prepare(
    'UPDATE queue_items SET position = ?, is_playing = 0, started_at = NULL WHERE id = ?'
  )
  .bind(maxPosition + 1, item.id)
  .run();

  const next = await db
    .prepare('SELECT * FROM queue_items WHERE cabinet_id = ? AND id != ? ORDER BY position ASC LIMIT 1')
    .bind(item.cabinet_id, item.id)
    .first();

  if (next) {
    await db
      .prepare('UPDATE queue_items SET started_at = datetime("now"), is_playing = 1 WHERE id = ?')
      .bind(next.id)
      .run();
  }
};

export const expireOldItems = async (db, autoFinishMinutes) => {
  const expired = await db
    .prepare('SELECT * FROM queue_items WHERE started_at IS NOT NULL AND started_at < datetime("now", ?)')
    .bind(`-${autoFinishMinutes} minutes`)
    .all();

  if (!expired.results?.length) return;

  for (const item of expired.results) {
    await finishQueueItem(db, item);
  }
};

export const loadCabinetsWithItems = async (db) => {
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

export const getCabinetQueuePayload = async (db, cabinetId) => {
  const itemsResult = await db
    .prepare('SELECT * FROM queue_items WHERE cabinet_id = ? ORDER BY position ASC')
    .bind(cabinetId)
    .all();

  const items = (itemsResult.results || []).map(formatQueueItem);
  const currentSession = items.find(item => item.is_playing) || null;

  return {
    current_session: currentSession,
    queue_items: items,
  };
};