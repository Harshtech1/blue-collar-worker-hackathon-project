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

// ─── Send email via Brevo HTTP API (works on Render/serverless) ────────────
const sendViaBrevo = async (to, subject, text) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return false; // Signal caller to try fallback

    const fromAddress = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_EMAIL || '23100010042.uset@ltsu.ac.in';
    const recipientList = Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }];

    console.log(`[Email] Attempting Brevo API → to: ${to}, from: ${fromAddress}`);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: { email: fromAddress, name: 'RAHI Platform' },
            to: recipientList,
            subject: subject,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eaeaea; border-radius: 8px;">
                    <h2 style="color: #2563eb; margin-bottom: 20px;">RAHI Security</h2>
                    <p style="font-size: 16px; color: #333; line-height: 1.5;">${text}</p>
                    <hr style="border: none; border-top: 1px solid #eaeaea; margin: 24px 0;" />
                    <p style="font-size: 12px; color: #888;">
                        This code expires in 10 minutes. If you didn't request this, please ignore this email.
                    </p>
                </div>
            `
        })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Brevo API Error (${response.status}): ${errData.message || JSON.stringify(errData)}`);
    }

    const result = await response.json();
    console.log(`[Email] ✅ Sent via Brevo API to ${to} (messageId: ${result.messageId})`);
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
        if (process.env.BREVO_API_KEY) {
            return await sendViaBrevo(to, subject, text);
        }
        
        console.log('[Email] Falling back to Nodemailer SMTP (Local dev)...');
        await sendViaNodemailer(to, subject, text);
    } catch (error) {
        console.error('[Email] ❌ Failed to send email:', error.message || error);
        
        // If Brevo failed, try Nodemailer as a last resort
        if (process.env.BREVO_API_KEY) {
            try {
                console.log('[Email] Brevo failed, trying Nodemailer SMTP fallback...');
                return await sendViaNodemailer(to, subject, text);
            } catch (fallbackError) {
                console.error('[Email] ❌ Fallback Nodemailer also failed:', fallbackError.message);
            }
        }

        console.error('[Email] Details:', JSON.stringify({
            to,
            subject,
            hasBrevoKey: !!process.env.BREVO_API_KEY,
            smtpHost: process.env.SMTP_HOST,
            smtpEmail: process.env.SMTP_EMAIL ? '***configured***' : '***missing***',
            nodeEnv: process.env.NODE_ENV,
        }));
        throw new Error('Email could not be sent');
    }
};
