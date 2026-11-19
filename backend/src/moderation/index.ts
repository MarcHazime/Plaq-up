import { prisma } from '../db';
import { createModeration } from './moderation';
import { createPrismaModerationStore } from './prismaStore';

export const moderation = createModeration({ store: createPrismaModerationStore(prisma) });
export { REPORT_REASONS } from './types';
