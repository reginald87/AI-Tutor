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

  await getTransport().sendMail({
    from: CONFIG.smtpFrom,
    to,
    subject: `Verify your ${CONFIG.appName} account`,
    html,
  });
  return true;
}
