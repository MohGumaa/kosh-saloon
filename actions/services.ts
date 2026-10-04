"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { AuthErrorCode } from "@/actions/auth";
import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { serviceIdSchema, serviceSchema, type ServiceInput } from "@/lib/services";

/** Translation keys under `services.errors`. */
export type ServiceErrorCode = "forbidden" | "not_found" | "invalid_input" | "unexpected";

/** Translation keys under `auth.errors`, as the shared form field shows them. */
export type ServiceFieldErrorCode = Extract<AuthErrorCode, "required" | "invalid_input" | "name_taken">;

export type ServiceField = keyof ServiceInput;

export type ServiceFormState =
  | { success: true; /** The new service, after a create. */ id?: string }
  | {
      success: false;
      error: ServiceErrorCode;
      fieldErrors?: Partial<Record<ServiceField, ServiceFieldErrorCode>>;
      /** The submitted values, so the form can keep them after React resets the inputs. */
      values?: Record<ServiceField, string>;
    }
  | null;

const SERVICE_FIELDS = ["nameEn", "nameAr", "defaultPrice"] as const;

function readForm(formData: FormData): Record<ServiceField, string> {
  const values = {} as Record<ServiceField, string>;
  for (const field of SERVICE_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

function fieldErrorsOf(error: z.ZodError, raw: Record<ServiceField, string>) {
  const fieldErrors: Partial<Record<ServiceField, ServiceFieldErrorCode>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as ServiceField;
    fieldErrors[field] ??= raw[field].trim() === "" ? "required" : "invalid_input";
  }
  return fieldErrors;
}

type TakenErrors = Partial<Record<"nameEn" | "nameAr", ServiceFieldErrorCode>>;

/** The English name is compared without case, the Arabic name exactly. Inactive services count. */
async function takenNames(nameEn: string, nameAr: string, exceptId?: string): Promise<TakenErrors | null> {
  const rows = await db.service.findMany({
    where: {
      OR: [{ nameEn: { equals: nameEn, mode: "insensitive" } }, { nameAr }],
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { nameEn: true, nameAr: true },
  });
  const errors: TakenErrors = {};
  if (rows.some((row) => row.nameEn.toLowerCase() === nameEn.toLowerCase())) errors.nameEn = "name_taken";
  if (rows.some((row) => row.nameAr === nameAr)) errors.nameAr = "name_taken";
  return Object.keys(errors).length > 0 ? errors : null;
}

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

/**
 * Runs a write that stores both names. Returns the taken fields instead when another
 * service holds one, including when two requests pass the check together and the
 * unique index decides.
 */
async function writeUnlessTaken(
  write: () => Promise<unknown>,
  { nameEn, nameAr }: ServiceInput,
  exceptId?: string,
): Promise<TakenErrors | null> {
  const taken = await takenNames(nameEn, nameAr, exceptId);
  if (taken) return taken;
  try {
    await write();
    return null;
  } catch (error) {
    const raced = isUniqueViolation(error) ? await takenNames(nameEn, nameAr, exceptId) : null;
    if (raced) return raced;
    throw error;
  }
}

function revalidateService(id: string) {
  revalidatePath("/services");
  revalidatePath(`/services/${id}`);
}

export async function createService(_prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const { user: actor } = await requireSession();
  const values = readForm(formData);
  let id = "";

  try {
    if (!(await hasPermission(actor, "services.create"))) return { success: false, error: "forbidden", values };

    const parsed = serviceSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: "invalid_input", fieldErrors: fieldErrorsOf(parsed.error, values), values };
    }
    const data = parsed.data;

    const taken = await writeUnlessTaken(
      () =>
        db.$transaction(async (tx) => {
          const service = await tx.service.create({ data, select: { id: true } });
          await recordAudit(
            { userId: actor.id, action: "service.created", entity: "Service", entityId: service.id, newValue: data },
            tx,
          );
          id = service.id;
        }),
      data,
    );
    if (taken) return { success: false, error: "invalid_input", fieldErrors: taken, values };
  } catch (error) {
    console.error("[services] create failed:", error);
    return { success: false, error: "unexpected", values };
  }

  revalidatePath("/services");
  return { success: true, id };
}

export async function updateService(_prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const { user: actor } = await requireSession();
  const values = readForm(formData);
  const reject = (error: ServiceErrorCode): ServiceFormState => ({ success: false, error, values });
  const serviceId = serviceIdSchema.safeParse(formData.get("id"));

  try {
    if (!(await hasPermission(actor, "services.edit"))) return reject("forbidden");
    if (!serviceId.success) return reject("invalid_input");

    const parsed = serviceSchema.safeParse(values);
    if (!parsed.success) {
      return { success: false, error: "invalid_input", fieldErrors: fieldErrorsOf(parsed.error, values), values };
    }
    const next = parsed.data;

    const exists = await db.service.findUnique({ where: { id: serviceId.data }, select: { id: true } });
    if (!exists) return reject("not_found");

    const taken = await writeUnlessTaken(
      () =>
        db.$transaction(async (tx) => {
          const stored = await tx.service.findUnique({
            where: { id: serviceId.data },
            select: { nameEn: true, nameAr: true, defaultPrice: true },
          });
          if (!stored) throw new Error("the service has no stored row");

          // A Decimal: a stored 50 and a submitted "50.00" are the same value.
          const changed = SERVICE_FIELDS.filter((field) =>
            field === "defaultPrice" ? !stored.defaultPrice.equals(next.defaultPrice) : stored[field] !== next[field],
          );
          if (changed.length === 0) return;

          await tx.service.update({
            where: { id: serviceId.data },
            data: Object.fromEntries(changed.map((field) => [field, next[field]])),
          });
          await recordAudit(
            {
              userId: actor.id,
              action: "service.updated",
              entity: "Service",
              entityId: serviceId.data,
              oldValue: Object.fromEntries(changed.map((field) => [field, stored[field].toString()])),
              newValue: Object.fromEntries(changed.map((field) => [field, next[field]])),
            },
            tx,
          );
        }),
      next,
      serviceId.data,
    );
    if (taken) return { success: false, error: "invalid_input", fieldErrors: taken, values };
  } catch (error) {
    console.error("[services] update failed:", error);
    return reject("unexpected");
  }

  revalidateService(serviceId.data);
  return { success: true };
}

const fail = (error: ServiceErrorCode): ServiceFormState => ({ success: false, error });

export async function setServiceActive(_prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const { user: actor } = await requireSession();
  const serviceId = serviceIdSchema.safeParse(formData.get("id"));
  const requested = formData.get("active");

  try {
    if (!(await hasPermission(actor, "services.edit"))) return fail("forbidden");
    if (!serviceId.success || (requested !== "true" && requested !== "false")) return fail("invalid_input");
    const isActive = requested === "true";

    const target = await db.service.findUnique({ where: { id: serviceId.data }, select: { id: true, isActive: true } });
    if (!target) return fail("not_found");

    if (target.isActive !== isActive) {
      await db.$transaction([
        db.service.update({ where: { id: target.id }, data: { isActive } }),
        recordAudit({
          userId: actor.id,
          action: isActive ? "service.activated" : "service.deactivated",
          entity: "Service",
          entityId: target.id,
        }),
      ]);
    }
  } catch (error) {
    console.error("[services] status change failed:", error);
    return fail("unexpected");
  }

  revalidateService(serviceId.data);
  return { success: true };
}
