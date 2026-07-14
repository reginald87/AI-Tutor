const DEV_JWT_FALLBACK = "change-this-to-a-long-random-string-bmu-ai-tutor-2026";

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  // Fail closed in production: a known/default secret would let anyone forge sessions.
  if (isProd && (!secret || secret === DEV_JWT_FALLBACK)) {
    throw new Error(
      "FATAL: JWT_SECRET is not set (or is still the dev default). " +
        "Set a strong, unique JWT_SECRET before running in production."
    );
  }
  return secret || DEV_JWT_FALLBACK;
}

export const CONFIG = {
  // Lazy getter so the fail-closed check only runs at runtime (when a token is
  // actually signed/verified), not during `next build`.
  get jwtSecret(): string {
    return resolveJwtSecret();
  },
  ollamaHost: process.env.OLLAMA_HOST || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.2:latest",
  appName: process.env.NEXT_PUBLIC_APP_NAME || "BMU AI Tutor",
  maxUploadBytes: 15 * 1024 * 1024, // 15 MB
  // Hard cap on document context sent to the model to keep responses fast.
  maxContextChars: 12000,
  // Only email addresses on this domain may register (keeps outsiders out).
  allowedEmailDomain: (process.env.ALLOWED_EMAIL_DOMAIN || "bmu.edu.ng").toLowerCase(),
  // Public base URL used in verification links.
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  // SMTP (Gmail) configuration for sending verification emails.
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: parseInt(process.env.SMTP_PORT || "465", 10),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "BMU AI Tutor <no-reply@bmu.edu.ng>",
};

export const ROLES = {
  STUDENT: "STUDENT",
  ADMIN: "ADMIN",
} as const;
