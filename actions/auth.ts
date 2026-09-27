
'use server';

import { db } from '@/lib/store';
import { login } from '@/lib/session';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
// import { v4 as uuidv4 } from 'uuid';

import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { sendSystemEmail } from '@/lib/email';
import { SUPER_ADMIN_EMAILS } from '@/lib/auth-utils';
const prisma = new PrismaClient();

const getSMTPHost = () => {
    const host = process.env.SMTP_HOST;
    if (!host || host === '10.0.5.2') {
        return '89.116.27.217';
    }
    return host;
};

export async function signup(prevState: { error?: string } | null, formData: FormData) {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    let phone = formData.get('phone') as string;
    const password = formData.get('password') as string;

    if (!email || !password || !name || !phone) {
        return { error: 'Please fill all fields' };
    }

    if (phone && !phone.startsWith('+91')) {
        phone = `+91${phone}`;
    }

    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
        return { error: 'Email already registered' };
    }

    // A real UUID would be better but simple random string works for mock
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    if (phone) {
        const existingPhoneUser = await prisma.user.findUnique({ where: { phone } });
        if (existingPhoneUser) {
            return { error: 'Phone number already registered' };
        }
    }

    const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(email.toLowerCase());

    try {
        await db.addUser({ id, email, phone, passwordHash, name, role: isSuperAdminEmail ? 'SUPER_ADMIN' : 'UNVERIFIED' });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { error: 'Phone number or email already registered' };
        }
        return { error: 'An error occurred during registration' };
    }

    if (isSuperAdminEmail) {
        await login({ id, email, name, role: 'SUPER_ADMIN' });
        redirect('/admin');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    await db.setResetToken(email, otp, expiry);

    try {
        const systemAccount = await prisma.emailAccount.findFirst();
        const smtpUser = process.env.SMTP_USER || systemAccount?.email;
        const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || systemAccount?.password;

        if (!smtpUser || !smtpPass) {
             return { error: 'No system email accounts exist. Please create one in /admin/email first.' };
        }

        const transporter = nodemailer.createTransport({
            host: getSMTPHost(),
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
            tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({
            from: process.env.SMTP_FROM || smtpUser,
            to: email,
            subject: 'Verify your Fonzkart Account',
            html: `
              <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #333;">Welcome to Fonzkart!</h2>
                <p>Please use the following 6-digit OTP to verify your email address and finish signing up:</p>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                  ${otp}
                </div>
                <p style="color: #888; font-size: 12px;">This code will expire in 15 minutes.</p>
              </div>
            `,
        });
    } catch (e: unknown) {
        console.error("Signup Email Verify Failed", e);
    }

    redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

export async function verifyEmailSignup(prevState: { error?: string, success?: string } | null, formData: FormData) {
    const email = formData.get('email') as string;
    const otp = formData.get('otp') as string;

    if (!email || !otp) {
        return { error: 'Missing information.' };
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
        return { error: 'User not found.' };
    }

    if (user.resetToken !== otp) {
        return { error: 'Invalid OTP provided.' };
    }
    
    if (!user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
        return { error: 'Your OTP has expired. Please sign up again or request a new one.' };
    }

    // Verify user
    const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
    await db.updateUserRole(email, isSuperAdminEmail ? 'SUPER_ADMIN' : 'USER');
    await db.clearResetToken(email);

    // Send Welcome Email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.fonzkart.in';
    const welcomeHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Welcome to Fonzkart, ${user.name}!</h2>
        <p>We are absolutely thrilled to welcome you to the Fonzkart family.</p>
        <p>At Fonzkart, we believe in giving you the fastest, most reliable, and highest-paying platform to sell your used gadgets right from the comfort of your home.</p>
        <p>Now that your account is officially verified, you are ready to sell your very first device in less than 60 seconds.</p>
        
        <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
          <a href="${appUrl}/" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Get Exact Value</a>
        </div>
        
        <p style="color: #888; font-size: 13px;">If you have any questions, our support team is always available to help.</p>
      </div>
    `;
    sendSystemEmail(email, 'Welcome to Fonzkart! 🚀', welcomeHtml);

    // Auto login
    await login({ id: user.id, email: user.email, name: user.name, role: 'USER' });
    redirect('/');
}

export async function signin(prevState: { error?: string } | null, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { error: 'Please fill all fields' };
    }

    let user = await db.findUserByEmail(email);
    
    // Support phone-based login (common for field executives)
    if (!user) {
        let cleanPhone = email.trim();
        // If it looks like a phone number (digits only or starts with +), try phone lookup
        if (/^\+?[\d\s\-]{10,}$/.test(cleanPhone)) {
            if (!cleanPhone.startsWith('+')) {
                // If 10 digits, assume India
                if (cleanPhone.length === 10) cleanPhone = `+91${cleanPhone}`;
                else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) cleanPhone = `+${cleanPhone}`;
            }
            user = await prisma.user.findFirst({
                where: { phone: cleanPhone }
            }) as any;
        }
    }

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return { error: 'Invalid email/phone or password' };
    }

    if (user.role === 'UNVERIFIED') {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 15 * 60 * 1000);
        await db.setResetToken(email, otp, expiry);

        try {
            const systemAccount = await prisma.emailAccount.findFirst();
            const smtpUser = process.env.SMTP_USER || systemAccount?.email;
            const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || systemAccount?.password;

            const transporter = nodemailer.createTransport({
                host: getSMTPHost(),
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: { user: smtpUser, pass: smtpPass },
                tls: { rejectUnauthorized: false }
            });
            await transporter.sendMail({
                from: process.env.SMTP_FROM || 'noreply@fonzkart.in',
                to: email,
                subject: 'Verify your Fonzkart Account',
                html: `<p>Your new verification OTP is: <b>${otp}</b></p>`
            });
        } catch(e) {}

        redirect(`/verify-email?email=${encodeURIComponent(email)}`);
    }

    if (SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        user.role = 'SUPER_ADMIN';
        try {
            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'SUPER_ADMIN' }
            });
        } catch (e) {
            console.error('Failed to sync superadmin in DB:', e);
        }
    } else if (user.email.toLowerCase() === 'mobilesouls.in@gmail.com') {
        user.role = 'USER';
        try {
            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'USER' }
            });
        } catch (e) {
            console.error('Failed to demote mobilesouls in DB:', e);
        }
    }

    console.log('DEBUG SIGNIN USER:', user);
    await login({ id: user.id, email: user.email, name: user.name, role: user.role });
    
    // Redirect privileged users to admin panel, normal users to homepage
    if (['SUPER_ADMIN', 'ADMIN', 'ZONAL_HEAD', 'PARTNER', 'FIELD_EXECUTIVE'].includes(user.role)) {
        redirect('/admin');
    }
    
    redirect('/');
}

export async function createOrderAction(_device: string, _variant: string, _price: number) {
    // This action will be called from client side
}

export async function requestPasswordReset(prevState: { error?: string, success?: string, email?: string, step?: string } | null, formData: FormData) {
    const email = formData.get('email') as string;

    if (!email) {
        return { error: 'Please enter your registered email address.' };
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
        return { error: 'Invalid email. We could not verify ownership.' };
    }

    try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
        
        await db.setResetToken(email, otp, expiry);

        const systemAccount = await prisma.emailAccount.findFirst();
        const smtpUser = process.env.SMTP_USER || systemAccount?.email;
        const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || systemAccount?.password;

        if (!smtpUser || !smtpPass) {
             return { error: 'No system email accounts exist. Please create one in /admin/email first.' };
        }

        const transporter = nodemailer.createTransport({
            host: getSMTPHost(),
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.sendMail({
            from: process.env.SMTP_FROM || smtpUser,
            to: email,
            subject: 'Your Password Reset OTP - Fonzkart',
            html: `
              <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #333;">Password Reset Verification</h2>
                <p>You requested to reset your password on Fonzkart. Please use the following 6-digit OTP to verify your identity:</p>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                  ${otp}
                </div>
                <p style="color: #888; font-size: 12px;">This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
              </div>
            `,
        });

        console.log(`[MAIL SERVER] OTP successfully sent to ${email}`);
    } catch (e: unknown) {
        console.error("Email Sending Failed", e);
        return { error: `Email gateway failed: ${e instanceof Error ? e.message : 'Unknown error'}` };
    }

    return { success: 'OTP successfully sent to your registered email address.', email, step: 'verify' };
}

export async function verifyAndResetPassword(prevState: { error?: string, success?: string } | null, formData: FormData) {
    const email = formData.get('email') as string;
    const otp = formData.get('otp') as string;
    const password = formData.get('password') as string;

    if (!email || !otp || !password) {
        return { error: 'Please fill all fields.' };
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
        return { error: 'Invalid user.' };
    }

    if (user.resetToken !== otp) {
        return { error: 'Invalid OTP provided.' };
    }
    
    if (!user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
        return { error: 'Your OTP has expired. Please request a new one.' };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.updateUserPassword(email, passwordHash);
    await db.clearResetToken(email);

    return { success: 'Password reset successfully! You can now login.' };
}
