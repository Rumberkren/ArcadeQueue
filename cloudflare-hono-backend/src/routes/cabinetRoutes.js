import { Hono } from 'hono';
import { getCabinet } from '../utils/helpers.js';
import { loadCabinetsWithItems } from '../utils/queueOps.js';

const cabinets = new Hono();

cabinets.get('/', async (c) => {
  const data = await loadCabinetsWithItems(c.env.arcadeq);
  return c.json(data);
});

cabinets.post('/', async (c) => {
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

cabinets.put('/:id', async (c) => {
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

cabinets.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.arcadeq.prepare('DELETE FROM cabinets WHERE id = ?').bind(id).run();
  return c.json({ message: 'Deleted' });
});

cabinets.patch('/:id/reorder', async (c) => {
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

export default cabinets;