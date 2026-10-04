import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { requirePermission } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("employees");
  return { title: t("title") };
}

const COLUMNS = ["name", "username", "email", "role", "status"] as const;

const linkClass =
  "rounded-md font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

// The Revenue column arrives with invoices (feature 8).
export default async function EmployeesPage() {
  const { permissions } = await requirePermission("employees.view");
  const canManagePermissions = permissions.has("permissions.manage");
  const [t, tRoles, users] = await Promise.all([
    getTranslations("employees"),
    getTranslations("auth.roles"),
    db.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, username: true, email: true, image: true, role: true, isActive: true },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {permissions.has("employees.create") && (
          <Link
            href="/employees/new"
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <UserPlus aria-hidden className="size-4" />
            {t("new")}
          </Link>
        )}
      </div>

      {/* min-w-0 lets the card shrink below the table, so the table scrolls instead of widening the page. */}
      <section className="min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                {COLUMNS.map((column) => (
                  <th key={column} scope="col" className="px-3 py-2.5 text-start font-medium">
                    {t(`columns.${column}`)}
                  </th>
                ))}
                {canManagePermissions && (
                  <th scope="col" className="px-3 py-2.5 text-end font-medium">
                    <span className="sr-only">{t("columns.actions")}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id}>
                  <th scope="row" className="px-3 py-3 text-start font-medium">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.name} image={user.image} className="size-8 text-xs" />
                      <Link href={`/employees/${user.id}`} className={cn(linkClass, "break-words")}>
                        {user.name}
                      </Link>
                    </div>
                  </th>
                  <td className="px-3 py-3">
                    <span dir="ltr">{user.username}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span dir="ltr">{user.email}</span>
                  </td>
                  <td className="px-3 py-3">{tRoles(user.role)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        user.isActive ? "bg-primary-soft" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {t(user.isActive ? "active" : "inactive")}
                    </span>
                  </td>
                  {canManagePermissions && (
                    <td className="px-3 py-3 text-end">
                      {user.role !== "ADMIN" && (
                        <Link
                          href={`/employees/${user.id}?tab=permissions`}
                          aria-label={t("managePermissionsFor", { name: user.name })}
                          className={cn(linkClass, "text-primary")}
                        >
                          {t("managePermissions")}
                        </Link>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
