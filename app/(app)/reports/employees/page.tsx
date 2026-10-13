import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmployeePerformanceDetail } from "@/components/reports/EmployeePerformanceDetail";
import { EmployeePerformanceList } from "@/components/reports/EmployeePerformanceList";
import { ReportPeriodControls } from "@/components/reports/ReportPeriodControls";
import { getPermissions } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { first } from "@/lib/dashboard";
import { dateValue, salonToday } from "@/lib/expenses";
import { employeeReportScope, employeeReportSections, parseRevenueReport, reportHref } from "@/lib/reports";
import { loadEmployeePerformance, loadEmployeePerformanceList } from "@/lib/reports-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("employeeReport");
  return { title: t("title") };
}

const PATH = "/reports/employees";

export default async function EmployeeReportPage({ searchParams }: PageProps<"/reports/employees">) {
  const { user } = await requireSession();
  const permissions = await getPermissions(user);
  const scope = employeeReportScope(user, permissions);
  if (!scope) redirect("/forbidden");

  const today = salonToday();
  const params = await searchParams;
  const range = parseRevenueReport(params, today);
  const sections = employeeReportSections(scope, permissions);
  // Staff and other own-scope viewers only ever see themselves; the URL is not trusted for them.
  const employeeId = scope === "own" ? user.id : first(params.employee)?.trim() || undefined;

  const [t, tPeriod, locale] = await Promise.all([
    getTranslations("employeeReport"),
    getTranslations("reportPeriod"),
    getLocale(),
  ]);
  const [detail, list] = await Promise.all([
    employeeId ? loadEmployeePerformance(employeeId, range, sections) : null,
    employeeId ? null : loadEmployeePerformanceList(range, sections, locale),
  ]);
  if (employeeId && !detail) notFound();

  // Calendar days are stored as UTC midnight, so formatting in UTC names the same day for every viewer.
  const days = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const rangeLabel = days.formatRange(dateValue(range.from), dateValue(range.to));
  const keep = scope === "all" && employeeId ? { employee: employeeId } : undefined;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold lg:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(scope === "own" ? "ownDescription" : "description")}</p>
      </div>

      <ReportPeriodControls path={PATH} range={range} today={today} params={keep} />

      <h2 className="text-lg font-semibold">
        {tPeriod(`periods.${range.period}`)}
        <span className="ms-2 text-sm font-normal text-muted-foreground">{rangeLabel}</span>
      </h2>

      {detail && (
        <EmployeePerformanceDetail
          data={detail}
          range={range}
          locale={locale}
          rangeLabel={rangeLabel}
          showExpenses={sections.expenses}
          backHref={scope === "all" ? reportHref(PATH, range, {}, today) : undefined}
        />
      )}
      {list && (
        <EmployeePerformanceList
          data={list}
          locale={locale}
          rangeLabel={rangeLabel}
          showExpenses={sections.expenses}
          hrefOf={(id) => reportHref(PATH, range, {}, today, { employee: id })}
        />
      )}
    </div>
  );
}
