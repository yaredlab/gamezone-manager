/**
 * src/routes/transactions.js
 *
 * GET  /api/transactions           — List transactions (with date/method filters)
 * POST /api/transactions           — Record a payment (marks match bubbles as paid)
 * GET  /api/transactions/export    — CSV export
 */

import { Router }       from 'express';
import prisma           from '../utils/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// ── Date filter helper ────────────────────────────────────────
function buildDateFilter(filter) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === 'today') {
    return { gte: today };
  }
  if (filter === 'yesterday') {
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    return { gte: yest, lt: today };
  }
  if (filter === 'week') {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    return { gte: weekStart };
  }
  if (filter === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return { gte: monthStart };
  }
  return undefined; // 'all'
}

// ── GET /api/transactions ─────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { date = 'all', method, status, search, skip = '0', take = '200' } = req.query;

  const where = {};
  const dateFilter = buildDateFilter(date);
  if (dateFilter) where.createdAt = dateFilter;
  if (method && method !== 'all') where.method = method;
  if (search) {
    where.OR = [
      { consoleName:  { contains: search, mode: 'insensitive' } },
      { txRef:        { contains: search, mode: 'insensitive' } },
      { description:  { contains: search, mode: 'insensitive' } },
    ];
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip:    Number(skip),
    take:    Number(take),
    include: {
      transactionMatches: {
        include: { match: true },
      },
    },
  });

  const total = await prisma.transaction.count({ where });

  res.json({
    total,
    data: transactions.map(formatTx),
  });
}));

// ── POST /api/transactions ────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { matchIds, method, provider, consoleName, description, workerId, sessionId, shiftId } = req.body;

  if (!Array.isArray(matchIds) || matchIds.length === 0) {
    return res.status(400).json({ error: 'Validation', message: 'matchIds must be a non-empty array.' });
  }
  if (!method || !['Cash', 'Mobile_Banking'].includes(method)) {
    return res.status(400).json({ error: 'Validation', message: 'method must be Cash or Mobile_Banking.' });
  }
  if (method === 'Mobile_Banking' && !['Telebirr', 'Commercial_Bank_of_Ethiopia'].includes(provider)) {
    return res.status(400).json({ error: 'Validation', message: 'provider required for Mobile_Banking.' });
  }

  // Fetch and validate matches
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
  });

  const unpaid = matches.filter(m => !m.isPaid);
  if (unpaid.length !== matchIds.length) {
    return res.status(409).json({ error: 'Conflict', message: 'Some matches are already paid or not found.' });
  }

  const totalAmount = unpaid.reduce((sum, m) => sum + Number(m.priceEtb), 0);
  const txRef       = 'TX-' + String(Date.now()).slice(-6);

  const tx = await prisma.$transaction(async (tx) => {
    // Create transaction record
    const transaction = await tx.transaction.create({
      data: {
        txRef,
        shiftId:     shiftId   || null,
        sessionId:   sessionId || null,
        workerId:    workerId  || null,
        consoleName: consoleName || 'Unknown',
        amountEtb:   totalAmount,
        method,
        provider:    method === 'Mobile_Banking' ? provider : null,
        matchesCount: unpaid.length,
        description: description || `${unpaid.length} match(es) marked PAID ✓`,
      },
    });

    // Mark each match as paid
    await tx.match.updateMany({
      where: { id: { in: matchIds } },
      data:  { isPaid: true, paidAt: new Date() },
    });

    // Insert bridge rows
    await tx.transactionMatch.createMany({
      data: matchIds.map(mid => ({
        transactionId: transaction.id,
        matchId:       mid,
      })),
    });

    return transaction;
  });

  res.status(201).json({
    id:        tx.id,
    txRef:     tx.txRef,
    amount:    Number(tx.amountEtb),
    method:    tx.method,
    provider:  tx.provider,
    createdAt: tx.createdAt.toISOString(),
  });
}));

// ── GET /api/transactions/export (CSV) ───────────────────────
router.get('/export', asyncHandler(async (req, res) => {
  const { date = 'all' } = req.query;
  const dateFilter = buildDateFilter(date);
  const where = dateFilter ? { createdAt: dateFilter } : {};

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  const header = ['TX Ref', 'Date', 'Time', 'Console', 'Method', 'Provider', 'Matches', 'Amount (ETB)', 'Description'];
  const csvRows = rows.map(t => [
    t.txRef,
    t.createdAt.toLocaleDateString(),
    t.createdAt.toLocaleTimeString(),
    t.consoleName,
    t.method,
    t.provider || '',
    t.matchesCount,
    Number(t.amountEtb).toFixed(2),
    (t.description || '').replace(/"/g, '""'),
  ]);

  const csv = [header, ...csvRows]
    .map(r => r.map(v => `"${v}"`).join(','))
    .join('\n');

  const filename = `gamezone-transactions-${date}-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}));

// ── Formatter ─────────────────────────────────────────────────
function formatTx(t) {
  return {
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
    status:       'PAID',
  };
}

export default router;
