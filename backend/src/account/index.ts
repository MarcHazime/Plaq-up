import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { mailerFromEnv } from '../mailer';
import { createAccount, Account } from './account';
import { createPrismaAccountStore } from './prismaStore';

export const accountStore = createPrismaAccountStore(prisma);

let instance: Account | undefined;

/** Built on first use, so the environment is loaded by then. */
export function account(): Account {
    return (instance ??= createAccount({
        store: accountStore,
        mailer: mailerFromEnv(),
        hasher: { hash: p => bcrypt.hash(p, 10), compare: (p, h) => bcrypt.compare(p, h) },
    }));
}

/** Fails at startup, not at the first signup, when email is misconfigured. */
export function assertAccountConfigured() {
    mailerFromEnv();
}

export { displayName } from './pseudo';
