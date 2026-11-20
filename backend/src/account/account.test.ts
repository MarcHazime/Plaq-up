import { describe, it, expect, vi } from 'vitest';
import { createAccount } from './account';
import { MemoryAccountStore } from './memoryStore';
import { TERMS_VERSION } from './terms';
import type { Mailer } from '../mailer';

const HOUR = 3600 * 1000;

function setup(options: { mailFails?: boolean } = {}) {
    const store = new MemoryAccountStore();
    const sent: { to: string; subject: string; text: string }[] = [];
    const mailer: Mailer = {
        send: vi.fn(async (to, subject, text) => {
            if (options.mailFails) throw new Error('Email failed: sender not valid');
            sent.push({ to, subject, text });
        }),
    };
    let current = new Date('2026-01-10T10:00:00Z');
    let codeCounter = 100000;
    const account = createAccount({
        store,
        mailer,
        hasher: { hash: async p => `h:${p}`, compare: async (p, h) => h === `h:${p}` },
        now: () => current,
        newCode: () => String(codeCounter++),
    });
    const lastCode = () => /(\d{6})/.exec(sent[sent.length - 1].text)![1];
    return { store, account, sent, mailer, lastCode, advance: (ms: number) => { current = new Date(current.getTime() + ms); } };
}

const signup = { plate: 'ab123cd', password: 'password1', email: 'me@x.fr', acceptTerms: true };

async function verifiedUser(s: ReturnType<typeof setup>, over: Partial<typeof signup> = {}) {
    const r = await s.account.register({ ...signup, ...over });
    if (!r.ok) throw new Error('register failed');
    await s.account.verifyEmail(r.userId, s.lastCode());
    return r;
}

describe('register', () => {
    it('creates an unverified account and emails a code', async () => {
        const { account, sent, store } = setup();
        const r = await account.register(signup);
        expect(r).toMatchObject({ ok: true, email: 'me@x.fr', primaryPlate: 'AB-123-CD' });
        expect(sent).toHaveLength(1);
        expect(sent[0].to).toBe('me@x.fr');
        expect(sent[0].text).toMatch(/\d{6}/);
        expect([...store.users.values()][0].isVerified).toBe(false);
    });

    it('validates plate, password and email before anything is created', async () => {
        const { account, store, mailer } = setup();
        expect(await account.register({ ...signup, plate: 'nope' })).toMatchObject({ ok: false, reason: 'invalid_plate' });
        expect(await account.register({ ...signup, password: 'short' })).toMatchObject({ ok: false, reason: 'weak_password' });
        expect(await account.register({ ...signup, email: 'not-an-email' })).toMatchObject({ ok: false, reason: 'invalid_email' });
        expect(await account.register({ ...signup, email: '' })).toMatchObject({ ok: false, reason: 'invalid_email' });
        expect(store.users.size).toBe(0);
        expect(mailer.send).not.toHaveBeenCalled();
    });

    it('refuses signup unless the terms are accepted, and creates nothing', async () => {
        const { account, store, mailer } = setup();
        for (const acceptTerms of [undefined, false, 'true', 1]) {
            expect(await account.register({ ...signup, acceptTerms })).toMatchObject({ ok: false, reason: 'terms_not_accepted' });
        }
        expect(store.users.size).toBe(0);
        expect(mailer.send).not.toHaveBeenCalled();
    });

    it('records when and which version of the terms was accepted', async () => {
        const { account, store } = setup();
        await account.register(signup);
        expect([...store.users.values()][0]).toMatchObject({
            termsAcceptedAt: new Date('2026-01-10T10:00:00Z'),
            termsVersion: TERMS_VERSION,
        });
    });

    it('leaves no account behind when the email cannot be sent', async () => {
        const { account, store } = setup({ mailFails: true });
        const r = await account.register(signup);
        expect(r).toMatchObject({ ok: false, reason: 'email_failed' });
        expect(store.users.size).toBe(0);
        expect(store.vehicles).toHaveLength(0);
    });

    it('does not let a verified account be taken over', async () => {
        const s = setup();
        await verifiedUser(s);
        expect(await s.account.register({ ...signup, email: 'other@x.fr' })).toMatchObject({ ok: false, reason: 'plate_taken' });
        expect(await s.account.register({ ...signup, plate: 'ZZ-999-ZZ' })).toMatchObject({ ok: false, reason: 'email_taken' });
    });

    it('lets a new registration replace an unverified one for the same plate or email', async () => {
        const { account, store } = setup();
        await account.register(signup); // never verified
        const again = await account.register({ ...signup, password: 'another-pass' });
        expect(again.ok).toBe(true);
        expect(store.users.size).toBe(1);

        const byEmail = await account.register({ ...signup, plate: 'ZZ-999-ZZ' });
        expect(byEmail.ok).toBe(true);
        expect(store.users.size).toBe(1);
        expect(store.vehicles.map(v => v.plate)).toEqual(['ZZ-999-ZZ']);
    });
});

describe('verifyEmail and resend', () => {
    it('verifies with the right code', async () => {
        const { account, store, lastCode } = setup();
        const r = await account.register(signup);
        if (!r.ok) throw new Error();
        expect(await account.verifyEmail(r.userId, lastCode())).toMatchObject({ ok: true, userId: r.userId });
        expect(store.users.get(r.userId)!.isVerified).toBe(true);
        expect(store.users.get(r.userId)!.verificationToken).toBeNull();
    });

    it('rejects a wrong or expired code', async () => {
        const { account, lastCode, advance } = setup();
        const r = await account.register(signup);
        if (!r.ok) throw new Error();
        expect(await account.verifyEmail(r.userId, '000000')).toEqual({ ok: false, reason: 'invalid_code' });
        const code = lastCode();
        advance(25 * HOUR);
        expect(await account.verifyEmail(r.userId, code)).toEqual({ ok: false, reason: 'invalid_code' });
    });

    it('reports unknown, already verified and missing input', async () => {
        const s = setup();
        const r = await verifiedUser(s);
        expect(await s.account.verifyEmail(r.userId, '123456')).toEqual({ ok: false, reason: 'already_verified' });
        expect(await s.account.verifyEmail('ghost', '123456')).toEqual({ ok: false, reason: 'not_found' });
        expect(await s.account.verifyEmail('', '')).toEqual({ ok: false, reason: 'missing' });
    });

    it('resends a fresh code that replaces the old one', async () => {
        const { account, sent, lastCode } = setup();
        const r = await account.register(signup);
        if (!r.ok) throw new Error();
        const first = lastCode();
        expect(await account.resendCode(r.userId)).toEqual({ ok: true });
        const second = lastCode();
        expect(second).not.toBe(first);
        expect(sent).toHaveLength(2);
        expect(await account.verifyEmail(r.userId, first)).toEqual({ ok: false, reason: 'invalid_code' });
        expect(await account.verifyEmail(r.userId, second)).toMatchObject({ ok: true });
    });

    it('does not resend to a verified or unknown account', async () => {
        const s = setup();
        const r = await verifiedUser(s);
        expect(await s.account.resendCode(r.userId)).toEqual({ ok: false, reason: 'already_verified' });
        expect(await s.account.resendCode('ghost')).toEqual({ ok: false, reason: 'not_found' });
    });

    it('reports a failed resend', async () => {
        const s = setup();
        const r = await s.account.register(signup);
        if (!r.ok) throw new Error();
        (s.mailer.send as any).mockRejectedValueOnce(new Error('down'));
        expect(await s.account.resendCode(r.userId)).toEqual({ ok: false, reason: 'email_failed' });
    });
});

describe('login', () => {
    it('signs in a verified account with the right password', async () => {
        const s = setup();
        const r = await verifiedUser(s);
        expect(await s.account.login({ plate: 'AB 123 CD', password: 'password1' }))
            .toEqual({ ok: true, userId: r.userId, email: 'me@x.fr', primaryPlate: 'AB-123-CD' });
    });

    it('answers the same for an unknown plate and a wrong password', async () => {
        const s = setup();
        await verifiedUser(s);
        expect(await s.account.login({ plate: 'ZZ-999-ZZ', password: 'password1' })).toEqual({ ok: false, reason: 'invalid' });
        expect(await s.account.login({ plate: 'AB-123-CD', password: 'wrong-pass' })).toEqual({ ok: false, reason: 'invalid' });
        expect(await s.account.login({ plate: 'garbage', password: 'password1' })).toEqual({ ok: false, reason: 'invalid' });
    });

    it('tells an unverified owner to verify, but only after the password is right', async () => {
        const { account } = setup();
        const r = await account.register(signup);
        if (!r.ok) throw new Error();
        expect(await account.login({ plate: 'AB-123-CD', password: 'wrong-pass' })).toEqual({ ok: false, reason: 'invalid' });
        expect(await account.login({ plate: 'AB-123-CD', password: 'password1' }))
            .toEqual({ ok: false, reason: 'unverified', userId: r.userId, email: 'me@x.fr' });
    });

    it('refuses a suspended account', async () => {
        const s = setup();
        const r = await verifiedUser(s);
        s.store.users.get(r.userId)!.suspended = true;
        expect(await s.account.login({ plate: 'AB-123-CD', password: 'password1' })).toEqual({ ok: false, reason: 'suspended' });
    });
});

describe('password reset and change', () => {
    it('resets with the emailed code and the new password works', async () => {
        const s = setup();
        await verifiedUser(s);
        await s.account.requestPasswordReset('me@x.fr');
        await expect(s.account.resetPassword({ email: 'me@x.fr', code: s.lastCode(), newPassword: 'brand-new-pass' })).resolves.toEqual({ ok: true });
        expect((await s.account.login({ plate: 'AB-123-CD', password: 'brand-new-pass' })).ok).toBe(true);
        expect((await s.account.login({ plate: 'AB-123-CD', password: 'password1' })).ok).toBe(false);
    });

    it('does not reveal whether an email has an account', async () => {
        const s = setup();
        expect(await s.account.requestPasswordReset('nobody@x.fr')).toEqual({ ok: true });
        expect(s.sent).toHaveLength(0);
    });

    it('rejects a wrong or expired reset code, and a weak new password', async () => {
        const s = setup();
        await verifiedUser(s);
        await s.account.requestPasswordReset('me@x.fr');
        const code = s.lastCode();
        expect(await s.account.resetPassword({ email: 'me@x.fr', code: '000000', newPassword: 'brand-new-pass' })).toEqual({ ok: false, reason: 'invalid_code' });
        expect(await s.account.resetPassword({ email: 'me@x.fr', code, newPassword: 'short' })).toEqual({ ok: false, reason: 'weak_password' });
        s.advance(2 * HOUR);
        expect(await s.account.resetPassword({ email: 'me@x.fr', code, newPassword: 'brand-new-pass' })).toEqual({ ok: false, reason: 'invalid_code' });
    });

    it('changes the password only with the current one', async () => {
        const s = setup();
        const r = await verifiedUser(s);
        expect(await s.account.changePassword(r.userId, 'wrong-pass', 'brand-new-pass')).toEqual({ ok: false, reason: 'wrong_password' });
        expect(await s.account.changePassword(r.userId, 'password1', 'short')).toEqual({ ok: false, reason: 'weak_password' });
        expect(await s.account.changePassword(r.userId, 'password1', 'brand-new-pass')).toEqual({ ok: true });
        expect((await s.account.login({ plate: 'AB-123-CD', password: 'brand-new-pass' })).ok).toBe(true);
    });
});

describe('settings', () => {
    it('sets, trims and clears the pseudo', async () => {
        const s = setup();
        const r = await verifiedUser(s);
        expect(await s.account.updateSettings(r.userId, { pseudo: '  Zoé ' })).toEqual({ ok: true, pseudo: 'Zoé', acceptNewContacts: true });
        expect(await s.account.updateSettings(r.userId, { pseudo: '' })).toEqual({ ok: true, pseudo: null, acceptNewContacts: true });
    });

    it('rejects a bad pseudo and keeps the old one', async () => {
        const s = setup();
        const r = await verifiedUser(s);
        await s.account.updateSettings(r.userId, { pseudo: 'Zoé' });
        expect(await s.account.updateSettings(r.userId, { pseudo: 'AB-123-CD' })).toEqual({ ok: false, reason: 'looks_like_plate' });
        expect(s.store.users.get(r.userId)!.pseudo).toBe('Zoé');
    });

    it('toggles acceptance of new contacts without touching the pseudo', async () => {
        const s = setup();
        const r = await verifiedUser(s);
        await s.account.updateSettings(r.userId, { pseudo: 'Zoé' });
        expect(await s.account.updateSettings(r.userId, { acceptNewContacts: false })).toEqual({ ok: true, pseudo: 'Zoé', acceptNewContacts: false });
    });
});

describe('deleteAccount', () => {
    it('removes the account and frees the plate and email', async () => {
        const s = setup();
        const r = await verifiedUser(s);
        await s.account.deleteAccount(r.userId);
        expect(s.store.users.size).toBe(0);
        expect(s.store.vehicles).toHaveLength(0);
        expect((await s.account.register(signup)).ok).toBe(true);
    });
});

describe('terms update', () => {
    it('an account from before the terms must accept; accepting records the current version', async () => {
        const s = setup();
        const r = await verifiedUser(s);
        // account created before the Terms existed
        Object.assign(s.store.users.get(r.userId)!, { termsAcceptedAt: null, termsVersion: null });
        expect(await s.account.hasAcceptedCurrentTerms(r.userId)).toBe(false);

        expect(await s.account.acceptTerms(r.userId)).toBe(true);

        expect(await s.account.hasAcceptedCurrentTerms(r.userId)).toBe(true);
        expect(s.store.users.get(r.userId)).toMatchObject({ termsAcceptedAt: new Date('2026-01-10T10:00:00Z'), termsVersion: TERMS_VERSION });
    });

    it('a new signup has already accepted, and an unknown user cannot', async () => {
        const s = setup();
        const r = await verifiedUser(s);
        expect(await s.account.hasAcceptedCurrentTerms(r.userId)).toBe(true);
        expect(await s.account.acceptTerms('ghost')).toBe(false);
        expect(await s.account.hasAcceptedCurrentTerms('ghost')).toBe(false);
    });
});
