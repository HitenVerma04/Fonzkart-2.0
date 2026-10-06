
'use server';

import { db } from '@/lib/store';
import { getSession } from '@/lib/session';
import { sendSystemEmail } from '@/lib/email';
// import { redirect } from 'next/navigation';

export async function placeOrder(
    device: string,
    variant: string,
    price: number,
    address: string,
    pincode: string,
    location: { lat: number; lng: number } | null,
    answers: unknown
) {
    const session = await getSession();
    if (!session || !session.user) {
        throw new Error('Unauthorized');
    }

    const order = {
        id: crypto.randomUUID(),
        userId: session.user.id,
        device: `${device} (${variant})`,
        price,
        date: new Date().toISOString(),
        status: 'Pending Pickup',
        address,
        pincode,
        location,
        answers
    };

    await db.addOrder(order);

    const user = await db.findUserById(session.user.id);
    if (user?.email) {
        const orderHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #10b981; border-radius: 10px;">
            <h2 style="color: #10b981;">Order Confirmed!</h2>
            <p>Dear ${session.user.name}, your request to sell your <b>${device} (${variant})</b> has been successfully recorded.</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><b>Estimated Value:</b> ₹${price}</p>
                <p><b>Status:</b> Pending Pickup</p>
            </div>
            <p>Our team will review your order and allocate a dedicated executive to your address for pickup shortly.</p>
            <p style="color: #888; font-size: 12px; margin-top: 20px;">Fonzkart Logistics</p>
          </div>
        `;
        sendSystemEmail(user.email, 'Fonzkart: Order Confirmed', orderHtml);
    }

    return { success: true };
}

export async function getUserOrders() {
    const session = await getSession();
    if (!session || !session.user) return [];

    const orders = await db.getOrders(session.user.id);
    // The tracker shows who is coming: the assigned executive's name and phone (also sent by email on assignment).
    const { prisma } = await import('@/lib/db');
    const riderIds = [...new Set(orders.map(o => o.riderId).filter((id): id is string => !!id))];
    const riders = riderIds.length
        ? await prisma.rider.findMany({ where: { id: { in: riderIds } }, select: { id: true, name: true, phone: true } })
        : [];
    return orders.map(o => {
        const rider = riders.find(r => r.id === o.riderId);
        return { ...o, executive: rider ? { name: rider.name, phone: rider.phone } : null };
    });
}

export async function checkPincodeAvailability(pincode: string) {
    const { prisma } = await import('@/lib/db');
    const city = await prisma.city.findFirst({
        where: {
            isActive: true,
            pincodes: { has: pincode }
        }
    });
    return !!city;
}

export async function requestServiceArea(pincode: string, phone: string, address: string) {
    // Send an email to the admin about the new service area request
    const adminEmail = process.env.SUPERADMIN_EMAIL || 'admin@fonzkart.in';
    const html = `
        <h2>New Service Area Request</h2>
        <p>A customer has requested service in an area that is currently not serviceable.</p>
        <ul>
            <li><b>Pincode:</b> ${pincode}</li>
            <li><b>Phone:</b> ${phone || 'Not provided'}</li>
            <li><b>Address/Location:</b> ${address || 'Not provided'}</li>
        </ul>
    `;
    await sendSystemEmail(adminEmail, `Service Area Request for ${pincode}`, html);
    return { success: true };
}
