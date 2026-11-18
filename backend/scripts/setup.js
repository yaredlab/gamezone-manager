#!/usr/bin/env node
/**
 * scripts/setup.js
 * Interactive setup helper for GameZone Manager V2 backend.
 *
 * Run from the backend/ directory:
 *   node scripts/setup.js
 */

import { writeFileSync, existsSync } from 'fs';
import { createInterface }           from 'readline';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(resolve => rl.question(q, resolve));

console.log('\n🎮  GameZone Manager V2 — Backend Setup\n');
console.log('This wizard creates your .env file and verifies the connection.\n');

const dbUser     = await ask('PostgreSQL username  [gamezone_user]: ')  || 'gamezone_user';
const dbPassword = await ask('PostgreSQL password  : ');
const dbHost     = await ask('PostgreSQL host      [localhost]: ')       || 'localhost';
const dbPort     = await ask('PostgreSQL port      [5432]: ')            || '5432';
const dbName     = await ask('Database name        [gamezone_v2]: ')     || 'gamezone_v2';
const apiPort    = await ask('API server port      [4000]: ')            || '4000';

const crypto = await import('crypto');
const jwtSecret = crypto.randomBytes(64).toString('hex');

const envContent = `# GameZone Manager V2 — Environment
DATABASE_URL="postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}"
PORT=${apiPort}
NODE_ENV=development
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=8h
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000
BCRYPT_ROUNDS=12
`;

if (existsSync('.env')) {
  const overwrite = await ask('\n.env already exists. Overwrite? [y/N]: ');
  if (!overwrite.toLowerCase().startsWith('y')) {
    console.log('Skipped .env creation.');
    rl.close();
    process.exit(0);
  }
}

writeFileSync('.env', envContent);
console.log('\n✅  .env created successfully.');
console.log('\nNext steps:');
console.log('  1. Create the PostgreSQL database:');
console.log(`       psql -U postgres -c "CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}';"`);
console.log(`       psql -U postgres -c "CREATE DATABASE ${dbName} OWNER ${dbUser};"`);
console.log('  2. Install dependencies:');
console.log('       npm install');
console.log('  3. Run Prisma migrations:');
console.log('       npm run db:migrate');
console.log('  4. Seed default data:');
console.log('       npm run db:seed');
console.log('  5. Start the server:');
console.log('       npm run dev\n');

rl.close();
