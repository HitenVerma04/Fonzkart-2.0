// One-time conversion of plain-text field-executive passwords ("Rider"."password") into bcrypt hashes.
//
//   npx tsx scripts/hash-rider-passwords.ts           dry run: only counts, changes nothing
//   npx tsx scripts/hash-rider-passwords.ts --apply   hashes every plain-text value
//
// Take a database backup first. Executives keep logging in with the same passwords afterwards (the login accepts
// both forms). Safe to re-run: existing hashes and empty values (meaning "needs onboarding") are never touched, and
// a row whose password changed after it was read is skipped. No password or id is printed.
import { PrismaClient } from '@prisma/client';
import { hashRiderPassword, isRiderPasswordHash } from '../lib/rider-password';

async function main() {
    const apply = process.argv.includes('--apply');
    const prisma = new PrismaClient();
    try {
        const riders = await prisma.rider.findMany({ select: { id: true, password: true } });
        const plain = riders.filter(r => r.password && !isRiderPasswordHash(r.password));
        const hashed = riders.filter(r => isRiderPasswordHash(r.password)).length;
        console.log(`Riders: ${riders.length}. Plain-text passwords: ${plain.length}. Already hashed: ${hashed}. `
            + `Without a password: ${riders.length - plain.length - hashed}.`);

        if (!apply) {
            console.log('Dry run: nothing was changed. Run again with --apply to hash the plain-text passwords.');
            return;
        }

        let converted = 0;
        for (const rider of plain) {
            const result = await prisma.rider.updateMany({
                where: { id: rider.id, password: rider.password },
                data: { password: await hashRiderPassword(rider.password!) },
            });
            converted += result.count;
        }
        console.log(`Hashed ${converted} password(s).`
            + (converted < plain.length ? ` Skipped ${plain.length - converted} changed meanwhile; re-run to check.` : ''));
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
