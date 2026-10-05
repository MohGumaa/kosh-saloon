"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { effectiveSharePercentage, paidRevenueWhere, salonMonth } from "@/lib/earnings";
import { isOwnScope } from "@/lib/invoices";
import { getSalonSettings } from "@/lib/settings";
import {
  SETTLEMENT_TRANSITIONS,
  adjustmentSchema,
  calculateSettlement,
  expensesWhere,
  isSettleableMonth,
  monthOf,
  monthPeriod,
  settlementIdSchema,
  sumAdjustments,
  type SettlementAction,
} from "@/lib/settlements";

/** Translation keys under `settlements.errors`. */
export type SettlementErrorCode = "forbidden" | "not_found" | "invalid_input" | "invalid_state" | "unexpected";

/** The adjustment form's fields; their error codes are `auth.errors` keys, as `FormField` shows them. */
export type AdjustmentField = "amount" | "reason";

export type AdjustmentFieldErrors = Partial<Record<AdjustmentField, "required" | "invalid_input">>;

export type SettlementFormState =
  | {
      success: true;
      /** How many settlements a generate created. */
      created?: number;
      /** Why a generate created nothing: no activity in the month, or everyone is already settled. */
      nothing?: "no_activity" | "already_settled";
    }
  | { success: false; error: SettlementErrorCode; fieldErrors?: AdjustmentFieldErrors }
  | null;

type Tx = Prisma.TransactionClient;
type SettlementValues = ReturnType<typeof calculateSettlement>;

/** The stored values a recalculation replaces. */
const VALUE_FIELDS = [
  "totalRevenue",
  "sharePercentage",
  "employeeShare",
  "totalExpenses",
  "totalAdjustments",
  "finalAmount",
] as const satisfies readonly (keyof SettlementValues)[];

const fail = (error: SettlementErrorCode): SettlementFormState => ({ success: false, error });

/** Thrown inside a transaction to roll back its writes when the settlement moved meanwhile. */
class StaleSettlementError extends Error {}

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

/** A permission, and never a Staff user, whatever they hold. */
async function mayManage(actor: SessionUser, key: (typeof SETTLEMENT_TRANSITIONS)[SettlementAction]["permission"]) {
  return !isOwnScope(actor) && (await hasPermission(actor, key));
}

/** Stored as the audit log shows them: decimals as 2-decimal strings. */
function auditValues(values: SettlementValues) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.toFixed(2)]));
}

/**
 * Claims the employee's pending adjustments from earlier months for this settlement and
 * returns every adjustment it now includes. A claimed adjustment is never released, and
 * the null condition means one cannot land on two settlements.
 */
async function applyAdjustments(tx: Tx, settlement: { id: string; employeeId: string; periodStart: Date }) {
  await tx.settlementAdjustment.updateMany({
    where: {
      employeeId: settlement.employeeId,
      appliedSettlementId: null,
      sourceSettlement: { periodStart: { lt: settlement.periodStart } },
    },
    data: { appliedSettlementId: settlement.id },
  });
  const applied = await tx.settlementAdjustment.findMany({
    where: { appliedSettlementId: settlement.id },
    select: { id: true, amount: true },
    orderBy: { createdAt: "asc" },
  });
  return { ids: applied.map((row) => row.id), total: sumAdjustments(applied.map((row) => row.amount)) };
}

/** Fresh values for one employee's month, read on the transaction client. */
async function freshValues(
  tx: Tx,
  employee: { id: string; sharePercentage: Prisma.Decimal | null },
  month: string,
  salonPercentage: Prisma.Decimal,
  adjustments: Prisma.Decimal,
): Promise<SettlementValues> {
  const [revenue, expenses] = await Promise.all([
    tx.invoice.aggregate({ where: { employeeId: employee.id, ...paidRevenueWhere(month) }, _sum: { amount: true } }),
    tx.employeeExpense.aggregate({ where: { employeeId: employee.id, ...expensesWhere(month) }, _sum: { amount: true } }),
  ]);
  return calculateSettlement({
    paidRevenue: revenue._sum.amount ?? 0,
    sharePercentage: effectiveSharePercentage(employee.sharePercentage, salonPercentage).value,
    expenses: expenses._sum.amount ?? 0,
    adjustments,
  });
}

function revalidateSettlement(id?: string) {
  revalidatePath("/settlements");
  if (id) revalidatePath(`/settlements/${id}`);
}

/**
 * Creates a DRAFT for every user with PAID revenue, employee expenses, or adjustments
 * pending from an earlier month who has none yet for a completed month, and applies those
 * adjustments. Existing settlements are left as they are.
 */
export async function generateSettlements(_prev: SettlementFormState, formData: FormData): Promise<SettlementFormState> {
  const { user: actor } = await requireSession();
  const month = formData.get("month");
  let result: SettlementFormState;

  try {
    if (!(await mayManage(actor, "settlements.create"))) return fail("forbidden");
    if (typeof month !== "string" || !isSettleableMonth(month, salonMonth())) return fail("invalid_input");
    const { periodStart, periodEnd } = monthPeriod(month);

    result = await db.$transaction(async (tx): Promise<SettlementFormState> => {
      const [revenue, expenses, pendingAdjustments] = await Promise.all([
        tx.invoice.groupBy({ by: ["employeeId"], where: paidRevenueWhere(month) }),
        tx.employeeExpense.groupBy({ by: ["employeeId"], where: expensesWhere(month) }),
        // A pending correction is never stranded: its employee gets a settlement to carry it.
        tx.settlementAdjustment.groupBy({
          by: ["employeeId"],
          where: { appliedSettlementId: null, sourceSettlement: { periodStart: { lt: periodStart } } },
        }),
      ]);
      const active = [...new Set([...revenue, ...expenses, ...pendingAdjustments].map((row) => row.employeeId))];
      if (active.length === 0) return { success: true, created: 0, nothing: "no_activity" };

      const existing = await tx.employeeSettlement.findMany({
        where: { periodStart, employeeId: { in: active } },
        select: { employeeId: true },
      });
      const settled = new Set(existing.map((row) => row.employeeId));
      const pending = active.filter((id) => !settled.has(id));
      if (pending.length === 0) return { success: true, created: 0, nothing: "already_settled" };

      const [settings, employees] = await Promise.all([
        getSalonSettings(tx),
        tx.user.findMany({ where: { id: { in: pending } }, select: { id: true, sharePercentage: true } }),
      ]);
      for (const employee of employees) {
        let values = await freshValues(tx, employee, month, settings.employeeSharePercentage, sumAdjustments([]));
        const settlement = await tx.employeeSettlement.create({
          data: { ...values, employeeId: employee.id, periodStart, periodEnd, status: "DRAFT", createdById: actor.id },
          select: { id: true },
        });
        // Adjustments are claimed by settlement id, so they are applied once the row exists.
        const adjustments = await applyAdjustments(tx, { id: settlement.id, employeeId: employee.id, periodStart });
        if (adjustments.ids.length > 0) {
          values = calculateSettlement({
            paidRevenue: values.totalRevenue,
            sharePercentage: values.sharePercentage,
            expenses: values.totalExpenses,
            adjustments: adjustments.total,
          });
          await tx.employeeSettlement.update({ where: { id: settlement.id }, data: values });
        }
        await recordAudit(
          {
            userId: actor.id,
            action: "settlement.generated",
            entity: "EmployeeSettlement",
            entityId: settlement.id,
            newValue: {
              employeeId: employee.id,
              month,
              status: "DRAFT",
              ...auditValues(values),
              ...(adjustments.ids.length > 0 && { appliedAdjustmentIds: adjustments.ids }),
            },
          },
          tx,
        );
      }
      return { success: true, created: employees.length };
    });
  } catch (error) {
    // Another generate for the same month got there first.
    if (isUniqueViolation(error)) return fail("invalid_state");
    console.error("[settlements] generate failed:", error);
    return fail("unexpected");
  }

  revalidateSettlement();
  return result;
}

const AUDIT_ACTION = {
  recalculate: "settlement.recalculated",
  calculate: "settlement.calculated",
  approve: "settlement.approved",
  pay: "settlement.paid",
} as const;

/** One status change, written only while the settlement is still in the status it was read in. */
async function transition(action: SettlementAction, formData: FormData): Promise<SettlementFormState> {
  const { user: actor } = await requireSession();
  const { from, to, permission } = SETTLEMENT_TRANSITIONS[action];
  const id = settlementIdSchema.safeParse(formData.get("id"));

  try {
    if (!(await mayManage(actor, permission))) return fail("forbidden");
    if (!id.success) return fail("invalid_input");

    const outcome = await db.$transaction(async (tx): Promise<SettlementErrorCode | null> => {
      const stored = await tx.employeeSettlement.findUnique({
        where: { id: id.data },
        select: {
          employeeId: true,
          periodStart: true,
          status: true,
          totalRevenue: true,
          sharePercentage: true,
          employeeShare: true,
          totalExpenses: true,
          totalAdjustments: true,
          finalAmount: true,
        },
      });
      if (!stored) return "not_found";
      if (!from.includes(stored.status)) return "invalid_state";
      const month = monthOf(stored.periodStart);

      let data: Prisma.EmployeeSettlementUncheckedUpdateManyInput = { status: to };
      let oldValue: Prisma.InputJsonObject = { status: stored.status };
      let newValue: Prisma.InputJsonObject = { status: to };
      if (action === "recalculate") {
        const [settings, employee, adjustments] = await Promise.all([
          getSalonSettings(tx),
          tx.user.findUniqueOrThrow({ where: { id: stored.employeeId }, select: { id: true, sharePercentage: true } }),
          applyAdjustments(tx, { id: id.data, employeeId: stored.employeeId, periodStart: stored.periodStart }),
        ]);
        const values = await freshValues(tx, employee, month, settings.employeeSharePercentage, adjustments.total);
        const before = Object.fromEntries(VALUE_FIELDS.map((field) => [field, stored[field]])) as SettlementValues;
        data = { ...data, ...values };
        oldValue = { ...oldValue, ...auditValues(before) };
        newValue = {
          ...newValue,
          ...auditValues(values),
          ...(adjustments.ids.length > 0 && { appliedAdjustmentIds: adjustments.ids }),
        };
      } else if (action === "approve") {
        data = { ...data, approvedById: actor.id, approvedAt: new Date() };
      } else if (action === "pay") {
        data = { ...data, paidAt: new Date() };
      }

      // Conditioned on the status just read, so a double submit or a concurrent change cannot apply twice.
      // Thrown rather than returned, so adjustments a recalculation claimed are released too.
      const { count } = await tx.employeeSettlement.updateMany({ where: { id: id.data, status: stored.status }, data });
      if (count === 0) throw new StaleSettlementError();

      await recordAudit(
        {
          userId: actor.id,
          action: AUDIT_ACTION[action],
          entity: "EmployeeSettlement",
          entityId: id.data,
          oldValue: { employeeId: stored.employeeId, month, ...oldValue },
          newValue: { employeeId: stored.employeeId, month, ...newValue },
        },
        tx,
      );
      return null;
    });
    if (outcome) return fail(outcome);
  } catch (error) {
    if (error instanceof StaleSettlementError) return fail("invalid_state");
    console.error(`[settlements] ${action} failed:`, error);
    return fail("unexpected");
  }

  revalidateSettlement(id.data);
  return { success: true };
}

export async function recalculateSettlement(_prev: SettlementFormState, formData: FormData) {
  return transition("recalculate", formData);
}

export async function markSettlementCalculated(_prev: SettlementFormState, formData: FormData) {
  return transition("calculate", formData);
}

export async function approveSettlement(_prev: SettlementFormState, formData: FormData) {
  return transition("approve", formData);
}

export async function markSettlementPaid(_prev: SettlementFormState, formData: FormData) {
  return transition("pay", formData);
}

/**
 * Records a signed correction to a PAID settlement. The paid settlement itself never
 * changes: the employee's next settlement for a later month includes the adjustment.
 */
export async function createSettlementAdjustment(
  _prev: SettlementFormState,
  formData: FormData,
): Promise<SettlementFormState> {
  const { user: actor } = await requireSession();
  const raw = {
    id: String(formData.get("id") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  };
  const parsed = adjustmentSchema.safeParse(raw);

  try {
    if (!(await mayManage(actor, "settlements.mark_paid"))) return fail("forbidden");
    if (!parsed.success) {
      const fieldErrors: AdjustmentFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === "amount" || field === "reason") && !fieldErrors[field]) {
          fieldErrors[field] = raw[field].trim() === "" ? "required" : "invalid_input";
        }
      }
      // A bad id is a tampered form, not something the user can fix in a field.
      return Object.keys(fieldErrors).length > 0
        ? { success: false, error: "invalid_input", fieldErrors }
        : fail("invalid_input");
    }
    const { id, amount, reason } = parsed.data;

    const outcome = await db.$transaction(async (tx): Promise<SettlementErrorCode | null> => {
      const source = await tx.employeeSettlement.findUnique({
        where: { id },
        select: { employeeId: true, periodStart: true, status: true },
      });
      if (!source) return "not_found";
      if (source.status !== "PAID") return "invalid_state";

      // The employee is the paid settlement's, never a submitted value.
      const adjustment = await tx.settlementAdjustment.create({
        data: { employeeId: source.employeeId, amount, reason, sourceSettlementId: id, createdById: actor.id },
        select: { id: true, amount: true },
      });
      await recordAudit(
        {
          userId: actor.id,
          action: "settlement.adjustment_created",
          entity: "SettlementAdjustment",
          entityId: adjustment.id,
          newValue: {
            employeeId: source.employeeId,
            sourceSettlementId: id,
            month: monthOf(source.periodStart),
            amount: adjustment.amount.toFixed(2),
            reason,
          },
        },
        tx,
      );
      return null;
    });
    if (outcome) return fail(outcome);
  } catch (error) {
    console.error("[settlements] adjustment failed:", error);
    return fail("unexpected");
  }

  revalidateSettlement(parsed.data.id);
  return { success: true };
}
