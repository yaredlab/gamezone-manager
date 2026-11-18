/**
 * src/routes/workers.js
 *
 * GET    /api/workers          — List all workers (admin)
 * POST   /api/workers          — Add a worker (admin)
 * PATCH  /api/workers/:id      — Edit worker name, role, active status (admin)
 * DELETE /api/workers/:id      — Remove a worker (admin)
 */

import { Router }       from 'express';
import bcrypt           from 'bcryptjs';
import prisma           from '../utils/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

// ── GET /api/workers ──────────────────────────────────────────
router.get('/', asyncHandler(async (_req, res) => {
  const workers = await prisma.worker.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id:        true,
      name:      true,
      username:  true,
      role:      true,
      isActive:  true,
      createdAt: true,
      // pinHash intentionally excluded
    },
  });
  res.json(workers);
}));

// ── POST /api/workers ─────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { name, username, pin, role = 'worker' } = req.body;

  if (!name || !username || !pin) {
    return res.status(400).json({ error: 'Validation', message: 'name, username, and pin are required.' });
  }
  if (String(pin).length < 4) {
    return res.status(400).json({ error: 'Validation', message: 'PIN must be at least 4 digits.' });
  }

  const pinHash = await bcrypt.hash(String(pin), BCRYPT_ROUNDS);

  const worker = await prisma.worker.create({
    data: { name, username: username.toLowerCase(), pinHash, role },
    select: { id: true, name: true, username: true, role: true, isActive: true, createdAt: true },
  });

  res.status(201).json(worker);
}));

// ── PATCH /api/workers/:id ────────────────────────────────────
router.patch('/:id', asyncHandler(async (req, res) => {
  const id  = Number(req.params.id);
  const { name, pin, role, isActive } = req.body;

  const data = {};
  if (name     !== undefined) data.name     = name;
  if (role     !== undefined) data.role     = role;
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  if (pin      !== undefined) {
    if (String(pin).length < 4) {
      return res.status(400).json({ error: 'Validation', message: 'PIN must be at least 4 digits.' });
    }
    data.pinHash = await bcrypt.hash(String(pin), BCRYPT_ROUNDS);
  }

  const worker = await prisma.worker.update({
    where:  { id },
    data,
    select: { id: true, name: true, username: true, role: true, isActive: true },
  });

  res.json(worker);
}));

// ── DELETE /api/workers/:id ───────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.worker.update({
    where: { id },
    data:  { isActive: false },
  });
  res.json({ ok: true });
}));

export default router;
