/**
 * prisma/seed.js
 * Seeds the database with GameZone Manager default data.
 *
 * Run with: node prisma/seed.js
 * Or via npm: npm run db:seed
 */

import { PrismaClient, ConsoleType, GameMode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding GameZone Manager database…');

  // ── Business settings ────────────────────────────────────────
  await prisma.businessSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      id:           1,
      businessName: 'GameZone',
      location:     '',
      phone:        '',
      currency:     'ETB',
      timezone:     'Africa/Addis_Ababa',
    },
  });
  console.log('  ✓ Business settings');

  // ── Default consoles (match V1 localStorage defaults) ────────
  const defaultConsoles = [
    { name: 'PS4-01', type: ConsoleType.PS4 },
    { name: 'PS4-02', type: ConsoleType.PS4 },
    { name: 'PS4-03', type: ConsoleType.PS4 },
    { name: 'PS4-04', type: ConsoleType.PS4 },
    { name: 'PS5-01', type: ConsoleType.PS5 },
    { name: 'PS5-02', type: ConsoleType.PS5 },
    { name: 'PS5-03', type: ConsoleType.PS5 },
  ];

  for (const c of defaultConsoles) {
    await prisma.console.upsert({
      where:  { name: c.name },
      update: {},
      create: c,
    });
  }
  console.log(`  ✓ ${defaultConsoles.length} consoles`);

  // ── Default pricing ──────────────────────────────────────────
  // Expire any old active rows first
  await prisma.pricing.updateMany({
    where:  { validUntil: null },
    data:   { validUntil: new Date() },
  });

  const defaultPricing = [
    { consoleType: ConsoleType.PS4, gameMode: GameMode.FIFA,    billingIntervalMin: 30, priceEtb: 25.00 },
    { consoleType: ConsoleType.PS5, gameMode: GameMode.FIFA,    billingIntervalMin: 30, priceEtb: 30.00 },
    { consoleType: null,            gameMode: GameMode.MISSION, billingIntervalMin: 30, priceEtb: 50.00 },
  ];

  for (const p of defaultPricing) {
    await prisma.pricing.create({ data: p });
  }
  console.log('  ✓ Default pricing (PS4=25 ETB, PS5=30 ETB, Mission=50 ETB/30 min)');

  // ── Default admin worker account ─────────────────────────────
  // PIN: 1234 — CHANGE THIS IMMEDIATELY in production
  // Hash generated with: bcrypt.hashSync('1234', 12)
  const bcrypt = await import('bcryptjs');
  const adminPinHash = await bcrypt.hash('1234', 12);

  await prisma.worker.upsert({
    where:  { username: 'admin' },
    update: {},
    create: {
      name:     'Administrator',
      username: 'admin',
      pinHash:  adminPinHash,
      role:     'admin',
      isActive: true,
    },
  });

  const workerPinHash = await bcrypt.hash('0000', 12);
  await prisma.worker.upsert({
    where:  { username: 'worker1' },
    update: {},
    create: {
      name:     'Worker 1',
      username: 'worker1',
      pinHash:  workerPinHash,
      role:     'worker',
      isActive: true,
    },
  });

  console.log('  ✓ Worker accounts (admin PIN: 1234 — change immediately!)');
  console.log('\n✅  Seed complete.');
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
