/**
 * src/routes/reports.js
 *
 * GET /api/reports/daily      — Today's summary
 * GET /api/reports/weekly     — Last 7 days
 * GET /api/reports/monthly    — This calendar month
 */

import { Router }       from 'express';
import prisma           from '../utils/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// ── Helper: build date range ──────────────────────────────────
function getDateRange(range) {
  const now       = new Date();
  const todayMid  = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === 'daily') {
    return { from: todayMid, to: now };
  }
  if (range === 'weekly') {
    const weekStart = new Date(todayMid);
    weekStart.setDate(weekStart.getDate() - 6);
    return { from: weekStart, to: now };
  }
  // monthly
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: monthStart, to: now };
}

// ── Shared summary builder ────────────────────────────────────
async function buildSummary(range) {
  const { from, to } = getDateRange(range);

  const transactions = await prisma.transaction.findMany({
    where:   { createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: 'desc' },
  });

  const totalRevenue       = transactions.reduce((s, t) => s + Number(t.amountEtb), 0);
  const cashRevenue        = transactions.filter(t => t.method === 'Cash')           .reduce((s, t) => s + Number(t.amountEtb), 0);
  const mobileRevenue      = transactions.filter(t => t.method === 'Mobile_Banking') .reduce((s, t) => s + Number(t.amountEtb), 0);
  const telebirrRevenue    = transactions.filter(t => t.provider === 'Telebirr')     .reduce((s, t) => s + Number(t.amountEtb), 0);
  const cbeRevenue         = transactions.filter(t => t.provider === 'Commercial_Bank_of_Ethiopia').reduce((s, t) => s + Number(t.amountEtb), 0);

  // Console breakdown
  const byConsole = {};
  transactions.forEach(t => {
    const names = t.consoleName.split(',').map(s => s.trim()).filter(Boolean);
    names.forEach(name => {
      if (!byConsole[name]) byConsole[name] = { revenue: 0, transactions: 0, matches: 0 };
      byConsole[name].revenue      += Number(t.amountEtb) / names.length;
      byConsole[name].transactions += 1;
      byConsole[name].matches      += t.matchesCount;
    });
  });

  const consolePerformance = Object.entries(byConsole)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    range,
    from: from.toISOString(),
    to:   to.toISOString(),
    totalTransactions: transactions.length,
    totalRevenue,
    cashRevenue,
    mobileRevenue,
    telebirrRevenue,
    cbeRevenue,
    consolePerformance,
    transactions: transactions.map(t => ({
      id:           t.id,
      txRef:        t.txRef,
      consoleName:  t.consoleName,
      amount:       Number(t.amountEtb),
      method:       t.method,
      provider:     t.provider,
      matchesCount: t.matchesCount,
      description:  t.description,
      createdAt:    t.createdAt.toISOString(),
      time:         t.createdAt.toLocaleTimeString(),
    })),
  };
}

router.get('/daily',   asyncHandler(async (_req, res) => res.json(await buildSummary('daily'))));
router.get('/weekly',  asyncHandler(async (_req, res) => res.json(await buildSummary('weekly'))));
router.get('/monthly', asyncHandler(async (_req, res) => res.json(await buildSummary('monthly'))));

export default router;
