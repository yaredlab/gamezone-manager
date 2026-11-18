/**
 * src/routes/settings.js
 *
 * GET  /api/settings      — Load business settings
 * PUT  /api/settings      — Save business settings
 */

import { Router }       from 'express';
import prisma           from '../utils/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// ── GET /api/settings ─────────────────────────────────────────
router.get('/', asyncHandler(async (_req, res) => {
  const settings = await prisma.businessSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, businessName: 'GameZone' },
  });

  res.json({
    businessName: settings.businessName,
    location:     settings.location,
    phone:        settings.phone,
    currency:     settings.currency,
    timezone:     settings.timezone,
  });
}));

// ── PUT /api/settings ─────────────────────────────────────────
router.put('/', asyncHandler(async (req, res) => {
  const { businessName, location, phone, currency, timezone } = req.body;

  if (!businessName?.trim()) {
    return res.status(400).json({ error: 'Validation', message: 'businessName is required.' });
  }

  const updated = await prisma.businessSettings.upsert({
    where:  { id: 1 },
    update: { businessName: businessName.trim(), location, phone, currency, timezone },
    create: { id: 1, businessName: businessName.trim(), location, phone, currency, timezone },
  });

  res.json({
    businessName: updated.businessName,
    location:     updated.location,
    phone:        updated.phone,
    currency:     updated.currency,
    timezone:     updated.timezone,
  });
}));

export default router;
