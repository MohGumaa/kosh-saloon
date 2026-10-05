/**
 * Employee management rules and input schemas. No database import, so client
 * forms and tests can use it. The permission for each action is checked separately.
 */
import { z } from "zod";
import { emailSchema, passwordSchema, profileSchema, usernameSchema } from "@/lib/auth/validation";
import { percentageSchema } from "@/lib/settings-validation";

export const ROLES = ["ADMIN", "SUPERVISOR", "STAFF"] as const;

export type Role = (typeof ROLES)[number];

interface Account {
  id: string;
  role: Role;
}

/** An ADMIN manages anyone, themself included; anyone else only another user whose role is STAFF. */
export function canManageEmployee(actor: Account, target: Account): boolean {
  if (actor.role === "ADMIN") return true;
  return target.id !== actor.id && target.role === "STAFF";
}

/**
 * Status and password: never the actor's own account. Their own password changes
 * on /account, which asks for the current one.
 */
export function canManageEmployeeAccess(actor: Account, target: Account): boolean {
  return target.id !== actor.id && canManageEmployee(actor, target);
}

/** Only an ADMIN assigns a role, and never their own, so an active ADMIN always remains. */
export function canChangeEmployeeRole(actor: Account, target: Account): boolean {
  return actor.role === "ADMIN" && target.id !== actor.id;
}

export const employeeIdSchema = z.string().min(1).max(100);

const details = {
  name: profileSchema.shape.name,
  username: usernameSchema,
  email: emailSchema,
  phone: profileSchema.shape.phone,
};

const passwords = { password: passwordSchema, confirmPassword: z.string() };

const passwordsMatch = (data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword;

export const createEmployeeSchema = z
  .object({ ...details, ...passwords, role: z.enum(ROLES) })
  .refine(passwordsMatch, { path: ["confirmPassword"] });

/** Without a role, the stored one is kept. */
export const updateEmployeeSchema = z.object({ ...details, role: z.enum(ROLES).optional() });

export const setEmployeePasswordSchema = z.object(passwords).refine(passwordsMatch, { path: ["confirmPassword"] });

/** The employee's own share percentage, same rules as the global one. Empty clears it (null), so the global one applies. */
export const employeeShareSchema = z.object({
  sharePercentage: z.union([z.string().trim().length(0).transform(() => null), percentageSchema]),
});
