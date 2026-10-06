
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentStaff } from '@/lib/staff-access';

// Support lookup of one account by email. Only a signed-in SUPER_ADMIN (role re-read from the database) may use
// it, in every environment; the old ?key= check is no longer enough. Secrets are never returned: the password
// hash and the reset/OTP code are reduced to yes/no flags.
export async function GET(req: NextRequest) {
    const staff = await getCurrentStaff();
    if (!staff) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (staff.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const email = req.nextUrl.searchParams.get('email');
    if (!email) return NextResponse.json({ error: 'Email required' });

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true, name: true, email: true, phone: true, role: true, cityId: true, pincodes: true,
                managerId: true, createdAt: true, updatedAt: true,
                passwordHash: true, resetToken: true, resetTokenExpiry: true,
            }
        });
        if (!user) return NextResponse.json({ user: null });
        const { passwordHash, resetToken, resetTokenExpiry, ...profile } = user;
        return NextResponse.json({
            user: {
                ...profile,
                hasPassword: Boolean(passwordHash),
                hasPendingResetCode: Boolean(resetToken),
                resetCodeExpiresAt: resetTokenExpiry,
            }
        });
    } catch (e) {
        console.error('[diagnose-user] lookup failed', e);
        return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
}
