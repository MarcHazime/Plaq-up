import type { PrismaClient, User } from '@prisma/client';
import type { AccountStore, AccountUser, UserPatch } from './types';

const toAccountUser = (u: User): AccountUser => ({
    id: u.id,
    email: u.email,
    passwordHash: u.password,
    isVerified: u.isVerified,
    verificationToken: u.verificationToken,
    verificationExpires: u.verificationExpires,
    resetToken: u.resetToken,
    resetTokenExpires: u.resetTokenExpires,
    pseudo: u.pseudo,
    acceptNewContacts: u.acceptNewContacts,
    suspended: u.suspendedAt !== null,
    termsAcceptedAt: u.termsAcceptedAt,
    termsVersion: u.termsVersion,
});

export function createPrismaAccountStore(prisma: PrismaClient): AccountStore {
    return {
        async findById(id) {
            const u = await prisma.user.findUnique({ where: { id } });
            return u && toAccountUser(u);
        },

        async findByEmail(email) {
            const u = await prisma.user.findUnique({ where: { email } });
            return u && toAccountUser(u);
        },

        async findByPlate(plate) {
            const vehicle = await prisma.vehicle.findUnique({ where: { plate }, include: { user: true } });
            return vehicle && toAccountUser(vehicle.user);
        },

        async createWithVehicle(account) {
            const u = await prisma.user.create({
                data: {
                    email: account.email,
                    password: account.passwordHash,
                    isVerified: false,
                    verificationToken: account.verificationToken,
                    verificationExpires: account.verificationExpires,
                    termsAcceptedAt: account.termsAcceptedAt,
                    termsVersion: account.termsVersion,
                    vehicles: { create: { plate: account.plate, isPrimary: true } },
                },
            });
            return toAccountUser(u);
        },

        async update(id, patch: UserPatch) {
            const { passwordHash, ...rest } = patch;
            await prisma.user.update({ where: { id }, data: { ...rest, ...(passwordHash !== undefined && { password: passwordHash }) } });
        },

        async delete(id) {
            // Vehicles and Conversations go by cascade.
            await prisma.$transaction([
                prisma.message.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } }),
                prisma.block.deleteMany({ where: { OR: [{ blockerId: id }, { blockedId: id }] } }),
                prisma.user.delete({ where: { id } }),
            ]);
        },
    };
}
