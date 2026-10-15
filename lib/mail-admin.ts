import { prisma } from '@/lib/db';
import { ADMINS, FORBIDDEN_ROLE, UNAUTHORIZED, getCurrentStaff, isAdminRole, requireStaffRole, type StaffUser } from '@/lib/staff-access';

// Access rules and safe server commands for the email system (app/api/email/*, actions/email-hub.ts).
//
// These routes were reachable without signing in, and they built a root shell command on the mail server from the
// request's email and password, so anyone could run commands there. Now: mailbox management is for administrators;
// reading and sending is limited to the mailboxes a staff member may use (the same rule the email page already
// applied to its list); mailbox names are validated; the password reaches the shell only as base64 text; and the
// mail server is changed over SSH only when MAILSERVER_SSH_HOST is set, so test and staging deployments never touch
// the production mail server.

export const FORBIDDEN_MAILBOX = 'Forbidden: Not your mailbox';

/** A Fonzkart mailbox: name@fonzkart.in, with a bare name completed to it. Null for anything else. */
export function mailboxAddress(input: unknown): string | null {
    if (typeof input !== 'string') return null;
    const value = input.trim().toLowerCase();
    const email = value.includes('@') ? value : `${value}@fonzkart.in`;
    return /^[a-z0-9][a-z0-9._+-]{0,63}@fonzkart\.in$/.test(email) ? email : null;
}

/**
 * The docker-mailserver command to add or delete a mailbox. The address is validated; the password is passed as
 * base64 (letters, digits, + / =) and decoded on the server, so nothing in it can end the quoted argument.
 */
export function mailserverCommand(action: 'add' | 'del', email: string, password?: string): string {
    const address = mailboxAddress(email);
    if (!address) throw new Error('Invalid: Mailbox');
    const container = `$(docker ps -q -f "ancestor=ghcr.io/docker-mailserver/docker-mailserver:latest")`;
    if (action === 'del') return `docker exec ${container} setup email del ${address}`;
    const encoded = Buffer.from(password ?? '', 'utf8').toString('base64');
    return `docker exec ${container} setup email add ${address} "$(printf %s ${encoded} | base64 -d)"`;
}

/** The mail server host for SSH changes; unset (the default) means the mail server is never changed from here. */
export const mailserverSshHost = () => process.env.MAILSERVER_SSH_HOST || null;

/** Mailbox management (create, list, delete accounts) is for administrators only. */
export const requireMailAdmin = () => requireStaffRole(ADMINS);

/**
 * The mailboxes the signed-in user may read and send from: administrators all of them; a zonal head their own, their
 * cities' partners' and those partners' executives' (phone@fonzkart.in); a partner their own and their executives';
 * anyone else their own address. Throws when nobody is signed in.
 */
export async function reachableMailboxes(): Promise<{ staff: StaffUser; all: boolean; emails: string[] }> {
    const staff = await getCurrentStaff();
    if (!staff) throw new Error(UNAUTHORIZED);
    if (isAdminRole(staff.role)) {
        const accounts = await prisma.emailAccount.findMany({ select: { email: true } });
        return { staff, all: true, emails: accounts.map(a => a.email) };
    }
    const emails = [staff.email];
    if (staff.role === 'ZONAL_HEAD') {
        const cities = await prisma.city.findMany({ where: { managerId: staff.id }, include: { users: { where: { role: 'PARTNER' } } } });
        const partnerIds = cities.flatMap(c => c.users.map(u => u.id));
        const [partners, riders] = await Promise.all([
            prisma.user.findMany({ where: { id: { in: partnerIds } }, select: { email: true } }),
            prisma.rider.findMany({ where: { partnerId: { in: partnerIds } }, select: { phone: true } }),
        ]);
        emails.push(...partners.map(p => p.email), ...riders.map(r => `${r.phone}@fonzkart.in`));
    } else if (staff.role === 'PARTNER') {
        const riders = await prisma.rider.findMany({ where: { partnerId: staff.id }, select: { phone: true } });
        emails.push(...riders.map(r => `${r.phone}@fonzkart.in`));
    }
    return { staff, all: false, emails };
}

/** Throws unless the signed-in user may use this mailbox. */
export async function requireMailbox(email: string) {
    const access = await reachableMailboxes();
    if (!access.all && !access.emails.includes(email)) throw new Error(FORBIDDEN_MAILBOX);
    return access;
}

/** HTTP status for the errors above. */
export function mailHttpStatus(error: unknown): number {
    const message = error instanceof Error ? error.message : '';
    if (message === UNAUTHORIZED) return 401;
    if (message === FORBIDDEN_ROLE || message.startsWith('Forbidden')) return 403;
    if (message.startsWith('Invalid')) return 400;
    return 500;
}
