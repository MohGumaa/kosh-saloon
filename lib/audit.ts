import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/** Every action the log can hold. Each feature adds its own; labels live under `audit.actions`. */
export const AUDIT_ACTIONS = [
  "auth.login",
  "auth.logout",
  "auth.password_changed",
  "auth.password_reset",
  "user.profile_updated",
  "permissions.updated",
  "settings.updated",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Prisma model names an entry can point at; labels live under `audit.entities`. */
export const AUDIT_ENTITIES = ["User", "SalonSettings"] as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export interface AuditEntry {
  /** The acting user: from the server session or the account the server just verified, never from form data. */
  userId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  /** Never a password, hash, or token. */
  oldValue?: Prisma.InputJsonObject;
  newValue?: Prisma.InputJsonObject;
}

/**
 * Returns the insert without awaiting it, so it can go in a `db.$transaction([...])`
 * array next to the change it describes. Not `async`: that would wrap the Prisma
 * operation in a plain promise, which a transaction array rejects.
 */
export function recordAudit(entry: AuditEntry, client: Pick<typeof db, "auditLog"> = db) {
  return client.auditLog.create({ data: entry });
}

export const AUDIT_PAGE_SIZE = 50;

/** The page to show for a `?page` value: 1 when it is missing or invalid, the last page when past the end. */
export function resolvePage(raw: string | string[] | undefined, totalPages: number): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const page = value && /^\d+$/.test(value) ? Number(value) : 1;
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

export interface AuditChange {
  field: string;
  before: string | null;
  after: string | null;
}

function fieldsOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function displayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(", ");
  return JSON.stringify(value);
}

/** One item per field in either value, the old value's fields first. */
export function auditChanges(oldValue: unknown, newValue: unknown): AuditChange[] {
  const before = fieldsOf(oldValue);
  const after = fieldsOf(newValue);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].map((field) => ({
    field,
    before: displayValue(before[field]),
    after: displayValue(after[field]),
  }));
}
