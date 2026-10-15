import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { execSSH } from '@/lib/ssh';
import { mailHttpStatus, mailboxAddress, mailserverCommand, mailserverSshHost, requireMailAdmin } from '@/lib/mail-admin';

// Mailbox accounts of the email system: administrators only (lib/mail-admin.ts). The mail server itself is changed
// only when MAILSERVER_SSH_HOST is set; otherwise the account is kept in the database and vpsStatus says 'skipped'.

function denied(e: unknown) {
  const status = mailHttpStatus(e);
  return NextResponse.json({ message: status === 500 ? 'Internal error' : (e as Error).message }, { status });
}

export async function GET() {
  try {
    await requireMailAdmin();
    const accounts = await prisma.emailAccount.findMany({
      select: { email: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ accounts });
  } catch (e) {
    return denied(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireMailAdmin();
    const body = await req.json().catch(() => ({}));
    const email = mailboxAddress(body?.email);
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!body?.email || !password) {
      return NextResponse.json({ message: 'Email and password required' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ message: 'Invalid: Mailbox must be name@fonzkart.in' }, { status: 400 });
    }

    // 1. Create locally in our db
    await prisma.emailAccount.create({ data: { email, password } });

    // 2. Configure the docker-mailserver account (production mail server only)
    let vpsStatus = 'skipped';
    const host = mailserverSshHost();
    if (host) {
      try {
        await execSSH(host, mailserverCommand('add', email, password));
        vpsStatus = 'success';
      } catch (e) {
        console.warn('Mail server account creation failed; the account is saved locally:', e instanceof Error ? e.message : e);
        vpsStatus = 'failed';
      }
    }

    return NextResponse.json({ success: true, email, vpsStatus });
  } catch (e) {
    return denied(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireMailAdmin();
    const { searchParams } = new URL(req.url);
    const email = mailboxAddress(searchParams.get('email'));

    if (!email) {
      return NextResponse.json({ message: 'Email query parameter required (name@fonzkart.in)' }, { status: 400 });
    }

    // 1. Delete from LOCAL DB
    const deleted = await prisma.emailAccount.delete({ where: { email } }).catch(() => null);
    if (!deleted) {
      return NextResponse.json({ message: 'Account not found in local database. It may have already been removed.' }, { status: 404 });
    }

    // 2. Remove the account from the mail server
    let vpsStatus = 'skipped';
    const host = mailserverSshHost();
    if (host) {
      try {
        await execSSH(host, mailserverCommand('del', email));
        vpsStatus = 'success';
      } catch (e) {
        console.warn('Mail server account removal failed; continued with local purge:', e instanceof Error ? e.message : e);
        vpsStatus = 'failed';
      }
    }

    // 3. Clear associated messages
    const msgStats = await prisma.emailMessage.deleteMany({
      where: { OR: [{ from: email }, { to: email }] }
    });

    return NextResponse.json({
      success: true,
      message: `Account ${email} purged.`,
      vpsStatus,
      messagesCleared: msgStats.count
    });
  } catch (e) {
    return denied(e);
  }
}
