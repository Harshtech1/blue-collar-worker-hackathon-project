import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')
  .replace(/`/g, '&#96;');

const getBrevoAddresses = () => {
  const smtpLogin = process.env.BREVO_SMTP_LOGIN || process.env.BREVO_SENDER_EMAIL;
  const fromAddress = process.env.BREVO_SENDER_EMAIL || process.env.BREVO_SMTP_LOGIN;

  if (!smtpLogin || !fromAddress) {
    return null;
  }

  return {
    smtpLogin: smtpLogin.trim(),
    fromAddress: fromAddress.trim(),
  };
};

const createBrevoSmtpTransporter = () => {
  const smtpKey = process.env.BREVO_SMTP_KEY || process.env.BREVO_API_KEY;
  const addresses = getBrevoAddresses();

  if (!smtpKey || !addresses) {
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: addresses.smtpLogin,
      pass: smtpKey.trim(),
    },
    connectionTimeout: 30000,
    socketTimeout: 30000,
  });
};

const createGenericSmtpTransporter = () => {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_EMAIL?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();

  if (!host || !port || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 30000,
    socketTimeout: 30000,
  });
};

const buildHtmlEmail = (text) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eaeaea; border-radius: 8px;">
    <h2 style="color: #2563eb; margin-bottom: 20px;">RAHI Security</h2>
    <p style="font-size: 16px; color: #333; line-height: 1.5;">${escapeHtml(text)}</p>
    <hr style="border: none; border-top: 1px solid #eaeaea; margin: 24px 0;" />
    <p style="font-size: 12px; color: #888;">
      This code expires in 10 minutes. If you did not request this, please ignore this email.
    </p>
  </div>
`;

const sendViaBrevoApi = async (to, subject, htmlBody) => {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const addresses = getBrevoAddresses();

  if (!apiKey || !addresses) {
    return false;
  }

  if (apiKey.startsWith('xsmtpsib-')) {
    console.warn('[Email] BREVO_API_KEY appears to be an SMTP password. Skipping HTTP API.');
    return false;
  }

  const fromAddress = addresses.fromAddress;
  const recipients = Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }];

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: fromAddress, name: 'RAHI Platform' },
      to: recipients,
      subject,
      htmlContent: htmlBody,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Brevo API Error (${response.status}): ${errData.message || JSON.stringify(errData)}`);
  }

  const result = await response.json();
  console.log(`[Email] Sent via Brevo HTTP API to ${to} (messageId: ${result.messageId})`);
  return true;
};

const sendViaBrevoSmtp = async (to, subject, htmlBody) => {
  const transporter = createBrevoSmtpTransporter();
  const addresses = getBrevoAddresses();

  if (!transporter || !addresses) {
    return false;
  }

  const info = await transporter.sendMail({
    from: `"RAHI Platform" <${addresses.fromAddress}>`,
    to,
    subject,
    html: htmlBody,
  });

  console.log(`[Email] Sent via Brevo SMTP to ${to} (messageId: ${info.messageId})`);
  return true;
};

const sendViaGenericSmtp = async (to, subject, htmlBody) => {
  const transporter = createGenericSmtpTransporter();
  const fromAddress = process.env.SMTP_FROM_EMAIL?.trim() || process.env.SMTP_EMAIL?.trim();

  if (!transporter || !fromAddress) {
    return false;
  }

  const info = await transporter.sendMail({
    from: `"RAHI Platform" <${fromAddress}>`,
    to,
    subject,
    html: htmlBody,
  });

  console.log(`[Email] Sent via generic SMTP to ${to} (messageId: ${info.messageId})`);
  return true;
};

export const sendEmail = async (to, subject, text) => {
  const htmlBody = buildHtmlEmail(text);

  try {
    if (await sendViaBrevoApi(to, subject, htmlBody)) return true;
  } catch (err) {
    console.error('[Email] Brevo HTTP API failed:', err.message);
  }

  try {
    if (await sendViaBrevoSmtp(to, subject, htmlBody)) return true;
  } catch (err) {
    console.error('[Email] Brevo SMTP fallback failed:', err.message);
  }

  try {
    if (await sendViaGenericSmtp(to, subject, htmlBody)) return true;
  } catch (err) {
    console.error('[Email] Generic SMTP fallback failed:', err.message);
  }

  console.error('[Email] All email methods failed.', JSON.stringify({
    to,
    subject,
    hasBrevoApiKey: !!process.env.BREVO_API_KEY,
    hasBrevoSmtpLogin: !!process.env.BREVO_SMTP_LOGIN,
    hasBrevoSmtpKey: !!process.env.BREVO_SMTP_KEY,
    hasGenericSmtp: !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD),
    nodeEnv: process.env.NODE_ENV,
  }));

  throw new Error('Email could not be sent');
};
