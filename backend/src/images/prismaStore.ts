import type { PrismaClient } from '@prisma/client';
import type { ImagesStore } from './types';

export function createPrismaImagesStore(prisma: PrismaClient): ImagesStore {
    return {
        countByOwnerSince: (ownerId, since) => prisma.image.count({ where: { ownerId, createdAt: { gte: since } } }),
        countSince: since => prisma.image.count({ where: { createdAt: { gte: since } } }),

        async totals() {
            const sum = await prisma.image.aggregate({ _count: true, _sum: { bytes: true } });
            return { count: sum._count, bytes: sum._sum.bytes ?? 0 };
        },

        create: image => prisma.image.create({ data: image }),
        find: id => prisma.image.findUnique({ where: { id } }),
        findMany: ids => prisma.image.findMany({ where: { id: { in: ids } } }),

        orphansBefore: (before, limit) =>
            prisma.image.findMany({ where: { message: null, createdAt: { lt: before } }, take: limit, orderBy: { createdAt: 'asc' } }),

        async deleteMany(ids) {
            await prisma.image.deleteMany({ where: { id: { in: ids } } });
        },
    };
}
