"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryAccountStore = void 0;
/** In-memory AccountStore: the second adapter that makes the seam real, and the one tests use. */
class MemoryAccountStore {
    constructor() {
        this.users = new Map();
        this.vehicles = [];
        this.nextId = 1;
    }
    async findById(id) {
        return this.users.get(id) ?? null;
    }
    async findByEmail(email) {
        return [...this.users.values()].find(u => u.email === email) ?? null;
    }
    async findByPlate(plate) {
        const vehicle = this.vehicles.find(v => v.plate === plate);
        return vehicle ? this.users.get(vehicle.userId) ?? null : null;
    }
    async createWithVehicle(account) {
        const user = {
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
        };
        this.users.set(user.id, user);
        this.vehicles.push({ plate: account.plate, userId: user.id });
        return user;
    }
    async update(id, patch) {
        const user = this.users.get(id);
        if (user)
            Object.assign(user, patch);
    }
    async delete(id) {
        this.users.delete(id);
        this.vehicles = this.vehicles.filter(v => v.userId !== id);
    }
    primaryPlateOf(userId) {
        return this.vehicles.find(v => v.userId === userId)?.plate ?? null;
    }
}
exports.MemoryAccountStore = MemoryAccountStore;
