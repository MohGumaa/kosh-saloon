import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Hex SHA-256; only this is stored for session and reset tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SUPERVISOR" | "STAFF";
  language: "EN" | "AR";
  image: string | null;
}

export interface ValidSession {
  sessionId: string;
  user: SessionUser;
}

/**
 * Resolves a raw cookie token to its session and active user. Expired sessions
 * and sessions of inactive users are deleted and rejected.
 */
export async function validateSessionToken(token: string): Promise<ValidSession | null> {
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: { id: true, name: true, email: true, role: true, language: true, image: true, isActive: true },
      },
    },
  });
  if (!session) return null;

  if (session.expiresAt <= new Date() || !session.user.isActive) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  const { id, name, email, role, language, image } = session.user;
  return { sessionId: session.id, user: { id, name, email, role, language, image } };
}

/** Creates a session row and sets the cookie. Call only from a Server Action or Route Handler. */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Deletes the current session row and cookie. Call only from a Server Action or Route Handler. */
export async function deleteCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}

/** Removes sessions past their expiry; validation only deletes one when its cookie is presented again. */
export async function deleteExpiredSessions(): Promise<void> {
  await db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
}
