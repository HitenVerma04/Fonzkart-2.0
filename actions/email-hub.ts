'use server';

import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { execSSH } from '@/lib/ssh';
import { mailboxAddress, mailserverCommand, mailserverSshHost, reachableMailboxes, requireMailAdmin, requireMailbox } from '@/lib/mail-admin';
import { revalidatePath } from 'next/cache';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

/**
 * Syncs IMAP emails to the database for all or a specific account
 */
export async function syncImapEmails(targetAccount?: string) {
    // A server action anyone could call: one mailbox the caller may use, or all of them for administrators.
    if (targetAccount) await requireMailbox(targetAccount);
    else await requireMailAdmin();
    const accounts = await prisma.emailAccount.findMany({
        where: targetAccount ? { email: targetAccount } : {}
    });

    const results = [];

    for (const acc of accounts) {
        try {
            const imapHost = (!process.env.SMTP_HOST || process.env.SMTP_HOST === '10.0.5.2')
                ? '89.116.27.217'
                : process.env.SMTP_HOST;

            const client = new ImapFlow({
                host: imapHost,
                port: 143,
                secure: false,
                auth: { user: acc.email, pass: acc.password },
                tls: { rejectUnauthorized: false },
                logger: false
            });
            await client.connect();
            let lock = await client.getMailboxLock('INBOX');
            try {
                const mailbox = client.mailbox as any;
                if (mailbox && mailbox.exists > 0) {
                    const limit = 50; 
                    const seq = mailbox.exists > limit ? `${mailbox.exists - (limit - 1)}:*` : '1:*';
                    
                    for await (let msg of client.fetch(seq, { source: true, uid: true })) {
                        if (msg.source) {
                            const parsed = await simpleParser(msg.source);
                            const fromEmail = (parsed.from as any)?.value?.[0]?.address || (parsed.from as any)?.text || '';
                            const toEmail = (parsed.to as any)?.value?.[0]?.address || (parsed.to as any)?.text || acc.email;
                            const messageId = msg.uid.toString() + '-' + acc.email;

                            await prisma.emailMessage.upsert({
                                where: { messageId },
                                create: {
                                    messageId,
                                    from: fromEmail,
                                    to: toEmail,
                                    subject: parsed.subject || 'No Subject',
                                    bodyText: parsed.text || '',
                                    bodyHtml: typeof parsed.html === 'string' ? parsed.html : undefined,
                                    bodySnippet: (parsed.text || '').substring(0, 150),
                                    receivedAt: parsed.date || new Date(),
                                    isOutbound: false,
                                    status: 'received'
                                },
                                update: {}
                            });
                        }
                    }
                }
                results.push({ email: acc.email, status: 'success' });
            } finally {
                lock.release();
            }
            await client.logout();
        } catch (e: any) {
            console.error(`IMAP sync failed for ${acc.email}: ${e}`);
            results.push({ email: acc.email, status: 'failed', error: e.message });
        }
    }
    return results;
}

export async function fetchRoleBasedEmails(selectedAccount?: string, skipSync: boolean = false) {
    try {
        const session = await getSession();
        if (!session || !session.user) return { error: 'Unauthorized', emails: [] };

        const currentUser: any = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { managedCities: { include: { users: { where: { role: 'PARTNER' } } } } }
        });
        if (!currentUser) return { error: 'User not found in database', emails: [] };

        const role = currentUser.role;
        const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

        // Fetch reachable accounts for this user
        let reachableEmails: string[] = [currentUser.email];
        
        if (role === 'ZONAL_HEAD') {
            const partnerIds = currentUser.managedCities.flatMap((c: any) => c.users.map((u: any) => u.id));
            const partners = await prisma.user.findMany({ where: { id: { in: partnerIds } }, select: { email: true } });
            const riders = await prisma.rider.findMany({ where: { partnerId: { in: partnerIds } }, select: { phone: true } });
            
            reachableEmails.push(...partners.map(p => p.email));
            reachableEmails.push(...riders.map(r => `${r.phone}@fonzkart.in`));
        } else if (role === 'PARTNER') {
            const riders = await prisma.rider.findMany({ where: { partnerId: currentUser.id }, select: { phone: true } });
            reachableEmails.push(...riders.map(r => `${r.phone}@fonzkart.in`));
        } else if (isAdmin) {
            const allAccounts = await prisma.emailAccount.findMany({ select: { email: true } });
            reachableEmails = allAccounts.map(a => a.email);
        }

        // Trigger sync only if requested and user has rights
        if (!skipSync && selectedAccount && (isAdmin || reachableEmails.includes(selectedAccount))) {
            await syncImapEmails(selectedAccount);
        }

        // Build where clause
        let whereClause: any = {};
        if (selectedAccount) {
            // Security check: is selectedAccount reachable?
            if (!reachableEmails.includes(selectedAccount) && !isAdmin) {
                 return { error: 'Access denied to this mailbox', emails: [] };
            }
            whereClause = {
                OR: [ { from: selectedAccount }, { to: selectedAccount } ]
            };
        } else if (!isAdmin) {
            // If No account selected and not admin, show all emails for reachable accounts
            whereClause = {
                OR: [
                    { from: { in: reachableEmails } },
                    { to: { in: reachableEmails } }
                ]
            };
        }

        const messages = await prisma.emailMessage.findMany({
            where: whereClause,
            orderBy: { receivedAt: 'desc' },
            take: 300 
        });

        const totalInDb = await prisma.emailMessage.count();
        const totalAccounts = reachableEmails.length;

        const allEmails = messages.map(msg => ({
            id: msg.id,
            subject: msg.subject || 'No Subject',
            fromEmail: msg.from,
            toEmail: msg.to,
            date: msg.receivedAt,
            text: msg.bodyText || '',
            snippet: msg.bodySnippet || '',
            isOutbound: msg.isOutbound,
            bodyHtml: msg.bodyHtml
        }));

        return { 
            emails: allEmails, 
            totalInDb, 
            totalAccounts,
            userRole: role,
            userEmail: currentUser.email,
            reachableEmails
        };
    } catch (e: any) {
        return { error: e.message, emails: [], totalInDb: 0 };
    }
}

export async function fetchEmailById(id: string) {
    const access = await reachableMailboxes(); // throws 'Unauthorized' without a session
    const message = typeof id === 'string' && id ? await prisma.emailMessage.findUnique({ where: { id } }) : null;
    // Only messages from or to a mailbox the caller may use (administrators: all).
    if (!message || (!access.all && !access.emails.includes(message.from) && !access.emails.includes(message.to))) return null;
    return message;
}

export async function deleteEmailAccountAction(email: string) {
    try {
        await requireMailAdmin(); // the role as stored now, not as remembered in the session cookie
        const mailbox = mailboxAddress(email);
        if (!mailbox) throw new Error('Invalid: Mailbox');
        email = mailbox;

        // 1. Delete from LOCAL DB
        const deleted = await prisma.emailAccount.delete({
            where: { email }
        }).catch(e => {
            console.error("Local DB Deletion failed:", e.message);
            return null;
        });

        if (!deleted) {
            throw new Error('Account not found in database.');
        }

        // 2. SSH into VPS and remove account from mailserver
        const host = mailserverSshHost();
        if (host) {
            try {
                await execSSH(host, mailserverCommand('del', email));
            } catch (e: any) {
                console.warn("VPS removal failed, continuing...", e.message);
            }
        }

        // 3. Clear associated messages
        await prisma.emailMessage.deleteMany({
            where: {
                OR: [ { from: email }, { to: email } ]
            }
        });

        revalidatePath('/admin/email');
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}
