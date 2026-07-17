import nodemailer, { type Transporter } from "nodemailer";
import { CONFIG } from "./config";

let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (transport) return transport;
  const useSsl = CONFIG.smtpPort === 465;
  transport = nodemailer.createTransport({
    host: CONFIG.smtpHost,
    port: CONFIG.smtpPort,
    secure: useSsl,
    // Port 587 (and other non-465 ports) use STARTTLS — require the upgrade
    // so we never send credentials over a plaintext connection.
    requireTLS: !useSsl,
    auth: CONFIG.smtpUser ? { user: CONFIG.smtpUser, pass: CONFIG.smtpPass } : undefined,
    tls: { rejectUnauthorized: false },
  });
  return transport;
}

export function isMailConfigured(): boolean {
  return Boolean(CONFIG.smtpUser && CONFIG.smtpPass);
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<boolean> {
  const link = `${CONFIG.appUrl}/verify-email?token=${token}`;

  // No SMTP credentials: don't fail registration, but surface the link so a
  // developer/admin can verify the account manually (e.g. from server logs).
  if (!isMailConfigured()) {
    console.warn(
      `\n[mailer] SMTP not configured — verification email NOT sent.\n` +
        `         Account: ${to}\n         Verify link: ${link}\n`
    );
    return false;
  }

  const html = `
  <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto">
    <h2 style="color:#1d4ed8">Welcome to ${CONFIG.appName}</h2>
    <p>Hi ${name},</p>
    <p>Thanks for creating your account. Please confirm your email address to activate it and start using the tutor.</p>
    <p style="margin:24px 0">
      <a href="${link}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Verify my email</a>
    </p>
    <p style="color:#64748b;font-size:13px">This link expires in 24 hours. If you did not create a ${CONFIG.appName} account, you can ignore this email.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="color:#94a3b8;font-size:12px">${CONFIG.appName} · Bayelsa Medical University</p>
  </div>`;

  const text = `Welcome to ${CONFIG.appName}!\n\nHi ${name},\n\nThanks for creating your account. Please confirm your email address by opening this link:\n${link}\n\nThis link expires in 24 hours. If you did not create a ${CONFIG.appName} account, you can ignore this email.\n\n${CONFIG.appName} · Bayelsa Medical University`;

  await getTransport().sendMail({
    from: CONFIG.smtpFrom,
    to,
    replyTo: CONFIG.smtpFrom,
    subject: `Verify your ${CONFIG.appName} account`,
    text,
    html,
  });
  return true;
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<boolean> {
  const link = `${CONFIG.appUrl}/reset-password?token=${token}`;

  if (!isMailConfigured()) {
    console.warn(
      `\n[mailer] SMTP not configured — password reset email NOT sent.\n` +
        `         Account: ${to}\n         Reset link: ${link}\n`
    );
    return false;
  }

  const html = `
  <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto">
    <h2 style="color:#1d4ed8">Reset your ${CONFIG.appName} password</h2>
    <p>Hi ${name},</p>
    <p>We received a request to reset your password. Click below to choose a new one. If you didn't request this, you can ignore the email.</p>
    <p style="margin:24px 0">
      <a href="${link}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Reset my password</a>
    </p>
    <p style="color:#64748b;font-size:13px">This link expires in 1 hour.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="color:#94a3b8;font-size:12px">${CONFIG.appName} · Bayelsa Medical University</p>
  </div>`;

  const text = `Reset your ${CONFIG.appName} password\n\nHi ${name},\n\nWe received a request to reset your password. Open this link to choose a new one:\n${link}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore the email.\n\n${CONFIG.appName} · Bayelsa Medical University`;

  await getTransport().sendMail({
    from: CONFIG.smtpFrom,
    to,
    replyTo: CONFIG.smtpFrom,
    subject: `Reset your ${CONFIG.appName} password`,
    text,
    html,
  });
  return true;
}

export async function sendAdminPasswordResetEmail(
  to: string,
  name: string,
  newPassword: string
): Promise<boolean> {
  if (!isMailConfigured()) {
    console.warn(
      `\n[mailer] SMTP not configured — admin password reset email NOT sent for ${to}.\n`
    );
    return false;
  }

  const html = `
  <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto">
    <h2 style="color:#1d4ed8">Your password was reset</h2>
    <p>Hi ${name},</p>
    <p>An administrator reset your ${CONFIG.appName} password. Your new temporary password is:</p>
    <p style="margin:16px 0;font-size:18px;font-weight:700;letter-spacing:1px;background:#f1f5f9;padding:12px 16px;border-radius:8px;display:inline-block">${newPassword}</p>
    <p>Please log in and change it immediately from your account settings.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="color:#94a3b8;font-size:12px">${CONFIG.appName} · Bayelsa Medical University</p>
  </div>`;

  const text = `Your password was reset\n\nHi ${name},\n\nAn administrator reset your ${CONFIG.appName} password. Your new temporary password is:\n${newPassword}\n\nPlease log in and change it immediately from your account settings.\n\n${CONFIG.appName} · Bayelsa Medical University`;

  await getTransport().sendMail({
    from: CONFIG.smtpFrom,
    to,
    replyTo: CONFIG.smtpFrom,
    subject: `Your ${CONFIG.appName} password was reset`,
    text,
    html,
  });
  return true;
}
