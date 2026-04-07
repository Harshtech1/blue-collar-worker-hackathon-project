import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// ─── Nodemailer transporter (Local dev fallback only) ───────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // true for 465
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
    connectionTimeout: 10000, // 10 seconds
    socketTimeout: 15000,     // 15 seconds
    family: 4 // Force IPv4
});

// ─── Send email via Resend HTTP API (works on Render/serverless) ────────────
const sendViaResend = async (to, subject, text) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false; // Signal caller to try fallback

    const fromAddress = process.env.RESEND_FROM || 'onboarding@resend.dev';

    console.log(`[Email] Attempting Resend API → to: ${to}, from: ${fromAddress}`);

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            from: fromAddress,
            to: Array.isArray(to) ? to : [to],
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #2563eb;">RAHI - Verification Code</h2>
                    <p style="font-size: 16px; color: #333;">${text}</p>
                    <p style="font-size: 13px; color: #888; margin-top: 24px;">
                        This code expires in 10 minutes. If you didn't request this, please ignore this email.
                    </p>
                </div>
            `
        })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Resend API Error (${response.status}): ${errData.message || JSON.stringify(errData)}`);
    }

    const result = await response.json();
    console.log(`[Email] ✅ Sent via Resend API to ${to} (id: ${result.id})`);
    return true;
};

// ─── Send email via Nodemailer SMTP (local dev) ─────────────────────────────
const sendViaNodemailer = async (to, subject, text) => {
    console.log(`[Email] Attempting Nodemailer SMTP → to: ${to}, host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);

    const mailOptions = {
        from: process.env.SMTP_EMAIL,
        to,
        subject,
        text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] ✅ Sent via Nodemailer to ${to} (messageId: ${info.messageId})`);
    return true;
};

// ─── Main export ────────────────────────────────────────────────────────────
export const sendEmail = async (to, subject, text) => {
    try {
        // Strategy 1: Use Resend API (HTTP-based, works on Render/serverless)
        const sentViaResend = await sendViaResend(to, subject, text);
        if (sentViaResend) return;

        // Strategy 2: Fallback to Nodemailer SMTP (local development)
        console.log('[Email] Resend API key not configured, falling back to Nodemailer SMTP...');
        await sendViaNodemailer(to, subject, text);
    } catch (error) {
        console.error('[Email] ❌ Failed to send email:', error.message || error);
        console.error('[Email] Details:', JSON.stringify({
            to,
            subject,
            hasResendKey: !!process.env.RESEND_API_KEY,
            smtpHost: process.env.SMTP_HOST,
            smtpEmail: process.env.SMTP_EMAIL ? '***configured***' : '***missing***',
            nodeEnv: process.env.NODE_ENV,
        }));
        throw new Error('Email could not be sent');
    }
};
