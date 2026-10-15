import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';

// Inbound mail from a self-hosted mail server (Postal, Mailgun, ...), shown in the admin panel's email hub.
// The mail server must send the shared secret EMAIL_WEBHOOK_SECRET in the X-Webhook-Secret header; without the
// variable the endpoint is off. (Before, anyone could post "emails" into the admin inbox.)
function authorised(req: Request) {
    const secret = process.env.EMAIL_WEBHOOK_SECRET;
    const sent = req.headers.get('x-webhook-secret');
    if (!secret || !sent) return false;
    const a = Buffer.from(sent);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
    if (!authorised(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const payload = await req.json();

        // Adjust these field mappings dynamically based on what your custom Mail Server
        // formats inbound webhooks as (Postal, Mailgun, Sendgrid, etc. all serialize slightly differently)
        const from = payload.from || payload.mail_from || 'Unknown';
        const to = payload.to || payload.rcpt_to || 'Unknown';
        const subject = payload.subject || 'No Subject';
        const bodyText = payload.text || payload.plain_body || '';
        const bodyHtml = payload.html || payload.html_body || '';

        // Avoid self-loops if somehow the outbound email is caught here
        if (from.includes('@fonzkart.in') && to.includes('@fonzkart.in')) {
            console.log('Detected internal loop, ignoring webhook for', subject);
            return NextResponse.json({ status: 'ignored' });
        }

        await prisma.emailMessage.create({
            data: {
                from,
                to,
                subject,
                bodyText,
                bodyHtml,
                isOutbound: false,
                status: 'delivered',
            }
        });

        console.log(`[CUSTOM MAIL SERVER INBOUND] Received email from ${from} to ${to}: ${subject}`);
        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Error handling email webhook from custom mail server', error);
        return NextResponse.json({ error: 'Failed to handle webhook' }, { status: 500 });
    }
}
