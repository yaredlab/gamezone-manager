/**
 * src/routes/pricing.js
 *
 * GET  /api/pricing        — Return current active pricing for all modes
 * PUT  /api/pricing        — Admin updates pricing (creates new rows, expires old)
 */

import { Router }        from 'express';
import prisma            from '../utils/prisma.js';
import { asyncHandler }  from '../middleware/errorHandler.js';

const router = Router();

// ── GET /api/pricing ──────────────────────────────────────────
// Returns the same shape as V1 getPricing() in api.js so the
// frontend needs only a one-line change.
router.get('/', asyncHandler(async (_req, res) => {
  const rows = await prisma.pricing.findMany({
    where:   { validUntil: null },
    orderBy: { validFrom: 'desc' },
  });

  // Build the same flat object as V1 DEFAULT_PRICING
  const ps4Row      = rows.find(r => r.consoleType === 'PS4'  && r.gameMode === 'FIFA');
  const ps5Row      = rows.find(r => r.consoleType === 'PS5'  && r.gameMode === 'FIFA');
  const missionRow  = rows.find(r => r.gameMode === 'MISSION');

  const pricing = {
    ps4:             Number(ps4Row?.priceEtb     ?? 25),
    ps5:             Number(ps5Row?.priceEtb     ?? 30),
    missionPrice:    Number(missionRow?.priceEtb ?? 50),
    missionInterval: missionRow?.billingIntervalMin ?? 30,
    // Legacy aliases kept for backward compatibility
    mission30:       Number(missionRow?.priceEtb ?? 50),
    mission60:       Number(missionRow?.priceEtb ?? 50) * 2,
  };

  res.json(pricing);
}));

// ── PUT /api/pricing ──────────────────────────────────────────
router.put('/', asyncHandler(async (req, res) => {
  const { ps4, ps5, missionPrice, missionInterval, changedBy = 'admin' } = req.body;

  if ([ps4, ps5, missionPrice].some(v => typeof v !== 'number' || v <= 0)) {
    return res.status(400).json({ error: 'Validation', message: 'ps4, ps5, and missionPrice must be positive numbers.' });
  }

  const interval = Math.max(1, Math.round(Number(missionInterval) || 30));

  // Expire existing active pricing rows
  await prisma.pricing.updateMany({
    where: { validUntil: null },
    data:  { validUntil: new Date() },
  });

  // Insert fresh pricing rows
  await prisma.pricing.createMany({
    data: [
      { consoleType: 'PS4',  gameMode: 'FIFA',    billingIntervalMin: interval, priceEtb: ps4 },
      { consoleType: 'PS5',  gameMode: 'FIFA',    billingIntervalMin: interval, priceEtb: ps5 },
      { consoleType: null,   gameMode: 'MISSION', billingIntervalMin: interval, priceEtb: missionPrice },
    ],
  });

  // Write to audit log
  await prisma.pricingAuditLog.create({
    data: {
      changedBy,
      ps4Price:        ps4,
      ps5Price:        ps5,
      missionPrice,
      missionInterval: interval,
    },
  });

  res.json({
    ok: true,
    pricing: { ps4, ps5, missionPrice, missionInterval: interval },
  });
}));

export default router;
