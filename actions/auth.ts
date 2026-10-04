"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { z } from "zod";
import { db } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { recordAudit } from "@/lib/audit";
import { getCurrentSession, requireSession } from "@/lib/auth/current-user";
import { loginNotificationEmail, passwordResetEmail } from "@/lib/auth/emails";
import { hashPassword, verifyDummyPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  deleteCurrentSession,
  deleteExpiredSessions,
  generateToken,
  hashToken,
} from "@/lib/auth/session";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  identifierWhere,
  loginSchema,
  resetPasswordSchema,
  safeRedirectPath,
} from "@/lib/auth/validation";
import {
  LOGIN_IDENTIFIER_LIMIT,
  LOGIN_IP_LIMIT,
  RESET_IDENTIFIER_LIMIT,
  RESET_IP_LIMIT,
  clearAttempts,
  consumeAttempt,
  deleteExpiredRateLimits,
  refundAttempt,
} from "@/lib/rate-limit";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Translation keys under `auth.errors`. */
export type AuthErrorCode =
  | "invalid_credentials"
  | "inactive"
  | "rate_limited"
  | "invalid_input"
  | "invalid_token"
  | "wrong_current_password"
  | "password_mismatch"
  | "password_length"
  | "username_taken"
  | "email_taken"
  | "required"
  | "unexpected";

interface AuthFailure {
  success: false;
  error: AuthErrorCode;
  fieldErrors?: Partial<Record<string, AuthErrorCode>>;
  /** The submitted identifier, so the form can keep it after React resets the inputs. */
  identifier?: string;
}

export type AuthFormState = { success: true } | AuthFailure | null;

const PASSWORD_FIELDS = new Set(["password", "newPassword"]);

function readForm<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  const values = {} as Record<K, string>;
  for (const key of keys) {
    const value = formData.get(key);
    values[key] = typeof value === "string" ? value : "";
  }
  return values;
}

function invalid(error: z.ZodError, raw: Record<string, string>): AuthFailure {
  const fieldErrors: Partial<Record<string, AuthErrorCode>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    if (fieldErrors[field]) continue;
    if (raw[field]?.trim() === "") fieldErrors[field] = "required";
    else if (issue.code === "custom") fieldErrors[field] = "password_mismatch";
    else if (PASSWORD_FIELDS.has(field)) fieldErrors[field] = "password_length";
    else fieldErrors[field] = "invalid_input";
  }
  return { success: false, error: "invalid_input", fieldErrors };
}

async function requestContext() {
  const headerList = await headers();
  return {
    ipAddress: headerList.get("x-forwarded-for")?.split(",")[0].trim() || "unknown",
    userAgent: headerList.get("user-agent")?.slice(0, 300) || "unknown",
  };
}

/** Runs after the response so email and cleanup never slow down or fail the request. */
function afterResponse(label: string, task: () => Promise<void>) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[auth] ${label} failed:`, error instanceof Error ? error.message : error);
    }
  });
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData, ["identifier", "password", "next"] as const);
  const fail = (error: AuthErrorCode): AuthFailure => ({ success: false, error, identifier: raw.identifier });
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ...invalid(parsed.error, raw), identifier: raw.identifier };
  const { identifier, password } = parsed.data;

  try {
    const { ipAddress, userAgent } = await requestContext();
    const identifierKey = `login:id:${identifier}`;
    const ipKey = `login:ip:${ipAddress}`;

    // Counted before the password check so parallel guesses cannot slip past the limit.
    // IP first: a limited client then creates no further identifier counters.
    if (
      !(await consumeAttempt(ipKey, LOGIN_IP_LIMIT)) ||
      !(await consumeAttempt(identifierKey, LOGIN_IDENTIFIER_LIMIT))
    ) {
      return fail("rate_limited");
    }

    const user = await db.user.findUnique({
      where: identifierWhere(identifier),
      select: { id: true, name: true, email: true, language: true, isActive: true, passwordHash: true },
    });

    const passwordOk = user
      ? await verifyPassword(password, user.passwordHash)
      : (await verifyDummyPassword(password), false);

    if (!user || !passwordOk) return fail("invalid_credentials");

    // Only revealed after the correct password, so it does not leak account status to guessers.
    if (!user.isActive) return fail("inactive");

    // Limits count failures: a successful sign-in clears its identifier and returns its IP attempt.
    await clearAttempts(identifierKey);
    await refundAttempt(ipKey);
    const at = new Date();
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { lastLoginAt: at } }),
      recordAudit({ userId: user.id, action: "auth.login", entity: "User", entityId: user.id }),
    ]);
    await createSession(user.id);

    afterResponse("login notification email", () =>
      sendEmail({
        to: user.email,
        ...loginNotificationEmail({
          name: user.name,
          language: user.language,
          at,
          ipAddress,
          userAgent,
          forgotPasswordUrl: appUrl("/forgot-password"),
        }),
      }),
    );
    afterResponse("expired row cleanup", async () => {
      await deleteExpiredRateLimits();
      await deleteExpiredSessions();
    });
  } catch (error) {
    console.error("[auth] login failed:", error);
    return fail("unexpected");
  }

  redirect(safeRedirectPath(raw.next));
}

export async function logout(): Promise<void> {
  const session = await getCurrentSession();
  if (session) {
    const { id } = session.user;
    try {
      await recordAudit({ userId: id, action: "auth.logout", entity: "User", entityId: id });
    } catch (error) {
      // A failed audit entry must never keep someone signed in.
      console.error("[auth] logout audit entry failed:", error);
    }
  }
  await deleteCurrentSession();
  redirect("/login");
}

/** Always reports success so the response never reveals whether an account exists. */
export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData, ["identifier"] as const);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { ...invalid(parsed.error, raw), identifier: raw.identifier };
  const { identifier } = parsed.data;

  try {
    const { ipAddress } = await requestContext();
    const identifierKey = `reset:id:${identifier}`;
    const ipKey = `reset:ip:${ipAddress}`;
    // IP first: a limited client then creates no further identifier counters.
    if (
      !(await consumeAttempt(ipKey, RESET_IP_LIMIT)) ||
      !(await consumeAttempt(identifierKey, RESET_IDENTIFIER_LIMIT))
    ) {
      return { success: true };
    }

    const user = await db.user.findUnique({
      where: identifierWhere(identifier),
      select: { id: true, name: true, email: true, language: true, isActive: true },
    });
    if (!user?.isActive) return { success: true };

    // The token is written after the response too, so active accounts do not answer more slowly.
    afterResponse("password reset email", async () => {
      const token = generateToken();
      await db.$transaction([
        db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
        db.passwordResetToken.create({
          data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
        }),
      ]);
      await sendEmail({
        to: user.email,
        ...passwordResetEmail({
          name: user.name,
          language: user.language,
          resetUrl: appUrl(`/reset-password?token=${encodeURIComponent(token)}`),
        }),
      });
    });
    return { success: true };
  } catch (error) {
    console.error("[auth] password reset request failed:", error);
    return { success: false, error: "unexpected" };
  }
}

export async function resetPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData, ["token", "password", "confirmPassword"] as const);
  if (!raw.token) return { success: false, error: "invalid_token" };
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    // The token is a hidden field, so a malformed one gets the invalid-link message, not a field error.
    if (parsed.error.issues.some((issue) => issue.path[0] === "token")) return { success: false, error: "invalid_token" };
    return invalid(parsed.error, raw);
  }

  try {
    const record = await db.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(parsed.data.token) },
      select: { id: true, userId: true, expiresAt: true, user: { select: { isActive: true } } },
    });
    if (!record || record.expiresAt <= new Date() || !record.user.isActive) {
      if (record) await db.passwordResetToken.deleteMany({ where: { id: record.id } });
      return { success: false, error: "invalid_token" };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await db.$transaction([
      db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      db.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
      db.session.deleteMany({ where: { userId: record.userId } }),
      recordAudit({ userId: record.userId, action: "auth.password_reset", entity: "User", entityId: record.userId }),
    ]);
  } catch (error) {
    console.error("[auth] password reset failed:", error);
    return { success: false, error: "unexpected" };
  }

  redirect("/login?reset=1");
}

/** Keeps the current session and signs the user out everywhere else. */
export async function changePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { sessionId, user } = await requireSession();
  const raw = readForm(formData, ["currentPassword", "newPassword", "confirmPassword"] as const);
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error, raw);

  try {
    // Counted before the password check, so a signed-in session cannot guess the current password without limit.
    const attemptKey = `password:user:${user.id}`;
    if (!(await consumeAttempt(attemptKey, LOGIN_IDENTIFIER_LIMIT))) return { success: false, error: "rate_limited" };

    const stored = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!stored || !(await verifyPassword(parsed.data.currentPassword, stored.passwordHash))) {
      return {
        success: false,
        error: "wrong_current_password",
        fieldErrors: { currentPassword: "wrong_current_password" },
      };
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
      db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      db.session.deleteMany({ where: { userId: user.id, id: { not: sessionId } } }),
      recordAudit({ userId: user.id, action: "auth.password_changed", entity: "User", entityId: user.id }),
    ]);
    // After the response: a failed cleanup must not report a completed change as an error.
    afterResponse("password attempt cleanup", () => clearAttempts(attemptKey));
    return { success: true };
  } catch (error) {
    console.error("[auth] password change failed:", error);
    return { success: false, error: "unexpected" };
  }
}
