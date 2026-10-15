import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import nodemailer from 'nodemailer';
import { mailHttpStatus, requireMailbox } from '@/lib/mail-admin';

// Sends from a Fonzkart mailbox: only one the signed-in staff member may use (lib/mail-admin.ts).
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const fromAccount = formData.get('fromAccount') as string;
    const to = formData.get('to') as string;
    const subject = formData.get('subject') as string;
    const text = formData.get('text') as string;

    if (!fromAccount || !to || !subject || !text) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    try {
      await requireMailbox(fromAccount);
    } catch (e) {
      const status = mailHttpStatus(e);
      return NextResponse.json({ message: status === 500 ? 'Internal error' : (e as Error).message }, { status });
    }

    const attachments = [];
    const files = formData.getAll('attachments') as File[];
    
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      attachments.push({
        filename: file.name,
        content: buffer,
        contentType: file.type
      });
    }

    const account = await prisma.emailAccount.findUnique({ where: { email: fromAccount } });
    if (!account) return NextResponse.json({ message: 'Account not found' }, { status: 404 });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || '89.116.27.217',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // false by default
      auth: {
        user: account.email,
        pass: account.password,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: account.email,
      to,
      subject,
      text,
      attachments,
    });

    // Save to EmailMessage table for history
    try {
      console.log("Saving email to DB...", { messageId: info.messageId });
      await prisma.emailMessage.create({
        data: {
          messageId: info.messageId,
          from: account.email,
          to,
          subject,
          bodyText: text,
          isOutbound: true,
          receivedAt: new Date(),
        }
      });
      console.log("Email saved to DB successfully");
    } catch (dbErr: any) {
      console.error("Database save failed for sent email:", dbErr);
      return NextResponse.json({ 
        success: true, 
        messageId: info.messageId, 
        warning: 'Email sent but failed to save in history log', 
        error: dbErr.message 
      });
    }

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (e: any) {
    console.error("SMTP Error:", e);
    return NextResponse.json({ message: e.message || 'Unknown SMTP error' }, { status: 500 });
  }
}
