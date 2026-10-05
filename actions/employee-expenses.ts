"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { AuthErrorCode } from "@/actions/auth";
import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import {
  employeeExpenseIdSchema,
  employeeExpenseSchema,
  type EmployeeExpenseInput,
} from "@/lib/employee-expenses";
import { dateValue, dayOf, salonToday } from "@/lib/expenses";

/** Translation keys under `employeeExpenses.errors`. */
export type EmployeeExpenseErrorCode = "forbidden" | "not_found" | "invalid_input" | "unexpected";

/** Translation keys under `auth.errors`, as the shared form field shows them. */
export type EmployeeExpenseFieldErrorCode = Extract<AuthErrorCode, "required" | "invalid_input">;

export type EmployeeExpenseField = "category" | "amount" | "description" | "date";

export type EmployeeExpenseFormState =
  | { success: true; /** The new deduction, after a create. */ id?: string }
  | {
      success: false;
      error: EmployeeExpenseErrorCode;
      fieldErrors?: Partial<Record<EmployeeExpenseField, EmployeeExpenseFieldErrorCode>>;
      /** The submitted values, so the form can keep them after React resets the inputs. */
      values?: Partial<Record<EmployeeExpenseField, string>>;
    }
  | null;

const FIELDS = ["category", "amount", "description", "date"] as const;

function readForm(formData: FormData): Record<EmployeeExpenseField, string> {
  const values = {} as Record<EmployeeExpenseField, string>;
  for (const field of FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

function fieldErrorsOf(error: z.ZodError, raw: Record<EmployeeExpenseField, string>) {
  const fieldErrors: Partial<Record<EmployeeExpenseField, EmployeeExpenseFieldErrorCode>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as EmployeeExpenseField;
    fieldErrors[field] ??= raw[field].trim() === "" ? "required" : "invalid_input";
  }
  return fieldErrors;
}

/** The validated input, or the failed form state to return. */
function parse(
  values: Record<EmployeeExpenseField, string>,
): { data: EmployeeExpenseInput } | { failure: EmployeeExpenseFormState } {
  const parsed = employeeExpenseSchema(salonToday()).safeParse(values);
  if (parsed.success) return { data: parsed.data };
  return {
    failure: { success: false, error: "invalid_input", fieldErrors: fieldErrorsOf(parsed.error, values), values },
  };
}

function revalidateExpense(employeeId: string, id: string) {
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath(`/employees/${employeeId}/expenses/${id}`);
}

export async function createEmployeeExpense(
  _prev: EmployeeExpenseFormState,
  formData: FormData,
): Promise<EmployeeExpenseFormState> {
  const { user: actor } = await requireSession();
  const values = readForm(formData);
  const reject = (error: EmployeeExpenseErrorCode): EmployeeExpenseFormState => ({ success: false, error, values });
  const employeeId = employeeExpenseIdSchema.safeParse(formData.get("employeeId"));
  let id = "";

  try {
    if (!(await hasPermission(actor, "employee_expenses.create"))) return reject("forbidden");
    if (!employeeId.success) return reject("invalid_input");

    const parsed = parse(values);
    if ("failure" in parsed) return parsed.failure;
    const data = parsed.data;

    const outcome = await db.$transaction(async (tx): Promise<{ id: string } | EmployeeExpenseErrorCode> => {
      // Any user can carry deductions, active or not; the employee only has to exist.
      const employee = await tx.user.findUnique({ where: { id: employeeId.data }, select: { id: true } });
      if (!employee) return "not_found";

      const expense = await tx.employeeExpense.create({
        data: { ...data, employeeId: employee.id, date: dateValue(data.date), createdById: actor.id },
        select: { id: true },
      });
      await recordAudit(
        {
          userId: actor.id,
          action: "employee_expense.created",
          entity: "EmployeeExpense",
          entityId: expense.id,
          newValue: { employeeId: employee.id, ...data },
        },
        tx,
      );
      return expense;
    });
    if (typeof outcome === "string") return reject(outcome);
    id = outcome.id;
  } catch (error) {
    console.error("[employee-expenses] create failed:", error);
    return reject("unexpected");
  }

  revalidateExpense(employeeId.data, id);
  return { success: true, id };
}

export async function updateEmployeeExpense(
  _prev: EmployeeExpenseFormState,
  formData: FormData,
): Promise<EmployeeExpenseFormState> {
  const { user: actor } = await requireSession();
  const values = readForm(formData);
  const reject = (error: EmployeeExpenseErrorCode): EmployeeExpenseFormState => ({ success: false, error, values });
  const expenseId = employeeExpenseIdSchema.safeParse(formData.get("id"));
  let employeeId = "";

  try {
    if (!(await hasPermission(actor, "employee_expenses.edit"))) return reject("forbidden");
    if (!expenseId.success) return reject("invalid_input");

    const parsed = parse(values);
    if ("failure" in parsed) return parsed.failure;
    const next = parsed.data;

    const outcome = await db.$transaction(async (tx): Promise<EmployeeExpenseErrorCode | null> => {
      const stored = await tx.employeeExpense.findUnique({
        where: { id: expenseId.data },
        select: { employeeId: true, category: true, amount: true, description: true, date: true },
      });
      if (!stored) return "not_found";
      employeeId = stored.employeeId;

      // Stored as the audit log shows them: the amount and the day as strings.
      const before: EmployeeExpenseInput = {
        category: stored.category,
        amount: stored.amount.toString(),
        description: stored.description,
        date: dayOf(stored.date),
      };
      // A Decimal: a stored 50 and a submitted "50.00" are the same amount.
      const changed = FIELDS.filter((field) =>
        field === "amount" ? !stored.amount.equals(next.amount) : before[field] !== next[field],
      );
      if (changed.length === 0) return null;

      const after = Object.fromEntries(changed.map((field) => [field, next[field]]));
      // The employee is never written: a deduction stays with the employee it was recorded for.
      const { count } = await tx.employeeExpense.updateMany({
        where: { id: expenseId.data },
        data: { ...after, ...(changed.includes("date") && { date: dateValue(next.date) }) },
      });
      if (count === 0) return "not_found";

      await recordAudit(
        {
          userId: actor.id,
          action: "employee_expense.updated",
          entity: "EmployeeExpense",
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
    console.error("[employee-expenses] update failed:", error);
    return reject("unexpected");
  }

  revalidateExpense(employeeId, expenseId.data);
  return { success: true };
}

const fail = (error: EmployeeExpenseErrorCode): EmployeeExpenseFormState => ({ success: false, error });

export async function deleteEmployeeExpense(
  _prev: EmployeeExpenseFormState,
  formData: FormData,
): Promise<EmployeeExpenseFormState> {
  const { user: actor } = await requireSession();
  const expenseId = employeeExpenseIdSchema.safeParse(formData.get("id"));
  let employeeId = "";

  try {
    if (!(await hasPermission(actor, "employee_expenses.delete"))) return fail("forbidden");
    if (!expenseId.success) return fail("invalid_input");

    const outcome = await db.$transaction(async (tx): Promise<EmployeeExpenseErrorCode | null> => {
      const stored = await tx.employeeExpense.findUnique({
        where: { id: expenseId.data },
        select: { employeeId: true, category: true, amount: true, description: true, date: true, createdById: true },
      });
      if (!stored) return "not_found";
      employeeId = stored.employeeId;

      const { count } = await tx.employeeExpense.deleteMany({ where: { id: expenseId.data } });
      if (count === 0) return "not_found";

      // The audit entry is the only record left of a deleted deduction, so it keeps all of it.
      await recordAudit(
        {
          userId: actor.id,
          action: "employee_expense.deleted",
          entity: "EmployeeExpense",
          entityId: expenseId.data,
          oldValue: { ...stored, amount: stored.amount.toString(), date: dayOf(stored.date) },
        },
        tx,
      );
      return null;
    });
    if (outcome) return fail(outcome);
  } catch (error) {
    console.error("[employee-expenses] delete failed:", error);
    return fail("unexpected");
  }

  // Only the employee page: refreshing the deleted deduction's own page would replace it
  // with the not-found page before the form can show its toast and navigate away.
  revalidatePath(`/employees/${employeeId}`);
  return { success: true };
}
