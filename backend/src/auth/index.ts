import { prisma } from '../db';
import { createGuards } from './guards';

export const lookupAccount = async (userId: string) => {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { suspendedAt: true, isAdmin: true } });
    return u && { suspended: u.suspendedAt !== null, isAdmin: u.isAdmin };
};

export const { requireActive, requireAdmin } = createGuards(lookupAccount);
