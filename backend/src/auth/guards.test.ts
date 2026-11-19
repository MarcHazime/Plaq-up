import { describe, it, expect, vi } from 'vitest';
import { createGuards, AccountState } from './guards';

function run(guard: (req: any, res: any, next: any) => Promise<unknown>, userId: string | undefined, accounts: Record<string, AccountState>) {
    return (async () => {
        const res: any = { statusCode: 200 };
        res.status = (code: number) => { res.statusCode = code; return res; };
        res.json = (body: unknown) => { res.body = body; return res; };
        const next = vi.fn();
        await guard({ userId }, res, next);
        return { res, next };
    })();
}

const accounts: Record<string, AccountState> = {
    active: { suspended: false, isAdmin: false },
    banned: { suspended: true, isAdmin: false },
    boss: { suspended: false, isAdmin: true },
    suspendedBoss: { suspended: true, isAdmin: true },
};
const { requireActive, requireAdmin } = createGuards(async id => accounts[id] ?? null);

describe('requireActive', () => {
    it('lets an active account through', async () => {
        const { next } = await run(requireActive, 'active', accounts);
        expect(next).toHaveBeenCalled();
    });
    it('refuses a suspended account with a code the app can recognise', async () => {
        const { res, next } = await run(requireActive, 'banned', accounts);
        expect(res.statusCode).toBe(403);
        expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
        expect(next).not.toHaveBeenCalled();
    });
    it('refuses a deleted account and a missing user', async () => {
        expect((await run(requireActive, 'deleted', accounts)).res.statusCode).toBe(401);
        expect((await run(requireActive, undefined, accounts)).res.statusCode).toBe(401);
    });
    it('answers 500 when the lookup fails', async () => {
        const failing = createGuards(async () => { throw new Error('db down'); });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        expect((await run(failing.requireActive, 'active', accounts)).res.statusCode).toBe(500);
    });
});

describe('requireAdmin', () => {
    it('lets an active administrator through', async () => {
        expect((await run(requireAdmin, 'boss', accounts)).next).toHaveBeenCalled();
    });
    it('refuses ordinary users and suspended administrators', async () => {
        expect((await run(requireAdmin, 'active', accounts)).res.statusCode).toBe(403);
        expect((await run(requireAdmin, 'suspendedBoss', accounts)).res.statusCode).toBe(403);
    });
    it('refuses an unknown account', async () => {
        expect((await run(requireAdmin, 'ghost', accounts)).res.statusCode).toBe(401);
    });
});
