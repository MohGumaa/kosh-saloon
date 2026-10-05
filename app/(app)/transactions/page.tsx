import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { LocalDateTime } from "@/components/layout/LocalDateTime";
import { DatePicker } from "@/components/ui/date-picker";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { resolvePage } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import {
  INVOICE_PAGE_SIZE,
  INVOICE_STATUSES,
  invoiceListHref,
  invoiceWhere,
  isOwnScope,
  parseInvoiceFilters,
} from "@/lib/invoices";
import { getSalonSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invoices");
  return { title: t("title") };
}

const COLUMNS = ["invoiceNumber", "employee", "service", "amount", "status", "date", "createdBy"] as const;

const linkClass =
  "rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

const controlClass = "h-11 rounded-xl px-3 md:text-sm";

export default async function InvoicesPage({ searchParams }: PageProps<"/transactions">) {
  const { user, permissions } = await requirePermission("invoices.view");
  const ownOnly = isOwnScope(user);
  const canCreate = permissions.has("invoices.create");

  const params = await searchParams;
  const filters = parseInvoiceFilters(params);
  // Staff always see their own invoices, so an employee filter means nothing for them.
  if (ownOnly) delete filters.employee;
  const filtered = Object.keys(filters).length > 0;
  const where = invoiceWhere(filters, user);

  const [t, locale, { currency }, total, employees, services] = await Promise.all([
    getTranslations("invoices"),
    getLocale(),
    getSalonSettings(),
    db.invoice.count({ where }),
    ownOnly ? [] : db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.service.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameAr: true } }),
  ]);
  const totalPages = Math.ceil(total / INVOICE_PAGE_SIZE);
  const page = resolvePage(params.page, totalPages);

  const invoices =
    total === 0
      ? []
      : await db.invoice.findMany({
          where,
          // The id breaks ties, so invoices saved in the same millisecond keep one order across pages.
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * INVOICE_PAGE_SIZE,
          take: INVOICE_PAGE_SIZE,
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            status: true,
            createdAt: true,
            employee: { select: { name: true } },
            service: { select: { nameEn: true, nameAr: true } },
            createdBy: { select: { name: true } },
          },
        });

  const price = new Intl.NumberFormat(locale, { style: "currency", currency });
  const serviceName = (service: { nameEn: string; nameAr: string }) => (locale === "ar" ? service.nameAr : service.nameEn);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {canCreate && (
          <Link
            href="/transactions/new"
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus aria-hidden className="size-4" />
            {t("new")}
          </Link>
        )}
      </div>

      <form
        method="get"
        action="/transactions"
        aria-label={t("filters.label")}
        className="grid min-w-0 gap-4 rounded-2xl border bg-card p-5 text-card-foreground shadow-card sm:grid-cols-2 lg:grid-cols-4 lg:p-6"
      >
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="filter-q" className="text-sm font-medium">
            {t("filters.q")}
          </label>
          <Input
            id="filter-q"
            name="q"
            type="search"
            maxLength={100}
            dir="auto"
            defaultValue={filters.q}
            placeholder={t("filters.qPlaceholder")}
            className={controlClass}
          />
        </div>
        {!ownOnly && (
          <div className="flex flex-col gap-2">
            <label htmlFor="filter-employee" className="text-sm font-medium">
              {t("filters.employee")}
            </label>
            <FormSelect
              id="filter-employee"
              name="employee"
              defaultValue={filters.employee ?? ""}
              options={[
                { value: "", label: t("filters.all") },
                ...employees.map((employee) => ({ value: employee.id, label: employee.name })),
              ]}
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor="filter-service" className="text-sm font-medium">
            {t("filters.service")}
          </label>
          <FormSelect
            id="filter-service"
            name="service"
            defaultValue={filters.service ?? ""}
            options={[
              { value: "", label: t("filters.all") },
              ...services.map((service) => ({ value: service.id, label: serviceName(service) })),
            ]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="filter-status" className="text-sm font-medium">
            {t("filters.status")}
          </label>
          <FormSelect
            id="filter-status"
            name="status"
            defaultValue={filters.status ?? ""}
            options={[
              { value: "", label: t("filters.all") },
              ...INVOICE_STATUSES.map((status) => ({ value: status, label: t(`statuses.${status}`) })),
            ]}
          />
        </div>
        {(["from", "to"] as const).map((key) => (
          <div key={key} className="flex flex-col gap-2">
            <label htmlFor={`filter-${key}`} className="text-sm font-medium">
              {t(`filters.${key}`)}
            </label>
            <DatePicker id={`filter-${key}`} name={key} defaultValue={filters[key]} clearable />
          </div>
        ))}
        {(["min", "max"] as const).map((key) => (
          <div key={key} className="flex flex-col gap-2">
            <label htmlFor={`filter-${key}`} className="text-sm font-medium">
              {t(`filters.${key}`)}
            </label>
            <Input
              id={`filter-${key}`}
              name={key}
              inputMode="decimal"
              maxLength={11}
              dir="ltr"
              defaultValue={filters[key]}
              className={controlClass}
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("filters.apply")}
          </button>
          {filtered && (
            <Link href="/transactions" className={cn(linkClass, "text-sm")}>
              {t("filters.clear")}
            </Link>
          )}
        </div>
      </form>

      {/* min-w-0 lets the card shrink below the table, so the table scrolls instead of widening the page. */}
      <section className="min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <FileText aria-hidden className="size-5" />
            </span>
            {filtered ? (
              <>
                <h2 className="text-lg font-semibold">{t("empty.noMatchTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("empty.noMatch")}</p>
                <Link href="/transactions" className={cn(linkClass, "text-sm")}>
                  {t("filters.clear")}
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
                <p className="text-sm text-muted-foreground">{t(canCreate ? "empty.create" : "empty.view")}</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-4xl text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    {COLUMNS.map((column) => (
                      <th key={column} scope="col" className="px-3 py-2.5 text-start font-medium">
                        {t(`columns.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <th scope="row" className="px-3 py-3 text-start font-medium whitespace-nowrap">
                        <Link href={`/transactions/${invoice.id}`} className={linkClass} dir="ltr">
                          {invoice.invoiceNumber}
                        </Link>
                      </th>
                      <td className="px-3 py-3">
                        <span dir="auto" className="break-words">
                          {invoice.employee.name}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span dir="auto" className="break-words">
                          {serviceName(invoice.service)}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                        <span dir="ltr" className={cn(invoice.status === "CANCELLED" && "line-through")}>
                          {price.format(invoice.amount.toNumber())}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <InvoiceStatusBadge status={invoice.status} label={t(`statuses.${invoice.status}`)} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <LocalDateTime iso={invoice.createdAt.toISOString()} timeStyle="short" />
                      </td>
                      <td className="px-3 py-3">
                        <span dir="auto" className="break-words">
                          {invoice.createdBy.name}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav
                aria-label={t("pagination.label")}
                className="mt-4 flex items-center justify-between gap-4 border-t pt-4 text-sm"
              >
                {page > 1 ? (
                  <Link href={invoiceListHref(filters, page - 1)} className={linkClass}>
                    {t("pagination.previous")}
                  </Link>
                ) : (
                  <span aria-disabled="true" className="text-muted-foreground">
                    {t("pagination.previous")}
                  </span>
                )}
                <span className="text-muted-foreground">{t("pagination.page", { page, total: totalPages })}</span>
                {page < totalPages ? (
                  <Link href={invoiceListHref(filters, page + 1)} className={linkClass}>
                    {t("pagination.next")}
                  </Link>
                ) : (
                  <span aria-disabled="true" className="text-muted-foreground">
                    {t("pagination.next")}
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}
