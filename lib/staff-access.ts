import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { SUPER_ADMIN_EMAILS } from '@/lib/auth-utils';

// Authorization for staff-only server code. Being signed in, or being allowed into the admin panel
// (lib/auth-utils.ts → isAdmin, which lets every staff role in), does NOT make someone an administrator: every
// sensitive action names the roles it allows. The role is read from the database on every call instead of being
// trusted from the 7-day session cookie, with the same email overrides as lib/session.ts.
//
// Who may do what (derived from the admin sidebar, each page's own checks and which roles the UI offers each control
// to; see SECURITY_HARDENING_REPORT.md):
//   ADMINS (SUPER_ADMIN, ADMIN)  grant/revoke ADMIN, ZONAL_HEAD, RELATIONSHIP_MANAGER; user directory; zonal heads;
//                                catalog; pricing rules; landing page; everything below without limits
//   PARTNER_MANAGERS (+ ZONAL_HEAD, RELATIONSHIP_MANAGER)  Partners page: register partners, grant PARTNER to an
//                                ordinary account, reassign partners (zonal heads only inside their cities)
//   RIDER_MANAGERS (+ ZONAL_HEAD, PARTNER)  Field Executives page: add/remove riders and grant FIELD_EXECUTIVE to an
//                                ordinary account, limited to their own team; moving riders: ADMINS + ZONAL_HEAD
//   CITY_STAFF (+ ZONAL_HEAD)    Cities page, limited to their own cities

export const UNAUTHORIZED = 'Unauthorized';
export const FORBIDDEN_ROLE = 'Forbidden: Admin access required';
export const FORBIDDEN_SCOPE = 'Forbidden: Outside your assigned cities';
export const FORBIDDEN_TEAM = 'Forbidden: Outside your team';
export const FORBIDDEN_TARGET = "Forbidden: Cannot change this user's role";

export const ADMINS = ['SUPER_ADMIN', 'ADMIN'];
export const CITY_ADMIN_ROLES = ADMINS;
export const CITY_STAFF = [...ADMINS, 'ZONAL_HEAD'];
export const PARTNER_MANAGERS = [...ADMINS, 'ZONAL_HEAD', 'RELATIONSHIP_MANAGER'];
export const RIDER_MANAGERS = [...ADMINS, 'ZONAL_HEAD', 'PARTNER'];

const FORCED_USER_EMAILS = ['mobilesouls.in@gmail.com'];

export type StaffUser = { id: string; email: string; role: string; cityId: string | null };

export const isAdminRole = (role: string) => ADMINS.includes(role);

/** The signed-in user as currently stored in the database, or null. */
export async function getCurrentStaff(): Promise<StaffUser | null> {
    const session = await getSession();
    if (!session?.user?.id) return null;
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, role: true, cityId: true },
    });
    if (!user) return null;
    return { ...user, role: effectiveRole(user) };
}

function effectiveRole(user: { email: string; role: string }): string {
    const email = user.email.toLowerCase();
    return SUPER_ADMIN_EMAILS.includes(email) ? 'SUPER_ADMIN'
        : FORCED_USER_EMAILS.includes(email) ? 'USER'
        : user.role;
}

export async function requireStaffRole(roles: string[], forbiddenMessage = FORBIDDEN_ROLE): Promise<StaffUser> {
    const staff = await getCurrentStaff();
    if (!staff) throw new Error(UNAUTHORIZED);
    if (!roles.includes(staff.role)) throw new Error(forbiddenMessage);
    return staff;
}

/** For pages: true when the signed-in user's database role is one of `roles`. */
export async function hasStaffRole(roles: string[]): Promise<boolean> {
    const staff = await getCurrentStaff();
    return staff !== null && roles.includes(staff.role);
}

/**
 * Admins may change anyone's role. Anyone else may only turn an ordinary account (USER, or UNVERIFIED) into
 * `grantedRole`, or re-grant a role the account already has — never change another staff member's role.
 */
export function requireAssignableTarget(staff: StaffUser, target: { email: string; role: string }, grantedRole: string) {
    if (isAdminRole(staff.role)) return;
    if (!['USER', 'UNVERIFIED', grantedRole].includes(effectiveRole(target))) throw new Error(FORBIDDEN_TARGET);
}

/** Cities a zonal head manages ("City"."managerId"), as listed on the partners and riders pages. */
export async function zonalHeadManagedCityIds(staff: StaffUser): Promise<string[]> {
    return (await prisma.city.findMany({ where: { managerId: staff.id }, select: { id: true } })).map(c => c.id);
}

/**
 * The partners whose riders `staff` manages, or null for no limit (admins): a zonal head's partners are those in a
 * city they manage or with them as manager (riders page); a partner's team is their own.
 */
export async function riderTeamPartnerIds(staff: StaffUser): Promise<string[] | null> {
    if (isAdminRole(staff.role)) return null;
    if (staff.role === 'PARTNER') return [staff.id];
    if (staff.role !== 'ZONAL_HEAD') return [];
    const partners = await prisma.user.findMany({
        where: { role: 'PARTNER', OR: [{ cityId: { in: await zonalHeadManagedCityIds(staff) } }, { managerId: staff.id }] },
        select: { id: true },
    });
    return partners.map(p => p.id);
}

/** A zonal head's cities for the Cities page: their own city plus every city they are the manager of. */
async function zonalHeadCityIds(staff: StaffUser): Promise<string[]> {
    return [...new Set([...(staff.cityId ? [staff.cityId] : []), ...await zonalHeadManagedCityIds(staff)])];
}

/** Admins: any city. Zonal heads: only their own cities. */
export async function requireCityAccess(cityId: string): Promise<StaffUser> {
    const staff = await requireStaffRole(CITY_STAFF);
    if (staff.role === 'ZONAL_HEAD' && !(await zonalHeadCityIds(staff)).includes(cityId)) {
        throw new Error(FORBIDDEN_SCOPE);
    }
    return staff;
}

/** Admins: any partner. Zonal heads: partners in one of their cities or managed by them. */
export async function requirePartnerAccess(partnerId: string): Promise<StaffUser> {
    const staff = await requireStaffRole(CITY_STAFF);
    if (staff.role === 'ZONAL_HEAD') {
        const partner = await prisma.user.findUnique({
            where: { id: partnerId },
            select: { role: true, cityId: true, managerId: true },
        });
        const cityIds = await zonalHeadCityIds(staff);
        const inScope = partner?.role === 'PARTNER'
            && ((partner.cityId !== null && cityIds.includes(partner.cityId)) || partner.managerId === staff.id);
        if (!inScope) throw new Error(FORBIDDEN_SCOPE);
    }
    return staff;
}
