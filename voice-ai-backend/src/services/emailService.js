let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.log('[EmailService] Nodemailer optional module notice: using dev logger fallback.');
}

/**
 * Nodemailer Email Service for Offline Assistant Notifications & Patient Reminder Requests
 */
let transporter = null;

function getTransporter() {
  if (!transporter && nodemailer) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';

    if (user && pass) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });
    }
  }
  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  try {
    const activeTransporter = getTransporter();
    if (activeTransporter) {
      const info = await activeTransporter.sendMail({
        from: `"GramCare AI Clinic" <${process.env.SMTP_USER || 'no-reply@gramcare.ai'}>`,
        to,
        subject,
        text,
        html
      });
      console.log(`[EmailService] Sent email to ${to}: messageId ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } else {
      console.log(`[EmailService - DEV LOG ONLY] Email to <${to}> | Subject: "${subject}" | Content: ${text || html}`);
      return { success: true, devMode: true };
    }
  } catch (err) {
    console.error(`[EmailService] Failed to send email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendEmail
};
