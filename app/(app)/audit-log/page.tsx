import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LocalDateTime } from "@/components/layout/LocalDateTime";
import { AUDIT_PAGE_SIZE, auditChanges, resolvePage } from "@/lib/audit";
import { requireSession } from "@/lib/auth/current-user";
import { db } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("audit");
  return { title: t("title") };
}

const COLUMNS = ["time", "user", "action", "record", "changes"] as const;

const pageLinkClass =
  "rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

const pageHref = (page: number) => (page === 1 ? "/audit-log" : `/audit-log?page=${page}`);

export default async function AuditLogPage({ searchParams }: PageProps<"/audit-log">) {
  // ADMIN only, by role: no permission grants this page. Checked before any audit data is read.
  const { user } = await requireSession();
  if (user.role !== "ADMIN") redirect("/forbidden");

  const [t, params, total] = await Promise.all([getTranslations("audit"), searchParams, db.auditLog.count()]);
  const totalPages = Math.ceil(total / AUDIT_PAGE_SIZE);
  const page = resolvePage(params.page, totalPages);

  const entries =
    total === 0
      ? []
      : await db.auditLog.findMany({
          // The id breaks ties, so entries saved in the same millisecond keep one order across pages.
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * AUDIT_PAGE_SIZE,
          take: AUDIT_PAGE_SIZE,
          select: {
            id: true,
            action: true,
            entity: true,
            entityId: true,
            oldValue: true,
            newValue: true,
            createdAt: true,
            user: { select: { name: true, username: true } },
          },
        });

  const userIds = [...new Set(entries.filter((entry) => entry.entity === "User").map((entry) => entry.entityId))];
  const users =
    userIds.length === 0
      ? []
      : await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const userNames = new Map(users.map((row) => [row.id, row.name]));

  // An action, entity, or field a later feature logs without a label still shows, by its stored name.
  const label = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold lg:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* min-w-0 lets the card shrink below the table, so the table scrolls instead of widening the page. */}
      <section className="min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6">
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-sm">
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
                  {entries.map((entry) => {
                    const changes = auditChanges(entry.oldValue, entry.newValue);
                    const entityName = entry.entity === "User" ? userNames.get(entry.entityId) : undefined;
                    return (
                      <tr key={entry.id} className="align-top">
                        <td className="px-3 py-3 whitespace-nowrap">
                          <LocalDateTime iso={entry.createdAt.toISOString()} timeStyle="short" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="break-words" dir="auto">
                            {entry.user.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span dir="ltr">{entry.user.username}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium">{label(`actions.${entry.action}`, entry.action)}</td>
                        <td className="px-3 py-3">
                          <div className="text-xs text-muted-foreground">
                            {label(`entities.${entry.entity}`, entry.entity)}
                          </div>
                          {entityName ? (
                            <div className="break-words" dir="auto">
                              {entityName}
                            </div>
                          ) : (
                            <code className="text-xs break-all" dir="ltr">
                              {entry.entityId}
                            </code>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {changes.length === 0 ? (
                            <span className="text-muted-foreground">{t("noChanges")}</span>
                          ) : (
                            <details>
                              <summary className="cursor-pointer rounded-md font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring">
                                {t("viewChanges")}
                              </summary>
                              <dl className="mt-2 flex max-w-md flex-col gap-3">
                                {changes.map((change) => (
                                  <div key={change.field}>
                                    <dt className="font-medium">{label(`fields.${change.field}`, change.field)}</dt>
                                    {(["before", "after"] as const).map((side) => (
                                      <dd key={side} className="mt-1 flex gap-2">
                                        <span className="shrink-0 text-muted-foreground">{t(side)}</span>
                                        <span className="min-w-0 break-words" dir="auto">
                                          {change[side] || t("noValue")}
                                        </span>
                                      </dd>
                                    ))}
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <nav
              aria-label={t("pagination.label")}
              className="mt-4 flex items-center justify-between gap-4 border-t pt-4 text-sm"
            >
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className={pageLinkClass}>
                  {t("pagination.previous")}
                </Link>
              ) : (
                <span aria-disabled="true" className="text-muted-foreground">
                  {t("pagination.previous")}
                </span>
              )}
              <span className="text-muted-foreground">{t("pagination.page", { page, total: totalPages })}</span>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className={pageLinkClass}>
                  {t("pagination.next")}
                </Link>
              ) : (
                <span aria-disabled="true" className="text-muted-foreground">
                  {t("pagination.next")}
                </span>
              )}
            </nav>
          </>
        )}
      </section>
    </div>
  );
}
