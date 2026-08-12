/**
 * Nodemailer Email Service for Authentication OTP & Clinical Notifications
 * EXCLUSIVELY uses Nodemailer SMTP for all OTP email delivery.
 */
const nodemailer = require('nodemailer');

function createTransporter() {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

async function sendOtpEmail({ to, otpCode, role }) {
  const user = (process.env.SMTP_USER || '').trim();
  const rawFrom = (process.env.SMTP_FROM || '').trim() || (user ? `GramCare AI <${user}>` : 'GramCare AI <no-reply@gramcare.ai>');
  const fromEmail = rawFrom.includes('<') ? rawFrom : `GramCare AI <${rawFrom}>`;

  // Safe Diagnostic Logging (NO PASSWORDS, NO OTP LOGGED)
  console.log(`[EmailService] Nodemailer Config Check: SMTP Configured = ${!!user}, FROM = "${fromEmail}", Recipient = "${to}"`);

  const subject = 'GramCare AI - Email Verification Code';
  const text = `Your GramCare AI verification code is:\n\n${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you did not request this code, ignore this email.`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:#1B6B4A;margin:0;font-size:22px;font-weight:700;">🏥 GramCare AI Clinic</h2>
        <p style="color:#64748B;font-size:13.5px;margin-top:4px;">Virtual Village Clinic &amp; AI Workflow System</p>
      </div>
      <div style="background:#FFFFFF;border-radius:10px;padding:22px;border:1px solid #E2E8F0;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <p style="color:#334155;font-size:14.5px;margin-top:0;line-height:1.5;">Your GramCare AI verification code is:</p>
        <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1B6B4A;margin:22px 0;background:#F0FDF4;padding:18px;border-radius:8px;text-align:center;border:1px solid #DCFCE7;">
          ${otpCode}
        </div>
        <p style="color:#64748B;font-size:13px;line-height:1.5;margin-bottom:0;">This code expires in <strong>10 minutes</strong>.</p>
      </div>
      <p style="color:#94A3B8;font-size:12px;text-align:center;margin-top:20px;">If you did not request this code, please ignore this email.</p>
    </div>
  `;

  const transporter = createTransporter();
  if (!transporter) {
    console.error('[EmailService] SMTP credentials missing in .env file (SMTP_USER or SMTP_PASS).');
    return { success: false, error: 'Unable to send verification email. SMTP configuration is missing.' };
  }

  try {
    const info = await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      text,
      html
    });

    console.log(`[EmailService] Nodemailer Success -> Delivered OTP email to ${to} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EmailService] Nodemailer Error sending to ${to}:`, err.message);
    return { success: false, error: 'Unable to send verification email.' };
  }
}

async function sendEmail({ to, subject, html, text }) {
  const user = (process.env.SMTP_USER || '').trim();
  const rawFrom = (process.env.SMTP_FROM || '').trim() || (user ? `GramCare AI <${user}>` : 'GramCare AI <no-reply@gramcare.ai>');
  const fromEmail = rawFrom.includes('<') ? rawFrom : `GramCare AI <${rawFrom}>`;

  const transporter = createTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({ from: fromEmail, to, subject, text, html });
      console.log(`[EmailService] Nodemailer sent email to ${to} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[EmailService] Nodemailer error sending to ${to}:`, err.message);
    }
  }

  return { success: true };
}

module.exports = {
  sendOtpEmail,
  sendEmail
};
