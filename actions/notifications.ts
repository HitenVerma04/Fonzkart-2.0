"use server";
import { prisma } from "@/lib/db";
import { getCurrentStaff, type StaffUser } from "@/lib/staff-access";

// In-app notifications for the admin panel bell. Who the caller is comes from the signed-in session and the
// database (getCurrentStaff), never from arguments sent by the browser: the old (role, userId) parameters are still
// accepted so existing callers keep working, but they are ignored.
//
// A staff member receives notifications addressed to them (userId), to their role (role), and system-wide
// broadcasts (no userId, no role, no riderId). Notifications for executives (riderId) are theirs alone.
// Notifications are created by server code only (lib/order-workflow.ts, lib/store.ts); there is no browser-callable
// "create" action.

export type NotificationType = "info" | "order_new" | "order_assigned" | "order_price_review";

/** Everyone who can open the admin panel (lib/auth-utils.ts → isAdmin). */
const PANEL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ZONAL_HEAD', 'RELATIONSHIP_MANAGER', 'PARTNER', 'FIELD_EXECUTIVE'];

/** The notifications a staff member may see. */
function addressedTo(staff: StaffUser) {
    return {
        OR: [
            { userId: staff.id },
            { role: staff.role },
            { userId: null, role: null, riderId: null }, // system-wide
        ]
    };
}

async function currentPanelUser(): Promise<StaffUser | null> {
    const staff = await getCurrentStaff();
    return staff && PANEL_ROLES.includes(staff.role) ? staff : null;
}

export async function getNotifications(_userRole?: string, _userId?: string) {
    try {
        const staff = await currentPanelUser();
        if (!staff) return { success: true, notifications: [] };
        const notifications = await prisma.notification.findMany({
            where: addressedTo(staff),
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        return { success: true, notifications };
    } catch (error) {
        console.error("Failed to load notifications:", error instanceof Error ? error.message : error);
        return { success: false };
    }
}

export async function markAsRead(id: string) {
    try {
        const staff = await currentPanelUser();
        if (!staff || typeof id !== 'string' || !id) return { success: false };
        const { count } = await prisma.notification.updateMany({
            where: { id, ...addressedTo(staff) },
            data: { isRead: true }
        });
        return { success: count > 0 };
    } catch (error) {
        console.error("Failed to mark notification read:", error instanceof Error ? error.message : error);
        return { success: false };
    }
}

export async function markAllAsRead(_userRole?: string, _userId?: string) {
    try {
        const staff = await currentPanelUser();
        if (!staff) return { success: false };
        await prisma.notification.updateMany({
            // Only the caller's own and role notifications; shared system-wide ones stay as they are.
            where: { OR: [{ userId: staff.id }, { role: staff.role }], isRead: false },
            data: { isRead: true }
        });
        return { success: true };
    } catch (error) {
        console.error("Failed to mark notifications read:", error instanceof Error ? error.message : error);
        return { success: false };
    }
}

/** The header's "Pulse Test" button: a test notification for the person who pressed it (not for everyone). */
export async function sendPulseTest() {
    const staff = await currentPanelUser();
    if (!staff) return { success: false };
    await prisma.notification.create({
        data: {
            userId: staff.id,
            title: "DB Heartbeat Pulse",
            message: "Synchronized with FonzKart server.",
            type: "info"
        }
    });
    return { success: true };
}
