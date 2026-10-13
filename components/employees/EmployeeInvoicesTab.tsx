import Link from "next/link";
import { FileText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { LocalDateTime } from "@/components/layout/LocalDateTime";
import { PersonName } from "@/components/layout/PersonName";
import { DatePicker } from "@/components/ui/date-picker";
import { FormSelect } from "@/components/ui/form-select";
import { resolvePage } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  INVOICE_PAGE_SIZE,
  INVOICE_STATUSES,
  employeeInvoiceListHref,
  invoiceListHref,
  invoiceWhere,
  parseInvoiceFilters,
  type InvoiceFilters,
} from "@/lib/invoices";
import { nameLabels } from "@/lib/names";
import { getSalonSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

const COLUMNS = ["invoiceNumber", "service", "amount", "status", "date", "createdBy"] as const;

const linkClass =
  "rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

interface EmployeeInvoicesTabProps {
  employeeId: string;
  searchParams: Record<string, string | string[] | undefined>;
  viewer: Pick<SessionUser, "id" | "role">;
}

/** One employee's invoices, for a viewer the page has checked with `canViewEmployeeInvoices`. */
export async function EmployeeInvoicesTab({ employeeId, searchParams, viewer }: EmployeeInvoicesTabProps) {
  // Only the filters this tab offers; the rest live on /transactions.
  const { status, from, to } = parseInvoiceFilters(searchParams);
  const filters: InvoiceFilters = { ...(status && { status }), ...(from && { from }), ...(to && { to }) };
  const filtered = Object.keys(filters).length > 0;
  const where = invoiceWhere({ ...filters, employee: employeeId }, viewer);
  const clearHref = employeeInvoiceListHref(employeeId, {});

  const [t, tEmployees, locale, { currency }, total] = await Promise.all([
    getTranslations("invoices"),
    getTranslations("employees.invoices"),
    getLocale(),
    getSalonSettings(),
    db.invoice.count({ where }),
  ]);
  const totalPages = Math.ceil(total / INVOICE_PAGE_SIZE);
  const page = resolvePage(searchParams.page, totalPages);

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
            service: { select: { nameEn: true, nameAr: true } },
            createdBy: { select: { id: true, name: true } },
          },
        });

  const price = new Intl.NumberFormat(locale, { style: "currency", currency });
  const serviceName = (service: { nameEn: string; nameAr: string }) => (locale === "ar" ? service.nameAr : service.nameEn);
  const personLabel = nameLabels(invoices.map((invoice) => invoice.createdBy), locale);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{tEmployees("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tEmployees("description")}</p>
        </div>
        <Link href={invoiceListHref({ employee: employeeId })} className={cn(linkClass, "text-sm")}>
          {tEmployees("viewAll")}
        </Link>
      </div>

      <form
        method="get"
        action={`/employees/${employeeId}`}
        aria-label={t("filters.label")}
        className="grid min-w-0 gap-4 rounded-2xl border bg-card p-5 text-card-foreground shadow-card sm:grid-cols-2 lg:grid-cols-4 lg:p-6"
      >
        {/* Keeps the submitted filters on this tab. */}
        <input type="hidden" name="tab" value="invoices" />
        <div className="flex flex-col gap-2 sm:col-span-2">
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
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("filters.apply")}
          </button>
          {filtered && (
            <Link href={clearHref} className={cn(linkClass, "text-sm")}>
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
                <h3 className="text-lg font-semibold">{t("empty.noMatchTitle")}</h3>
                <p className="text-sm text-muted-foreground">{t("empty.noMatch")}</p>
                <Link href={clearHref} className={cn(linkClass, "text-sm")}>
                  {t("filters.clear")}
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">{t("empty.title")}</h3>
                <p className="text-sm text-muted-foreground">{tEmployees("empty")}</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-sm">
                <caption className="sr-only">{tEmployees("title")}</caption>
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
                        <PersonName name={invoice.createdBy.name} label={personLabel.get(invoice.createdBy.id)} />
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
                  <Link href={employeeInvoiceListHref(employeeId, filters, page - 1)} className={linkClass}>
                    {t("pagination.previous")}
                  </Link>
                ) : (
                  <span aria-disabled="true" className="text-muted-foreground">
                    {t("pagination.previous")}
                  </span>
                )}
                <span className="text-muted-foreground">{t("pagination.page", { page, total: totalPages })}</span>
                {page < totalPages ? (
                  <Link href={employeeInvoiceListHref(employeeId, filters, page + 1)} className={linkClass}>
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
    </>
  );
}
