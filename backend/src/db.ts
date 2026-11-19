import { PrismaClient } from '@prisma/client';

/** The one Prisma client for the whole backend. */
export const prisma = new PrismaClient();
