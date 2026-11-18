import { describe, it, expect, beforeAll, vi } from 'vitest';
import { signToken, verifyToken } from './token';
import { requireAuth, requireSelf, requireSelfInBody, requireParty, authenticateSocket, AuthedRequest } from './middleware';

beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
});

function run(mw: (req: any, res: any, next: any) => unknown, req: Partial<AuthedRequest>) {
    const res: any = { statusCode: 200 };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (body: unknown) => { res.body = body; return res; };
    const next = vi.fn();
    mw({ headers: {}, params: {}, body: {}, ...req }, res, next);
    return { res, next };
}

describe('token', () => {
    it('round-trips a user id', () => {
        expect(verifyToken(signToken('u1'))).toBe('u1');
    });
    it('rejects garbage, missing and tampered tokens', () => {
        expect(verifyToken(undefined)).toBeNull();
        expect(verifyToken('nope')).toBeNull();
        expect(verifyToken(signToken('u1') + 'x')).toBeNull();
    });
    it('rejects a token signed with another secret', () => {
        const token = signToken('u1');
        process.env.JWT_SECRET = 'other';
        expect(verifyToken(token)).toBeNull();
        process.env.JWT_SECRET = 'test-secret';
    });
});

describe('requireAuth', () => {
    it('answers 401 without a bearer token', () => {
        const { res, next } = run(requireAuth, {});
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('answers 401 with an invalid token', () => {
        const { res } = run(requireAuth, { headers: { authorization: 'Bearer bad' } });
        expect(res.statusCode).toBe(401);
    });
    it('exposes the caller on a valid token', () => {
        const req: any = { headers: { authorization: `Bearer ${signToken('u1')}` } };
        const { next } = run(requireAuth, req);
        expect(next).toHaveBeenCalled();
    });
});

describe('ownership guards', () => {
    it('requireSelf lets the owner through and refuses others', () => {
        expect(run(requireSelf('userId'), { userId: 'a', params: { userId: 'a' } }).next).toHaveBeenCalled();
        expect(run(requireSelf('userId'), { userId: 'a', params: { userId: 'b' } }).res.statusCode).toBe(403);
    });
    it('requireSelfInBody checks the body field', () => {
        expect(run(requireSelfInBody('blockerId'), { userId: 'a', body: { blockerId: 'a' } }).next).toHaveBeenCalled();
        expect(run(requireSelfInBody('blockerId'), { userId: 'a', body: { blockerId: 'b' } }).res.statusCode).toBe(403);
        expect(run(requireSelfInBody('blockerId'), { userId: 'a', body: undefined }).res.statusCode).toBe(403);
    });
    it('requireParty accepts either participant only', () => {
        const mw = requireParty('userId1', 'userId2');
        expect(run(mw, { userId: 'b', params: { userId1: 'a', userId2: 'b' } }).next).toHaveBeenCalled();
        expect(run(mw, { userId: 'c', params: { userId1: 'a', userId2: 'b' } }).res.statusCode).toBe(403);
    });
});

describe('authenticateSocket', () => {
    it('stores the user id for a valid token', () => {
        const socket = { handshake: { auth: { token: signToken('u1') } }, data: {} as any };
        const next = vi.fn();
        authenticateSocket(socket, next);
        expect(socket.data.userId).toBe('u1');
        expect(next).toHaveBeenCalledWith();
    });
    it('refuses the handshake without a valid token', () => {
        const next = vi.fn();
        authenticateSocket({ handshake: { auth: {} }, data: {} }, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    });
});
