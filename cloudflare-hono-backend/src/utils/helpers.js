export const normalizePlayers = (players) => {
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

export const formatQueueItem = (row) => ({
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

export const getAutoFinishMinutes = (c) => {
  const raw = c.env.AUTO_FINISH_MINUTES || '17';
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? 17 : Math.max(1, parsed);
};

export const getCabinet = async (db, id) => {
  const result = await db.prepare('SELECT * FROM cabinets WHERE id = ?').bind(id).first();
  return result || null;
};

export const getQueueItem = async (db, id) => {
  const result = await db.prepare('SELECT * FROM queue_items WHERE id = ?').bind(id).first();
  return result || null;
};