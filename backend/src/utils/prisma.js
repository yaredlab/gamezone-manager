/**
 * src/utils/prisma.js
 * Singleton Prisma client shared across all route modules.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['warn', 'error'],
});

export default prisma;
