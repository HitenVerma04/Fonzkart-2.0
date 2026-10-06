
export interface SessionUser {
    id: string;
    email: string;
    name: string;
    role: string;
    cityId?: string | null;
}

export interface SessionPayload {
    user: SessionUser;
    expires: Date | string;
    iat?: number;
    exp?: number;
}

export const SUPER_ADMIN_EMAILS = [
    'admin@fonzkart.in',
    'admin@fonzkart.com',
    'noumaanraihaan@gmail.com'
];

export const ADMIN_EMAILS = [
    ...SUPER_ADMIN_EMAILS
];

export function isSuperAdmin(user?: SessionUser | null) {
    if (!user || !user.email) return false;
    if (user.email.toLowerCase() === 'mobilesouls.in@gmail.com') return false;
    return user.role === 'SUPER_ADMIN' || SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
}

/**
 * Whether the user may open the staff panel (/admin) — true for every staff role, including partners and field
 * executives. It is NOT an authorization check for sensitive actions: those use the explicit role lists in
 * lib/staff-access.ts.
 */
export function isAdmin(user?: SessionUser | null) {
    if (!user || !user.email) return false;
    if (user.email.toLowerCase() === 'mobilesouls.in@gmail.com') return false;
    return ADMIN_EMAILS.includes(user.email.toLowerCase()) || ['ADMIN', 'SUPER_ADMIN', 'ZONAL_HEAD', 'RELATIONSHIP_MANAGER', 'PARTNER', 'FIELD_EXECUTIVE'].includes(user.role);
}
