/**
 * Creates (or recreates) the demo account given to the store reviewers, with a conversation to look at.
 *
 *   DATABASE_URL=<public database url> npx ts-node scripts/seedDemo.ts
 *
 * The password is generated and printed once. Run it again for a new one.
 */
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const REVIEWER = { email: 'demo-review@plaq-up.fr', plate: 'ZZ-100-ZZ', pseudo: 'Relecteur' };
const NEIGHBOUR = { email: 'demo-voisin@plaq-up.fr', plate: 'ZZ-200-ZZ', pseudo: 'Voisin démo' };

async function main() {
    const prisma = new PrismaClient();
    try {
        const password = randomBytes(9).toString('base64url');
        const hash = await bcrypt.hash(password, 10);
        const termsAcceptedAt = new Date();

        // Start clean: remove previous demo users, their vehicles and messages.
        const old = await prisma.user.findMany({ where: { email: { in: [REVIEWER.email, NEIGHBOUR.email] } }, select: { id: true } });
        const ids = old.map(u => u.id);
        if (ids.length) {
            await prisma.message.deleteMany({ where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }] } });
            await prisma.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
            await prisma.user.deleteMany({ where: { id: { in: ids } } });
        }

        const create = (u: typeof REVIEWER) =>
            prisma.user.create({
                data: {
                    email: u.email,
                    password: hash,
                    isVerified: true,
                    pseudo: u.pseudo,
                    termsAcceptedAt,
                    termsVersion: 'demo',
                    vehicles: { create: { plate: u.plate, isPrimary: true } },
                },
            });
        const [reviewer, neighbour] = [await create(REVIEWER), await create(NEIGHBOUR)];

        const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);
        const say = (from: string, to: string, content: string, minutesAgo: number, isRead: boolean) =>
            prisma.message.create({ data: { senderId: from, receiverId: to, content, createdAt: at(minutesAgo), isRead, relatedPlate: from === neighbour.id ? REVIEWER.plate : NEIGHBOUR.plate } });

        await say(reviewer.id, neighbour.id, "Bonjour, votre feu arrière gauche semble éteint.", 120, true);
        await say(neighbour.id, reviewer.id, "Merci de m'avoir prévenu, je vais le changer !", 90, true);
        await say(neighbour.id, reviewer.id, "Au fait, la place devant chez vous est libre ce soir.", 5, false);

        console.log('\nCompte de démonstration prêt.');
        console.log(`  Plaque   : ${REVIEWER.plate}`);
        console.log(`  Email    : ${REVIEWER.email}`);
        console.log(`  Mot de passe : ${password}`);
        console.log(`  (compte du voisin pour tester l'envoi : plaque ${NEIGHBOUR.plate})\n`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
