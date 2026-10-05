import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  AtSign,
  CalendarDays,
  Clock,
  ImageIcon,
  KeyRound,
  Mail,
  Phone,
  Power,
  ShieldCheck,
  UserCog,
  UserRound,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmployeeExpensesTab } from "@/components/employee-expenses/EmployeeExpensesTab";
import { EmployeeDetailsForm } from "@/components/employees/EmployeeDetailsForm";
import { EmployeeImageForm } from "@/components/employees/EmployeeImageForm";
import { EmployeePasswordForm } from "@/components/employees/EmployeePasswordForm";
import { EmployeeStatusForm } from "@/components/employees/EmployeeStatusForm";
import { PermissionsForm } from "@/components/employees/PermissionsForm";
import { LocalDateTime } from "@/components/layout/LocalDateTime";
import { Detail, Panel, panelClass } from "@/components/layout/Panel";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { getPermissions } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { PERMISSION_KEYS, ROLE_DEFAULTS, changeableKeys, type PermissionKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { canChangeEmployeeRole, canManageEmployee, canManageEmployeeAccess } from "@/lib/employees";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("employees");
  return { title: t("title") };
}

// Invoices and Performance join these with feature 18.
const TAB_ICONS = { overview: UserRound, expenses: Wallet, account: UserCog, permissions: KeyRound } as const;

type Tab = keyof typeof TAB_ICONS;

export default async function EmployeePage({ params, searchParams }: PageProps<"/employees/[id]">) {
  const { user: viewer } = await requireSession();
  const permissions = await getPermissions(viewer);
  const canView = permissions.has("employees.view");
  const canManagePermissions = permissions.has("permissions.manage");
  const canViewExpenses = permissions.has("employee_expenses.view");
  if (!canView && !canManagePermissions && !canViewExpenses) redirect("/forbidden");

  const { id } = await params;
  const [query, t, tPermissions, tRoles, target] = await Promise.all([
    searchParams,
    getTranslations("employees"),
    getTranslations("permissions"),
    getTranslations("auth.roles"),
    db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        image: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    }),
  ]);
  if (!target) notFound();

  // What the viewer may do to this employee; every action checks the same rules on the server.
  const canEdit = permissions.has("employees.edit") && canManageEmployee(viewer, target);
  const canSetPassword = permissions.has("employees.edit") && canManageEmployeeAccess(viewer, target);
  const canSetStatus = permissions.has("employees.activate") && canManageEmployeeAccess(viewer, target);

  const tabs: Tab[] = [];
  if (canView) tabs.push("overview");
  if (canViewExpenses) tabs.push("expenses");
  if (canEdit || canSetPassword || canSetStatus) tabs.push("account");
  if (canManagePermissions) tabs.push("permissions");
  const activeTab = tabs.find((key) => key === query.tab) ?? tabs[0];

  const isAdmin = target.role === "ADMIN";
  const isSelf = target.id === viewer.id;
  const permissionsReadOnly = isAdmin || isSelf;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {canView && (
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
          <UserAvatar name={target.name} image={target.image} className="size-14 text-lg" />
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
        <nav aria-label={t("tabs.label")} className="flex gap-2 overflow-x-auto border-t px-3 lg:px-5">
          {tabs.map((key) => {
            const Icon = TAB_ICONS[key];
            return (
              <Link
                key={key}
                href={key === "overview" ? `/employees/${target.id}` : `/employees/${target.id}?tab=${key}`}
                aria-current={activeTab === key ? "page" : undefined}
                className={cn(
                  "-mt-px flex items-center gap-2 border-t-2 px-4 py-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring",
                  activeTab === key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {t(`tabs.${key}`)}
              </Link>
            );
          })}
        </nav>
      </section>

      {activeTab === "overview" && (
        <Panel icon={UserRound} title={t("overview.title")} description={t("overview.description")}>
          <dl className="-my-4 grid gap-x-8 sm:grid-cols-2">
            <Detail icon={UserRound} label={t("fields.name")}>
              {target.name}
            </Detail>
            <Detail icon={AtSign} label={t("fields.username")}>
              <span dir="ltr">{target.username}</span>
            </Detail>
            <Detail icon={Mail} label={t("fields.email")}>
              <span dir="ltr">{target.email}</span>
            </Detail>
            <Detail icon={Phone} label={t("fields.phone")}>
              {target.phone ? <span dir="ltr">{target.phone}</span> : t("overview.noPhone")}
            </Detail>
            <Detail icon={ShieldCheck} label={t("fields.role")}>
              {tRoles(target.role)}
            </Detail>
            <Detail icon={Power} label={t("overview.status")}>
              {t(target.isActive ? "active" : "inactive")}
            </Detail>
            <Detail icon={CalendarDays} label={t("overview.created")}>
              <LocalDateTime iso={target.createdAt.toISOString()} dateStyle="long" />
            </Detail>
            <Detail icon={Clock} label={t("overview.lastSignIn")}>
              {target.lastLoginAt ? (
                <LocalDateTime iso={target.lastLoginAt.toISOString()} timeStyle="short" />
              ) : (
                t("overview.never")
              )}
            </Detail>
          </dl>
        </Panel>
      )}

      {activeTab === "expenses" && (
        <EmployeeExpensesTab
          employeeId={target.id}
          searchParams={query}
          canCreate={permissions.has("employee_expenses.create")}
        />
      )}

      {activeTab === "account" && (
        <>
          {canEdit && (
            <>
              <Panel icon={UserCog} title={t("details.title")} description={t("details.description")}>
                <EmployeeDetailsForm
                  userId={target.id}
                  values={{
                    name: target.name,
                    username: target.username,
                    email: target.email,
                    phone: target.phone ?? "",
                    role: target.role,
                  }}
                  canChangeRole={canChangeEmployeeRole(viewer, target)}
                />
              </Panel>
              <Panel icon={ImageIcon} title={t("image.title")} description={t("image.description")}>
                <EmployeeImageForm userId={target.id} name={target.name} image={target.image} />
              </Panel>
            </>
          )}
          {canSetPassword && (
            <Panel icon={KeyRound} title={t("password.title")} description={t("password.description")}>
              <EmployeePasswordForm userId={target.id} />
            </Panel>
          )}
          {canSetStatus && (
            <Panel
              icon={Power}
              title={t("status.title")}
              description={t(target.isActive ? "status.activeDescription" : "status.inactiveDescription")}
            >
              <EmployeeStatusForm userId={target.id} isActive={target.isActive} />
            </Panel>
          )}
        </>
      )}

      {activeTab === "permissions" && (
        <section className={cn(panelClass, "p-5 lg:p-7")}>
          <h2 className="text-lg font-semibold">{tPermissions("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tPermissions(isAdmin ? "adminNote" : isSelf ? "selfNote" : "description")}
          </p>
          <div className="mt-6">
            <PermissionsForm
              userId={target.id}
              current={isAdmin ? PERMISSION_KEYS : target.permissions.map((row) => row.permission.key as PermissionKey)}
              changeable={permissionsReadOnly ? [] : changeableKeys(viewer.role, permissions)}
              // An ADMIN has no stored list to reset.
              defaults={isAdmin ? [] : ROLE_DEFAULTS[target.role as keyof typeof ROLE_DEFAULTS]}
              readOnly={permissionsReadOnly}
            />
          </div>
        </section>
      )}
    </div>
  );
}
