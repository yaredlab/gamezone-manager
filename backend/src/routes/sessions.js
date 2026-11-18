/**
 * src/routes/sessions.js
 *
 * POST   /api/sessions                  — Start a session
 * PATCH  /api/sessions/:id/pause        — Pause
 * PATCH  /api/sessions/:id/resume       — Resume
 * PATCH  /api/sessions/:id/end          — End session
 * PATCH  /api/sessions/:id/mode         — Toggle FIFA / MISSION
 * GET    /api/sessions/active           — All currently active sessions
 */

import { Router }       from 'express';
import prisma           from '../utils/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// ── Helper: resolve console db id from name ───────────────────
async function findConsoleByName(name) {
  return prisma.console.findUnique({ where: { name: name.toUpperCase() } });
}

// ── Helper: get elapsed seconds including live time ───────────
function totalElapsed(session) {
  if (session.status === 'playing' && session.startedAt) {
    const liveSeconds = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    return session.elapsedSeconds + liveSeconds;
  }
  return session.elapsedSeconds;
}

// ── POST /api/sessions — Start ────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { consoleName, mode = 'FIFA', shiftId } = req.body;
  if (!consoleName) {
    return res.status(400).json({ error: 'Validation', message: 'consoleName is required.' });
  }

  const con = await findConsoleByName(consoleName);
  if (!con) return res.status(404).json({ error: 'Not Found', message: `Console "${consoleName}" not found.` });

  // End any stale sessions
  await prisma.gameSession.updateMany({
    where: { consoleId: con.id, status: { in: ['playing', 'paused'] } },
    data:  { status: 'ended', endedAt: new Date() },
  });

  const session = await prisma.gameSession.create({
    data: {
      consoleId:           con.id,
      shiftId:             shiftId || null,
      mode:                mode.toUpperCase(),
      status:              'playing',
      startedAt:           new Date(),
      elapsedSeconds:      0,
      matchTimerElapsed:   0,
      matchTimerStartedAt: new Date(),
    },
  });

  res.status(201).json(session);
}));

// ── PATCH /api/sessions/:id/pause ────────────────────────────
router.patch('/:id/pause', asyncHandler(async (req, res) => {
  const id      = Number(req.params.id);
  const session = await prisma.gameSession.findUnique({ where: { id } });
  if (!session) return res.status(404).json({ error: 'Not Found', message: 'Session not found.' });
  if (session.status !== 'playing') {
    return res.status(409).json({ error: 'Conflict', message: 'Session is not currently playing.' });
  }

  const elapsed        = totalElapsed(session);
  const matchElapsed   = (session.matchTimerElapsed || 0) + (
    session.matchTimerStartedAt
      ? Math.floor((Date.now() - new Date(session.matchTimerStartedAt).getTime()) / 1000)
      : 0
  );

  const updated = await prisma.gameSession.update({
    where: { id },
    data: {
      status:              'paused',
      pausedAt:            new Date(),
      elapsedSeconds:      elapsed,
      startedAt:           null,
      matchTimerElapsed:   matchElapsed,
      matchTimerStartedAt: null,
    },
  });

  res.json(updated);
}));

// ── PATCH /api/sessions/:id/resume ───────────────────────────
router.patch('/:id/resume', asyncHandler(async (req, res) => {
  const id      = Number(req.params.id);
  const session = await prisma.gameSession.findUnique({ where: { id } });
  if (!session) return res.status(404).json({ error: 'Not Found', message: 'Session not found.' });
  if (session.status !== 'paused') {
    return res.status(409).json({ error: 'Conflict', message: 'Session is not paused.' });
  }

  const updated = await prisma.gameSession.update({
    where: { id },
    data: {
      status:              'playing',
      startedAt:           new Date(),
      pausedAt:            null,
      matchTimerStartedAt: new Date(),
    },
  });

  res.json(updated);
}));

// ── PATCH /api/sessions/:id/end ───────────────────────────────
router.patch('/:id/end', asyncHandler(async (req, res) => {
  const id      = Number(req.params.id);
  const session = await prisma.gameSession.findUnique({
    where:   { id },
    include: { matches: { where: { isPaid: false } } },
  });
  if (!session) return res.status(404).json({ error: 'Not Found', message: 'Session not found.' });

  if (session.matches.length > 0) {
    return res.status(409).json({
      error:   'Unpaid Matches',
      message: `This session has ${session.matches.length} unpaid match bubble(s). Record payment before ending.`,
      unpaidCount: session.matches.length,
    });
  }

  const updated = await prisma.gameSession.update({
    where: { id },
    data: {
      status:              'ended',
      endedAt:             new Date(),
      elapsedSeconds:      totalElapsed(session),
      startedAt:           null,
      matchTimerStartedAt: null,
    },
  });

  res.json(updated);
}));

// ── PATCH /api/sessions/:id/mode — Toggle FIFA/MISSION ───────
router.patch('/:id/mode', asyncHandler(async (req, res) => {
  const id      = Number(req.params.id);
  const session = await prisma.gameSession.findUnique({ where: { id } });
  if (!session) return res.status(404).json({ error: 'Not Found', message: 'Session not found.' });
  if (session.status !== 'free') {
    return res.status(409).json({ error: 'Conflict', message: 'Cannot change mode while a session is active.' });
  }

  const newMode = session.mode === 'FIFA' ? 'MISSION' : 'FIFA';
  const updated = await prisma.gameSession.update({
    where: { id },
    data: { mode: newMode, matchTimerElapsed: 0, matchTimerStartedAt: null },
  });

  res.json(updated);
}));

// ── GET /api/sessions/active ──────────────────────────────────
router.get('/active', asyncHandler(async (_req, res) => {
  const sessions = await prisma.gameSession.findMany({
    where:   { status: { in: ['playing', 'paused'] } },
    include: {
      console: true,
      matches: { orderBy: { matchNumber: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(sessions);
}));

export default router;
