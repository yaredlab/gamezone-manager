/**
 * src/server.js
 * Express server entry point for GameZone Manager V2.
 */

import 'dotenv/config';
import express from 'express';
import cors    from 'cors';

import pricingRoutes      from './routes/pricing.js';
import consolesRoutes     from './routes/consoles.js';
import sessionsRoutes     from './routes/sessions.js';
import matchesRoutes      from './routes/matches.js';
import transactionsRoutes from './routes/transactions.js';
import workersRoutes      from './routes/workers.js';
import reportsRoutes      from './routes/reports.js';
import settingsRoutes     from './routes/settings.js';
import { errorHandler }   from './middleware/errorHandler.js';

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

// ── Health check ──────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '2.0.0', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────

app.use('/api/pricing',      pricingRoutes);
app.use('/api/consoles',     consolesRoutes);
app.use('/api/sessions',     sessionsRoutes);
app.use('/api/sessions',     matchesRoutes);       // /api/sessions/:id/matches
app.use('/api/transactions', transactionsRoutes);
app.use('/api/workers',      workersRoutes);
app.use('/api/reports',      reportsRoutes);
app.use('/api/settings',     settingsRoutes);

// ── Error handler ─────────────────────────────────────────────

app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🎮  GameZone Manager API running on http://localhost:${PORT}`);
  console.log(`    Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`    Database    : ${(process.env.DATABASE_URL || '').replace(/:\/\/.*@/, '://***@')}`);
});

export default app;
