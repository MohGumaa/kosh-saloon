import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Clock,
  FileText,
  Pencil,
  Scissors,
  UserPen,
  UserRound,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { InvoiceEditForm } from "@/components/invoices/InvoiceEditForm";
import type { InvoiceChoice, ServiceChoice } from "@/components/invoices/InvoiceFields";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { InvoiceStatusForm } from "@/components/invoices/InvoiceStatusForm";
import { LocalDateTime } from "@/components/layout/LocalDateTime";
import { Detail, Panel } from "@/components/layout/Panel";
import { requirePermission } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { canManageInvoices, isOwnScope } from "@/lib/invoices";
import { getSalonSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

// The number is not looked up for the title, so a title never reveals an invoice outside the viewer's scope.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invoices");
  return { title: t("title") };
}

export default async function InvoicePage({ params }: PageProps<"/transactions/[id]">) {
  const { user, permissions } = await requirePermission("invoices.view");
  const { id } = await params;
  const [t, locale, { currency }, invoice] = await Promise.all([
    getTranslations("invoices"),
    getLocale(),
    getSalonSettings(),
    db.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        invoiceNumber: true,
        employeeId: true,
        serviceId: true,
        amount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { name: true, isActive: true } },
        service: { select: { nameEn: true, nameAr: true, defaultPrice: true, isActive: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);
  // Outside a Staff user's own invoices reads the same as missing, so nothing is revealed.
  if (!invoice || (isOwnScope(user) && invoice.employeeId !== user.id)) notFound();

  const open = invoice.status !== "CANCELLED";
  const canEdit = open && canManageInvoices(user) && permissions.has("invoices.edit");
  // Shown for a cancelled invoice too, so the form that cancelled it stays mounted to show its toast.
  const showStatusPanel = canManageInvoices(user) && permissions.has("invoices.change_status");
  const serviceName = (service: { nameEn: string; nameAr: string }) => (locale === "ar" ? service.nameAr : service.nameEn);
  const price = new Intl.NumberFormat(locale, { style: "currency", currency });

  let employees: InvoiceChoice[] = [];
  let services: ServiceChoice[] = [];
  if (canEdit) {
    const [activeEmployees, activeServices] = await Promise.all([
      db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.service.findMany({
        where: { isActive: true },
        orderBy: { nameEn: "asc" },
        select: { id: true, nameEn: true, nameAr: true, defaultPrice: true },
      }),
    ]);
    employees = activeEmployees.map((employee) => ({ ...employee, isActive: true }));
    services = activeServices.map((service) => ({
      id: service.id,
      name: serviceName(service),
      defaultPrice: service.defaultPrice.toString(),
      isActive: true,
    }));
    // The invoice keeps its own employee and service even after they are deactivated.
    if (!invoice.employee.isActive) {
      employees.push({ id: invoice.employeeId, name: invoice.employee.name, isActive: false });
    }
    if (!invoice.service.isActive) {
      services.push({
        id: invoice.serviceId,
        name: serviceName(invoice.service),
        defaultPrice: invoice.service.defaultPrice.toString(),
        isActive: false,
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link
        href="/transactions"
        className="flex items-center gap-2 self-start rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        {t("back")}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold lg:text-3xl">
          <span dir="ltr">{invoice.invoiceNumber}</span>
        </h1>
        <InvoiceStatusBadge status={invoice.status} label={t(`statuses.${invoice.status}`)} />
      </div>

      {!open && !showStatusPanel && (
        <p className="rounded-lg border bg-muted/50 px-4 py-3 text-sm">{t("statusForm.cancelledDescription")}</p>
      )}

      <Panel icon={FileText} title={t("detail.title")} description={t("detail.description")}>
        <dl className="-my-4 grid gap-x-8 sm:grid-cols-2">
          <Detail icon={UserRound} label={t("detail.employee")}>
            <span dir="auto">{invoice.employee.name}</span>
          </Detail>
          <Detail icon={Scissors} label={t("detail.service")}>
            <span dir="auto">{serviceName(invoice.service)}</span>
          </Detail>
          <Detail icon={Banknote} label={t("detail.amount")}>
            <span dir="ltr" className={cn("tabular-nums", !open && "line-through")}>
              {price.format(invoice.amount.toNumber())}
            </span>
          </Detail>
          <Detail icon={CircleDollarSign} label={t("detail.status")}>
            {t(`statuses.${invoice.status}`)}
          </Detail>
          <Detail icon={CalendarDays} label={t("detail.date")}>
            <LocalDateTime iso={invoice.createdAt.toISOString()} timeStyle="short" />
          </Detail>
          <Detail icon={UserPen} label={t("detail.createdBy")}>
            <span dir="auto">{invoice.createdBy.name}</span>
          </Detail>
          <Detail icon={Clock} label={t("detail.updatedAt")}>
            <LocalDateTime iso={invoice.updatedAt.toISOString()} timeStyle="short" />
          </Detail>
        </dl>
      </Panel>

      {canEdit && (
        <Panel icon={Pencil} title={t("edit.title")} description={t("edit.description")}>
          <InvoiceEditForm
            id={invoice.id}
            values={{
              employeeId: invoice.employeeId,
              serviceId: invoice.serviceId,
              amount: invoice.amount.toString(),
            }}
            employees={employees}
            services={services}
            currency={currency}
          />
        </Panel>
      )}

      {showStatusPanel && (
        <Panel
          icon={CircleDollarSign}
          title={t("statusForm.title")}
          description={t(open ? "statusForm.description" : "statusForm.finalDescription")}
        >
          <InvoiceStatusForm id={invoice.id} status={invoice.status} />
        </Panel>
      )}
    </div>
  );
}
