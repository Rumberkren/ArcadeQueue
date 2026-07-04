import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initializeSchema } from './database/schema.js';
import { expireOldItems } from './utils/queueOps.js';
import cabinetRoutes from './routes/cabinetRoutes.js';
import queueRoutes from './routes/queueRoutes.js';

const app = new Hono();

// CORS Settings
app.use('*', cors({ origin: '*' }));
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}));

// Auto-run schema migrations on incoming hits
app.use('*', async (c, next) => {
  await initializeSchema(c.env.arcadeq);
  return next();
});

// Health check endpoint
app.get('/api/health', async (c) => {
  try {
    await c.env.arcadeq.prepare('SELECT 1').first();
    return c.json({ status: 'ok' });
  } catch (error) {
    return c.json({ status: 'error', message: error?.message || 'DB error' }, { status: 500 });
  }
});

// Mount modular sub-routers
app.route('/api/cabinets', cabinetRoutes);
app.route('/api/queue', queueRoutes);

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    const autoFinishMinutes = parseInt(env.AUTO_FINISH_MINUTES, 10) || 17;
    ctx.waitUntil(expireOldItems(env.arcadeq, autoFinishMinutes));
  }
};