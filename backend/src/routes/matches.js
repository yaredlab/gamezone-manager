/**
 * src/routes/matches.js
 *
 * POST  /api/sessions/:id/matches       — Add a match bubble (manual or auto)
 * GET   /api/sessions/:id/matches       — List match bubbles for a session
 */

import { Router }       from 'express';
import prisma           from '../utils/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router({ mergeParams: true });

// ── Helper: get active price from DB ─────────────────────────
async function getActivePrice(consoleType, gameMode) {
  const row = await prisma.pricing.findFirst({
    where: {
      validUntil: null,
      gameMode,
      OR: [{ consoleType }, { consoleType: null }],
    },
    orderBy: [{ consoleType: 'asc' }, { validFrom: 'desc' }],
  });
  return row ? Number(row.priceEtb) : (gameMode === 'FIFA' ? (consoleType === 'PS5' ? 30 : 25) : 50);
}

// ── POST /api/sessions/:id/matches ────────────────────────────
router.post('/:id/matches', asyncHandler(async (req, res) => {
  const sessionId = Number(req.params.id);
  const { isAuto = false } = req.body;

  const session = await prisma.gameSession.findUnique({
    where:   { id: sessionId },
    include: { console: true, matches: true },
  });

  if (!session) {
    return res.status(404).json({ error: 'Not Found', message: 'Session not found.' });
  }
  if (session.status !== 'playing') {
    return res.status(409).json({ error: 'Conflict', message: 'Session is not currently playing.' });
  }

  const matchNumber = session.matches.length + 1;
  const price       = await getActivePrice(session.console.type, session.mode);

  // Create the match bubble
  const match = await prisma.match.create({
    data: {
      sessionId,
      bubbleType:  session.mode,
      matchNumber,
      priceEtb:    price,
      isPaid:      false,
    },
  });

  // Reset match cycle timer in the session (FIFA only)
  if (session.mode === 'FIFA') {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        matchTimerElapsed:   0,
        matchTimerStartedAt: new Date(),
      },
    });
  }

  res.status(201).json({
    id:        match.id,
    paid:      match.isPaid,
    method:    null,
    price:     Number(match.priceEtb),
    createdAt: match.createdAt.getTime(),
    matchNumber,
    isAuto,
  });
}));

// ── GET /api/sessions/:id/matches ─────────────────────────────
router.get('/:id/matches', asyncHandler(async (req, res) => {
  const sessionId = Number(req.params.id);
  const matches   = await prisma.match.findMany({
    where:   { sessionId },
    orderBy: { matchNumber: 'asc' },
  });

  res.json(matches.map(m => ({
    id:          m.id,
    paid:        m.isPaid,
    price:       Number(m.priceEtb),
    matchNumber: m.matchNumber,
    createdAt:   m.createdAt.getTime(),
  })));
}));

export default router;
