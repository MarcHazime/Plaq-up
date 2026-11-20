import { prisma } from '../db';
import { createModeration } from './moderation';
import { createPrismaModerationStore } from './prismaStore';
import { reportAlert } from './alert';
import { mailerFromEnv } from '../mailer';

export const moderation = createModeration({
    store: createPrismaModerationStore(prisma),
    events: { reportCreated: reportAlert(mailerFromEnv()) },
});
export { REPORT_REASONS } from './types';
