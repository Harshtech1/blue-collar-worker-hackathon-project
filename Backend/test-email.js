import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

const sendTestEmail = async () => {
    try {
        console.log("Using Email:", process.env.SMTP_EMAIL);
        console.log("Using Password Length:", process.env.SMTP_PASSWORD ? process.env.SMTP_PASSWORD.length : 0);

        const mailOptions = {
            from: process.env.SMTP_EMAIL,
            to: process.env.SMTP_EMAIL, // Send to self
            subject: 'Test Email Server',
            text: 'This is a test email from the RAHI backend',
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully: ${info.messageId}`);
    } catch (error) {
        console.error('Error sending test email:', error);
    }
};

sendTestEmail();
