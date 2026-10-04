"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { AuthErrorCode } from "@/actions/auth";
import { recordAudit, type AuditAction } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  canChangeStatus,
  canManageInvoices,
  createInvoiceSchema,
  invoiceIdSchema,
  invoiceSchema,
  invoiceStatusSchema,
  isOwnScope,
  nextInvoiceNumber,
  type InvoiceStatusValue,
} from "@/lib/invoices";

/** Translation keys under `invoices.errors`. */
export type InvoiceErrorCode = "forbidden" | "not_found" | "invalid_input" | "cancelled" | "unexpected";

/** Translation keys under `auth.errors`, as the shared form field shows them. */
export type InvoiceFieldErrorCode = Extract<AuthErrorCode, "required" | "invalid_input" | "not_available">;

export type InvoiceField = "employeeId" | "serviceId" | "amount" | "status";

export type InvoiceFormState =
  | { success: true; /** The new invoice, after a create. */ id?: string }
  | {
      success: false;
      error: InvoiceErrorCode;
      fieldErrors?: Partial<Record<InvoiceField, InvoiceFieldErrorCode>>;
      /** The submitted values, so the form can keep them after React resets the inputs. */
      values?: Partial<Record<InvoiceField, string>>;
    }
  | null;

const CREATE_FIELDS = ["employeeId", "serviceId", "amount", "status"] as const;
const EDIT_FIELDS = ["employeeId", "serviceId", "amount"] as const;

/** A create can collide only on `invoiceNumber`, so each collision gets a fresh number. */
const CREATE_ATTEMPTS = 3;

function readForm<K extends InvoiceField>(formData: FormData, fields: readonly K[]): Record<K, string> {
  const values = {} as Record<K, string>;
  for (const field of fields) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

function fieldErrorsOf(error: z.ZodError, raw: Partial<Record<InvoiceField, string>>) {
  const fieldErrors: Partial<Record<InvoiceField, InvoiceFieldErrorCode>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as InvoiceField;
    fieldErrors[field] ??= (raw[field] ?? "").trim() === "" ? "required" : "invalid_input";
  }
  return fieldErrors;
}

type ChoiceErrors = Partial<Record<"employeeId" | "serviceId", InvoiceFieldErrorCode>>;

/** A newly chosen employee or service must exist and be active. Pass only the ids that changed. */
async function unavailableChoices(choices: { employeeId?: string; serviceId?: string }): Promise<ChoiceErrors | null> {
  const [employee, service] = await Promise.all([
    choices.employeeId
      ? db.user.findUnique({ where: { id: choices.employeeId }, select: { isActive: true } })
      : undefined,
    choices.serviceId
      ? db.service.findUnique({ where: { id: choices.serviceId }, select: { isActive: true } })
      : undefined,
  ]);
  const errors: ChoiceErrors = {};
  if (choices.employeeId && !employee?.isActive) errors.employeeId = "not_available";
  if (choices.serviceId && !service?.isActive) errors.serviceId = "not_available";
  return Object.keys(errors).length > 0 ? errors : null;
}

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

/** Edits and status changes: the permission, and never a Staff user. */
async function mayManage(actor: SessionUser, key: "invoices.edit" | "invoices.change_status") {
  return canManageInvoices(actor) && (await hasPermission(actor, key));
}

function revalidateInvoice(id: string) {
  revalidatePath("/transactions");
  revalidatePath(`/transactions/${id}`);
}

export async function createInvoice(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const { user: actor } = await requireSession();
  const values = readForm(formData, CREATE_FIELDS);
  // Staff invoice only themselves, whatever the form sent.
  if (isOwnScope(actor)) values.employeeId = actor.id;
  let id = "";

  try {
    if (!(await hasPermission(actor, "invoices.create"))) return { success: false, error: "forbidden", values };

    const parsed = createInvoiceSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: "invalid_input", fieldErrors: fieldErrorsOf(parsed.error, values), values };
    }
    const data = parsed.data;

    const unavailable = await unavailableChoices(data);
    if (unavailable) return { success: false, error: "invalid_input", fieldErrors: unavailable, values };

    for (let attempt = 1; ; attempt++) {
      try {
        id = await db.$transaction(async (tx) => {
          const highest = await tx.invoice.findFirst({
            orderBy: { invoiceNumber: "desc" },
            select: { invoiceNumber: true },
          });
          const invoiceNumber = nextInvoiceNumber(highest?.invoiceNumber ?? null);
          const invoice = await tx.invoice.create({
            data: { ...data, invoiceNumber, createdById: actor.id },
            select: { id: true },
          });
          await recordAudit(
            {
              userId: actor.id,
              action: "invoice.created",
              entity: "Invoice",
              entityId: invoice.id,
              newValue: { invoiceNumber, ...data },
            },
            tx,
          );
          return invoice.id;
        });
        break;
      } catch (error) {
        // Another create took the same number first; read the new highest and try again.
        if (attempt < CREATE_ATTEMPTS && isUniqueViolation(error)) continue;
        throw error;
      }
    }
  } catch (error) {
    console.error("[invoices] create failed:", error);
    return { success: false, error: "unexpected", values };
  }

  revalidatePath("/transactions");
  return { success: true, id };
}

export async function updateInvoice(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const { user: actor } = await requireSession();
  const values = readForm(formData, EDIT_FIELDS);
  const reject = (error: InvoiceErrorCode): InvoiceFormState => ({ success: false, error, values });
  const invoiceId = invoiceIdSchema.safeParse(formData.get("id"));

  try {
    if (!(await mayManage(actor, "invoices.edit"))) return reject("forbidden");
    if (!invoiceId.success) return reject("invalid_input");

    const parsed = invoiceSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: "invalid_input", fieldErrors: fieldErrorsOf(parsed.error, values), values };
    }
    const next = parsed.data;

    const current = await db.invoice.findUnique({
      where: { id: invoiceId.data },
      select: { employeeId: true, serviceId: true, status: true },
    });
    if (!current) return reject("not_found");
    if (current.status === "CANCELLED") return reject("cancelled");

    // The invoice may keep an employee or service that has since been deactivated.
    const unavailable = await unavailableChoices({
      employeeId: next.employeeId !== current.employeeId ? next.employeeId : undefined,
      serviceId: next.serviceId !== current.serviceId ? next.serviceId : undefined,
    });
    if (unavailable) return { success: false, error: "invalid_input", fieldErrors: unavailable, values };

    const outcome = await db.$transaction(async (tx): Promise<InvoiceErrorCode | null> => {
      const stored = await tx.invoice.findUnique({
        where: { id: invoiceId.data },
        select: { employeeId: true, serviceId: true, amount: true, status: true },
      });
      if (!stored) return "not_found";
      if (stored.status === "CANCELLED") return "cancelled";

      // A Decimal: a stored 50 and a submitted "50.00" are the same amount.
      const changed = EDIT_FIELDS.filter((field) =>
        field === "amount" ? !stored.amount.equals(next.amount) : stored[field] !== next[field],
      );
      if (changed.length === 0) return null;

      const { count } = await tx.invoice.updateMany({
        where: { id: invoiceId.data, status: { not: "CANCELLED" } },
        data: Object.fromEntries(changed.map((field) => [field, next[field]])),
      });
      if (count === 0) return "cancelled";

      await recordAudit(
        {
          userId: actor.id,
          action: "invoice.updated",
          entity: "Invoice",
          entityId: invoiceId.data,
          oldValue: Object.fromEntries(changed.map((field) => [field, stored[field].toString()])),
          newValue: Object.fromEntries(changed.map((field) => [field, next[field]])),
        },
        tx,
      );
      return null;
    });
    if (outcome) return reject(outcome);
  } catch (error) {
    console.error("[invoices] update failed:", error);
    return reject("unexpected");
  }

  revalidateInvoice(invoiceId.data);
  return { success: true };
}

const STATUS_ACTIONS: Record<InvoiceStatusValue, AuditAction> = {
  PAID: "invoice.paid",
  UNPAID: "invoice.unpaid",
  CANCELLED: "invoice.cancelled",
};

const fail = (error: InvoiceErrorCode): InvoiceFormState => ({ success: false, error });

export async function setInvoiceStatus(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const { user: actor } = await requireSession();
  const invoiceId = invoiceIdSchema.safeParse(formData.get("id"));
  const requested = invoiceStatusSchema.safeParse(formData.get("status"));

  try {
    if (!(await mayManage(actor, "invoices.change_status"))) return fail("forbidden");
    if (!invoiceId.success || !requested.success) return fail("invalid_input");
    const status = requested.data;

    const outcome = await db.$transaction(async (tx): Promise<InvoiceErrorCode | null> => {
      const stored = await tx.invoice.findUnique({ where: { id: invoiceId.data }, select: { status: true } });
      if (!stored) return "not_found";
      if (stored.status === "CANCELLED") return "cancelled";
      if (!canChangeStatus(stored.status, status)) return null;

      const { count } = await tx.invoice.updateMany({
        where: { id: invoiceId.data, status: { not: "CANCELLED" } },
        data: { status },
      });
      if (count === 0) return "cancelled";

      await recordAudit(
        {
          userId: actor.id,
          action: STATUS_ACTIONS[status],
          entity: "Invoice",
          entityId: invoiceId.data,
          oldValue: { status: stored.status },
          newValue: { status },
        },
        tx,
      );
      return null;
    });
    if (outcome) return fail(outcome);
  } catch (error) {
    console.error("[invoices] status change failed:", error);
    return fail("unexpected");
  }

  revalidateInvoice(invoiceId.data);
  return { success: true };
}
