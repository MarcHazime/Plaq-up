import type { AccountStore, AccountUser, NewAccount, UserPatch } from './types';

/** In-memory AccountStore: the second adapter that makes the seam real, and the one tests use. */
export class MemoryAccountStore implements AccountStore {
    users = new Map<string, AccountUser>();
    vehicles: { plate: string; userId: string }[] = [];
    private nextId = 1;

    async findById(id: string) {
        return this.users.get(id) ?? null;
    }

    async findByEmail(email: string) {
        return [...this.users.values()].find(u => u.email === email) ?? null;
    }

    async findByPlate(plate: string) {
        const vehicle = this.vehicles.find(v => v.plate === plate);
        return vehicle ? this.users.get(vehicle.userId) ?? null : null;
    }

    async createWithVehicle(account: NewAccount) {
        const user: AccountUser = {
            id: `user${this.nextId++}`,
            email: account.email,
            passwordHash: account.passwordHash,
            isVerified: false,
            verificationToken: account.verificationToken,
            verificationExpires: account.verificationExpires,
            resetToken: null,
            resetTokenExpires: null,
            pseudo: null,
            acceptNewContacts: true,
            suspended: false,
            termsAcceptedAt: account.termsAcceptedAt,
            termsVersion: account.termsVersion,
        };
        this.users.set(user.id, user);
        this.vehicles.push({ plate: account.plate, userId: user.id });
        return user;
    }

    async update(id: string, patch: UserPatch) {
        const user = this.users.get(id);
        if (user) Object.assign(user, patch);
    }

    async delete(id: string) {
        this.users.delete(id);
        this.vehicles = this.vehicles.filter(v => v.userId !== id);
    }

    primaryPlateOf(userId: string) {
        return this.vehicles.find(v => v.userId === userId)?.plate ?? null;
    }
}
