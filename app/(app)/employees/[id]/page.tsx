import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, KeyRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PermissionsForm } from "@/components/employees/PermissionsForm";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { requirePermission } from "@/lib/auth/authorize";
import { PERMISSION_KEYS, ROLE_DEFAULTS, changeableKeys, type PermissionKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("permissions");
  return { title: t("title") };
}

const panelClass = "min-w-0 rounded-2xl border bg-card text-card-foreground shadow-card";

// Permissions is the only tab until feature 6 (employee management) adds the others.
export default async function EmployeePage({ params }: PageProps<"/employees/[id]">) {
  const { user: viewer, permissions } = await requirePermission("permissions.manage");
  const { id } = await params;
  const [t, tPermissions, tRoles, target] = await Promise.all([
    getTranslations("employees"),
    getTranslations("permissions"),
    getTranslations("auth.roles"),
    db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    }),
  ]);
  if (!target) notFound();

  const isAdmin = target.role === "ADMIN";
  const isSelf = target.id === viewer.id;
  const readOnly = isAdmin || isSelf;
  const current = isAdmin ? PERMISSION_KEYS : target.permissions.map((row) => row.permission.key as PermissionKey);
  const changeable = readOnly ? [] : changeableKeys(viewer.role, permissions);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {permissions.has("employees.view") && (
        <Link
          href="/employees"
          className="flex items-center gap-2 self-start rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {t("back")}
        </Link>
      )}

      <section className={panelClass}>
        <div className="flex flex-wrap items-center gap-4 p-5 lg:px-7">
          <UserAvatar name={target.name} className="size-14 text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold break-words">{target.name}</h1>
            <p className="truncate text-sm text-muted-foreground" dir="ltr">
              {target.username}
            </p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium">{tRoles(target.role)}</span>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium",
              target.isActive ? "bg-primary-soft" : "bg-muted text-muted-foreground",
            )}
          >
            {t(target.isActive ? "active" : "inactive")}
          </span>
        </div>
        <nav aria-label={t("tabs.label")} className="flex gap-2 border-t px-3 lg:px-5">
          <Link
            href={`/employees/${target.id}`}
            aria-current="page"
            className="-mt-px flex items-center gap-2 border-t-2 border-primary px-4 py-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <KeyRound aria-hidden className="size-4" />
            {t("tabs.permissions")}
          </Link>
        </nav>
      </section>

      <section className={cn(panelClass, "p-5 lg:p-7")}>
        <h2 className="text-lg font-semibold">{tPermissions("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tPermissions(isAdmin ? "adminNote" : isSelf ? "selfNote" : "description")}
        </p>
        <div className="mt-6">
          <PermissionsForm
            userId={target.id}
            current={current}
            changeable={changeable}
            // An ADMIN has no stored list to reset.
            defaults={isAdmin ? [] : ROLE_DEFAULTS[target.role as keyof typeof ROLE_DEFAULTS]}
            readOnly={readOnly}
          />
        </div>
      </section>
    </div>
  );
}
