import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { CONFIG, ROLES } from "./config";

const COOKIE_NAME = "bmu_session";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const secret = new TextEncoder().encode(CONFIG.jwtSecret);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = new TextEncoder().encode(CONFIG.jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export function getSessionToken(): string | undefined {
  return cookies().get(COOKIE_NAME)?.value;
}

export async function getCurrentUser() {
  const token = getSessionToken();
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      matricNumber: true,
      department: true,
      faculty: true,
      program: true,
      level: true,
      verified: true,
      rewardPoints: true,
      promptsPerDay: true,
      promptsPerWeek: true,
      dailyUsed: true,
      weeklyUsed: true,
      dailyResetAt: true,
      weeklyResetAt: true,
    },
  });
  return user;
}

export function requireUser() {
  return getCurrentUser();
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.ADMIN) return null;
  return user;
}

/**
 * Returns the current user only if their account is verified. Used to gate
 * access to AI features (chat, document upload, quizzes) until the user has
 * confirmed their email (or been verified by an admin).
 */
export async function requireVerifiedUser() {
  const user = await getCurrentUser();
  if (!user || !user.verified) return null;
  return user;
}
