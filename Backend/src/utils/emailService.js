import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // true for 465
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
    connectionTimeout: 10000, // 10 seconds
    family: 4 // Force IPv4
});


export const sendEmail = async (to, subject, text) => {
    try {
        // If RESEND_API_KEY is available, use their HTTP API to bypass Render's SMTP block
        if (process.env.RESEND_API_KEY) {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
                },
                body: JSON.stringify({
                    from: 'onboarding@resend.dev', // Resend's free tier testing email
                    to: [to],
                    subject: subject,
                    html: `<p>${text}</p>`
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(`Resend API Error: ${errData.message}`);
            }
            console.log(`Email sent via Resend API to ${to}`);
            return;
        }

        // Fallback to Nodemailer for Local Dev
        const mailOptions = {
            from: process.env.SMTP_EMAIL,
            to,
            subject,
            text,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent via Nodemailer to ${to}`);
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Email could not be sent');
    }
};
