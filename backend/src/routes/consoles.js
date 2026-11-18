/**
 * src/routes/consoles.js
 *
 * GET    /api/consoles       — List all consoles with current session info
 * POST   /api/consoles       — Add a console (admin only)
 * PATCH  /api/consoles/:id   — Rename a console (admin only)
 * DELETE /api/consoles/:id   — Remove a console (admin only, only if free)
 */

import { Router }       from 'express';
import prisma           from '../utils/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// ── GET /api/consoles ─────────────────────────────────────────
router.get('/', asyncHandler(async (_req, res) => {
  const consoles = await prisma.console.findMany({
    where:   { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      sessions: {
        where:   { status: { in: ['playing', 'paused'] } },
        orderBy: { createdAt: 'desc' },
        take:    1,
        include: {
          matches: {
            orderBy: { matchNumber: 'asc' },
          },
        },
      },
    },
  });

  // Map to same shape as V1 ConsoleObj
  const result = consoles.map(c => {
    const session = c.sessions[0] || null;
    return {
      id:                  c.name,              // V1 uses name as id
      dbId:                c.id,
      type:                c.type,
      status:              session?.status ?? 'free',
      mode:                session?.mode   ?? 'FIFA',
      elapsed:             session?.elapsedSeconds ?? 0,
      startedAt:           session?.startedAt?.getTime() ?? null,
      matchTimerElapsed:   session?.matchTimerElapsed ?? 0,
      matchTimerStartedAt: session?.matchTimerStartedAt?.getTime() ?? null,
      sessionId:           session?.id ?? null,
      matches: (session?.matches ?? []).map(m => ({
        id:        m.id,
        paid:      m.isPaid,
        method:    null,
        price:     Number(m.priceEtb),
        createdAt: m.createdAt.getTime(),
      })),
    };
  });

  res.json(result);
}));

// ── POST /api/consoles ────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name || !['PS4', 'PS5'].includes(type)) {
    return res.status(400).json({ error: 'Validation', message: 'name and type (PS4|PS5) are required.' });
  }

  const console_ = await prisma.console.create({
    data: { name: name.trim().toUpperCase(), type },
  });

  res.status(201).json(console_);
}));

// ── PATCH /api/consoles/:id ───────────────────────────────────
router.patch('/:id', asyncHandler(async (req, res) => {
  const dbId   = Number(req.params.id);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Validation', message: 'name is required.' });

  // Check no active session
  const active = await prisma.gameSession.findFirst({
    where: { consoleId: dbId, status: { in: ['playing', 'paused'] } },
  });
  if (active) {
    return res.status(409).json({ error: 'Conflict', message: 'Cannot rename a console with an active session.' });
  }

  const updated = await prisma.console.update({
    where: { id: dbId },
    data:  { name: name.trim().toUpperCase() },
  });
  res.json(updated);
}));

// ── DELETE /api/consoles/:id ──────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const dbId = Number(req.params.id);

  const active = await prisma.gameSession.findFirst({
    where: { consoleId: dbId, status: { in: ['playing', 'paused'] } },
  });
  if (active) {
    return res.status(409).json({ error: 'Conflict', message: 'Cannot remove a console with an active session.' });
  }

  // Soft-delete
  await prisma.console.update({
    where: { id: dbId },
    data:  { isActive: false },
  });
  res.json({ ok: true });
}));

export default router;
