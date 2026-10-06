import { prisma } from '@/lib/db';
import { ADMINS, FORBIDDEN_ROLE, StaffUser, UNAUTHORIZED, isAdminRole, requireStaffRole, riderTeamPartnerIds, zonalHeadManagedCityIds } from '@/lib/staff-access';

// Which orders each staff member may see and act on, and which partners and executives they may assign. Every order
// page, server action and API route goes through here, so what a screen shows and what the server accepts agree.
//
//   SUPER_ADMIN, ADMIN     every order, partner and executive
//   ZONAL_HEAD             orders routed to a partner of their team (partners in their cities or managed by them),
//                          plus every order in their territory (pincodes of their cities' partners, or an address
//                          naming one of their cities, as before); routes to / assigns within their team
//   RELATIONSHIP_MANAGER   orders routed to their partners ("User"."relationshipManagerId" = the RM) plus orders not
//                          routed to any partner yet; routes to / assigns within their partners
//   PARTNER                orders routed to them, plus unrouted orders in their pincodes (orders placed before
//                          routing existed); assigns their own executives; cannot re-route
//   FIELD_EXECUTIVE        only through the executive actions (actions/executive.ts): orders assigned to them

export const ORDER_STAFF = [...ADMINS, 'ZONAL_HEAD', 'RELATIONSHIP_MANAGER', 'PARTNER'];
export const PARTNER_ROUTERS = [...ADMINS, 'ZONAL_HEAD', 'RELATIONSHIP_MANAGER'];
export const PRICE_APPROVERS = ORDER_STAFF;
export const BULK_ORDER_STAFF = [...ADMINS, 'ZONAL_HEAD', 'RELATIONSHIP_MANAGER'];
export const ORDER_DELETERS = [...ADMINS, 'ZONAL_HEAD'];

export const FORBIDDEN_ORDER = 'Forbidden: Outside your orders';
export const FORBIDDEN_ASSIGNEE = 'Forbidden: Outside your partners and executives';
export const ORDER_NOT_FOUND = 'Order not found';
export const INVALID_ORDER_STATE = 'Invalid: Not possible in the order\'s current status';

export type OrderScope = {
    staff: StaffUser;
    all: boolean;
    /** Partners whose orders, executives and routing this staff member handles. */
    partnerIds: string[];
    /** RMs: every order not yet routed to a partner. */
    allUnrouted: boolean;
    /** Partners: unrouted orders in these pincodes. */
    unroutedPincodes: string[];
    /** Zonal heads: any order in these pincodes or naming one of these cities (lower case) in its address. */
    territoryPincodes: string[];
    territoryCityNames: string[];
};

type ScopedOrder = { partnerId?: string | null; pincode?: string | null; address?: string | null };

export async function orderScopeFor(staff: StaffUser): Promise<OrderScope> {
    const scope: OrderScope = {
        staff, all: false, partnerIds: [], allUnrouted: false, unroutedPincodes: [], territoryPincodes: [], territoryCityNames: [],
    };
    if (isAdminRole(staff.role)) return { ...scope, all: true };

    if (staff.role === 'ZONAL_HEAD') {
        const cityIds = await zonalHeadManagedCityIds(staff);
        const [team, cityPartners, cities] = await Promise.all([
            riderTeamPartnerIds(staff),
            prisma.user.findMany({ where: { role: 'PARTNER', cityId: { in: cityIds } }, select: { pincodes: true } }),
            prisma.city.findMany({ where: { id: { in: cityIds } }, select: { name: true } }),
        ]);
        return {
            ...scope,
            partnerIds: team ?? [],
            territoryPincodes: cityPartners.flatMap(p => p.pincodes),
            territoryCityNames: cities.map(c => c.name.toLowerCase()),
        };
    }

    if (staff.role === 'RELATIONSHIP_MANAGER') {
        const partners = await prisma.user.findMany({
            where: { role: 'PARTNER', relationshipManagerId: staff.id }, select: { id: true },
        });
        return { ...scope, partnerIds: partners.map(p => p.id), allUnrouted: true };
    }

    if (staff.role === 'PARTNER') {
        const me = await prisma.user.findUnique({ where: { id: staff.id }, select: { pincodes: true } });
        return { ...scope, partnerIds: [staff.id], unroutedPincodes: me?.pincodes ?? [] };
    }

    return scope;
}

export function orderInScope(scope: OrderScope, order: ScopedOrder): boolean {
    if (scope.all) return true;
    if (order.partnerId && scope.partnerIds.includes(order.partnerId)) return true;
    if (!order.partnerId && (scope.allUnrouted || (!!order.pincode && scope.unroutedPincodes.includes(order.pincode)))) return true;
    if (order.pincode && scope.territoryPincodes.includes(order.pincode)) return true;
    const address = order.address?.toLowerCase();
    return !!address && scope.territoryCityNames.some(name => address.includes(name));
}

/** May route orders to this partner (assign or re-assign). Partners never re-route. */
export function canRouteTo(scope: OrderScope, partnerId: string): boolean {
    if (scope.staff.role === 'PARTNER') return false;
    return scope.all || scope.partnerIds.includes(partnerId);
}

/** May give orders to this executive: admins any; others only executives of their partners. */
export function canAssignRider(scope: OrderScope, rider: { partnerId: string | null }): boolean {
    return scope.all || (!!rider.partnerId && scope.partnerIds.includes(rider.partnerId));
}

/** The signed-in staff member (one of `roles`), the order, and their scope; throws unless the order is theirs. */
export async function requireOrderAccess(orderId: string, roles: string[]) {
    const staff = await requireStaffRole(roles);
    if (typeof orderId !== 'string' || !orderId) throw new Error(ORDER_NOT_FOUND);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error(ORDER_NOT_FOUND);
    const scope = await orderScopeFor(staff);
    if (!orderInScope(scope, order)) throw new Error(FORBIDDEN_ORDER);
    return { staff, order, scope };
}

/** HTTP status for an error thrown by the checks above (API routes). */
export function httpStatusFor(error: unknown): number {
    const message = error instanceof Error ? error.message : '';
    if (message === UNAUTHORIZED) return 401;
    if (message === FORBIDDEN_ROLE || message.startsWith('Forbidden')) return 403;
    if (message === ORDER_NOT_FOUND) return 404;
    if (message.startsWith('Invalid')) return 400;
    return 500;
}
