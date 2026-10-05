"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { AuthErrorCode } from "@/actions/auth";
import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { dateValue, dayOf, expenseIdSchema, expenseSchema, salonToday, type ExpenseInput } from "@/lib/expenses";

/** Translation keys under `expenses.errors`. */
export type ExpenseErrorCode = "forbidden" | "not_found" | "invalid_input" | "unexpected";

/** Translation keys under `auth.errors`, as the shared form field shows them. */
export type ExpenseFieldErrorCode = Extract<AuthErrorCode, "required" | "invalid_input">;

export type ExpenseField = "title" | "description" | "category" | "amount" | "date";

export type ExpenseFormState =
  | { success: true; /** The new expense, after a create. */ id?: string }
  | {
      success: false;
      error: ExpenseErrorCode;
      fieldErrors?: Partial<Record<ExpenseField, ExpenseFieldErrorCode>>;
      /** The submitted values, so the form can keep them after React resets the inputs. */
      values?: Partial<Record<ExpenseField, string>>;
    }
  | null;

const FIELDS = ["title", "description", "category", "amount", "date"] as const;

function readForm(formData: FormData): Record<ExpenseField, string> {
  const values = {} as Record<ExpenseField, string>;
  for (const field of FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

function fieldErrorsOf(error: z.ZodError, raw: Record<ExpenseField, string>) {
  const fieldErrors: Partial<Record<ExpenseField, ExpenseFieldErrorCode>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as ExpenseField;
    fieldErrors[field] ??= raw[field].trim() === "" ? "required" : "invalid_input";
  }
  return fieldErrors;
}

/** The validated input, or the failed form state to return. */
function parse(values: Record<ExpenseField, string>): { data: ExpenseInput } | { failure: ExpenseFormState } {
  const parsed = expenseSchema(salonToday()).safeParse(values);
  if (parsed.success) return { data: parsed.data };
  return {
    failure: { success: false, error: "invalid_input", fieldErrors: fieldErrorsOf(parsed.error, values), values },
  };
}

function revalidateExpense(id: string) {
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
}

export async function createExpense(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const { user: actor } = await requireSession();
  const values = readForm(formData);
  let id = "";

  try {
    if (!(await hasPermission(actor, "expenses.create"))) return { success: false, error: "forbidden", values };

    const parsed = parse(values);
    if ("failure" in parsed) return parsed.failure;
    const data = parsed.data;

    id = await db.$transaction(async (tx) => {
      const expense = await tx.salonExpense.create({
        data: { ...data, date: dateValue(data.date), createdById: actor.id },
        select: { id: true },
      });
      await recordAudit(
        { userId: actor.id, action: "expense.created", entity: "SalonExpense", entityId: expense.id, newValue: data },
        tx,
      );
      return expense.id;
    });
  } catch (error) {
    console.error("[expenses] create failed:", error);
    return { success: false, error: "unexpected", values };
  }

  revalidateExpense(id);
  return { success: true, id };
}

export async function updateExpense(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const { user: actor } = await requireSession();
  const values = readForm(formData);
  const reject = (error: ExpenseErrorCode): ExpenseFormState => ({ success: false, error, values });
  const expenseId = expenseIdSchema.safeParse(formData.get("id"));

  try {
    if (!(await hasPermission(actor, "expenses.edit"))) return reject("forbidden");
    if (!expenseId.success) return reject("invalid_input");

    const parsed = parse(values);
    if ("failure" in parsed) return parsed.failure;
    const next = parsed.data;

    const outcome = await db.$transaction(async (tx): Promise<ExpenseErrorCode | null> => {
      const stored = await tx.salonExpense.findUnique({
        where: { id: expenseId.data },
        select: { title: true, description: true, category: true, amount: true, date: true },
      });
      if (!stored) return "not_found";

      // Stored as the audit log shows them: the amount and the day as strings.
      const before: ExpenseInput = { ...stored, amount: stored.amount.toString(), date: dayOf(stored.date) };
      // A Decimal: a stored 50 and a submitted "50.00" are the same amount.
      const changed = FIELDS.filter((field) =>
        field === "amount" ? !stored.amount.equals(next.amount) : before[field] !== next[field],
      );
      if (changed.length === 0) return null;

      const after = Object.fromEntries(changed.map((field) => [field, next[field]]));
      const { count } = await tx.salonExpense.updateMany({
        where: { id: expenseId.data },
        data: { ...after, ...(changed.includes("date") && { date: dateValue(next.date) }) },
      });
      if (count === 0) return "not_found";

      await recordAudit(
        {
          userId: actor.id,
          action: "expense.updated",
          entity: "SalonExpense",
          entityId: expenseId.data,
          oldValue: Object.fromEntries(changed.map((field) => [field, before[field]])),
          newValue: after,
        },
        tx,
      );
      return null;
    });
    if (outcome) return reject(outcome);
  } catch (error) {
    console.error("[expenses] update failed:", error);
    return reject("unexpected");
  }

  revalidateExpense(expenseId.data);
  return { success: true };
}

const fail = (error: ExpenseErrorCode): ExpenseFormState => ({ success: false, error });

export async function deleteExpense(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const { user: actor } = await requireSession();
  const expenseId = expenseIdSchema.safeParse(formData.get("id"));

  try {
    if (!(await hasPermission(actor, "expenses.delete"))) return fail("forbidden");
    if (!expenseId.success) return fail("invalid_input");

    const outcome = await db.$transaction(async (tx): Promise<ExpenseErrorCode | null> => {
      const stored = await tx.salonExpense.findUnique({
        where: { id: expenseId.data },
        select: { title: true, description: true, category: true, amount: true, date: true, createdById: true },
      });
      if (!stored) return "not_found";

      const { count } = await tx.salonExpense.deleteMany({ where: { id: expenseId.data } });
      if (count === 0) return "not_found";

      // The audit entry is the only record left of a deleted expense, so it keeps all of it.
      await recordAudit(
        {
          userId: actor.id,
          action: "expense.deleted",
          entity: "SalonExpense",
          entityId: expenseId.data,
          oldValue: { ...stored, amount: stored.amount.toString(), date: dayOf(stored.date) },
        },
        tx,
      );
      return null;
    });
    if (outcome) return fail(outcome);
  } catch (error) {
    console.error("[expenses] delete failed:", error);
    return fail("unexpected");
  }

  // Only the list: refreshing the deleted expense's own page would replace it with the
  // not-found page before the form can show its toast and navigate away.
  revalidatePath("/expenses");
  return { success: true };
}
