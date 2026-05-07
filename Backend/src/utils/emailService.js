import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const getBrevoAddresses = () => {
    const smtpLogin = process.env.BREVO_SMTP_LOGIN || process.env.BREVO_SENDER_EMAIL;
    const fromAddress = process.env.BREVO_SENDER_EMAIL || process.env.BREVO_SMTP_LOGIN;

    if (!smtpLogin || !fromAddress) {
        console.warn('[Email] BREVO_SMTP_LOGIN/BREVO_SENDER_EMAIL not configured');
        return null;
    }

    return {
        smtpLogin: smtpLogin.trim(),
        fromAddress: fromAddress.trim(),
    };
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');

// ─── Brevo SMTP transporter (works on Render - port 587 is NOT blocked) ──────
// This is the FALLBACK when Brevo HTTP API fails
// Brevo SMTP relay: smtp-relay.brevo.com:587
const createBrevoSmtpTransporter = () => {
    // Fallback logic: If BREVO_SMTP_KEY is missing, use BREVO_API_KEY
    const smtpKey = process.env.BREVO_SMTP_KEY || process.env.BREVO_API_KEY;
    const addresses = getBrevoAddresses();
    if (!addresses) {
        return null;
    }

    return nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false, // STARTTLS
        auth: {
            user: addresses.smtpLogin,
            pass: smtpKey ? smtpKey.trim() : '',
        },
        connectionTimeout: 30000, // Increased to 30s
        socketTimeout: 30000,
    });
};

// ─── Send email via Brevo HTTP API (primary method) ─────────────────────────
const sendViaBrevoApi = async (to, subject, htmlBody) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        console.warn('[Email] BREVO_API_KEY not set, skipping Brevo API');
        return false;
    }

    // BREAKING: If it starts with xsmtpsib-, it is an SMTP password, NOT an API key.
    // The Brevo v3 API will return 401 if we use an SMTP password.
    if (apiKey.startsWith('xsmtpsib-')) {
        console.warn('[Email] Detecting SMTP Key in API field. Skipping HTTP API and moving to SMTP fallback.');
        return false;
    }

    const addresses = getBrevoAddresses();
    if (!addresses) {
        return false;
    }
    const fromAddress = addresses.fromAddress;
    const recipientList = Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }];

    const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4);
    console.log(`[Email] Trying Brevo HTTP API (Key: ${maskedKey}) → to: ${to}, from: ${fromAddress}`);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': apiKey.trim(), // trim to handle accidental spaces
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: { email: fromAddress, name: 'RAHI Platform' },
            to: recipientList,
            subject: subject,
            htmlContent: htmlBody
        })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: response.statusText }));
        // Log the FULL error detail for debugging
        console.error(`[Email] Brevo API Error ${response.status}:`, JSON.stringify(errData));
        throw new Error(`Brevo API Error (${response.status}): ${errData.message || JSON.stringify(errData)}`);
    }

    const result = await response.json();
    console.log(`[Email] ✅ Sent via Brevo HTTP API to ${to} (messageId: ${result.messageId})`);
    return true;
};

// ─── Send email via Brevo SMTP (fallback - works on Render) ─────────────────
const sendViaBrevoSmtp = async (to, subject, htmlBody) => {
    const smtpKey = process.env.BREVO_SMTP_KEY || process.env.BREVO_API_KEY;
    if (!smtpKey) {
        console.warn('[Email] No SMTP or API key found for fallback. Skipping SMTP.');
        return false;
    }

    const addresses = getBrevoAddresses();
    if (!addresses) {
        return false;
    }
    const fromAddress = addresses.fromAddress;
    console.log(`[Email] Trying Brevo SMTP → to: ${to}, host: smtp-relay.brevo.com:587`);

    const transporter = createBrevoSmtpTransporter();
    if (!transporter) {
        return false;
    }
    const info = await transporter.sendMail({
        from: `"RAHI Platform" <${fromAddress}>`,
        to,
        subject,
        html: htmlBody,
    });

    console.log(`[Email] ✅ Sent via Brevo SMTP to ${to} (messageId: ${info.messageId})`);
    return true;
};

// ─── Shared HTML email template ──────────────────────────────────────────────
const buildHtmlEmail = (text) => `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-bottom: 20px;">RAHI Security</h2>
        <p style="font-size: 16px; color: #333; line-height: 1.5;">${escapeHtml(text)}</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 24px 0;" />
        <p style="font-size: 12px; color: #888;">
            This code expires in 10 minutes. If you didn't request this, please ignore this email.
        </p>
    </div>
`;

// ─── Main export ─────────────────────────────────────────────────────────────
export const sendEmail = async (to, subject, text) => {
    const htmlBody = buildHtmlEmail(text);

    // 1️⃣ Try Brevo HTTP API first (fastest, most reliable)
    try {
        const sent = await sendViaBrevoApi(to, subject, htmlBody);
        if (sent) return true;
    } catch (err) {
        console.error('[Email] Brevo HTTP API failed:', err.message);
    }

    // 2️⃣ Fallback: Brevo SMTP relay (also works on Render, port 587 is open)
    try {
        const sent = await sendViaBrevoSmtp(to, subject, htmlBody);
        if (sent) return true;
    } catch (err) {
        console.error('[Email] Brevo SMTP fallback failed:', err.message);
    }

    // 3️⃣ All methods failed
    console.error('[Email] ❌ All email methods failed.', JSON.stringify({
        to,
        subject,
        hasBrevoApiKey: !!process.env.BREVO_API_KEY,
        hasBrevoSmtpLogin: !!process.env.BREVO_SMTP_LOGIN,
        hasBrevoSmtpKey: !!process.env.BREVO_SMTP_KEY,
        nodeEnv: process.env.NODE_ENV,
    }));
    throw new Error('Email could not be sent');
};
