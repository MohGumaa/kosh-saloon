import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { InvoiceCreateForm } from "@/components/invoices/InvoiceCreateForm";
import { requirePermission } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { isOwnScope } from "@/lib/invoices";
import { getSalonSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invoices");
  return { title: t("create.title") };
}

const linkClass =
  "rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

export default async function NewInvoicePage() {
  const { user, permissions } = await requirePermission("invoices.create");
  const ownOnly = isOwnScope(user);
  const [t, locale, { currency }, services, employees] = await Promise.all([
    getTranslations("invoices"),
    getLocale(),
    getSalonSettings(),
    db.service.findMany({
      where: { isActive: true },
      orderBy: { nameEn: "asc" },
      select: { id: true, nameEn: true, nameAr: true, defaultPrice: true },
    }),
    ownOnly
      ? []
      : db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {permissions.has("invoices.view") && (
        <Link
          href="/transactions"
          className="flex items-center gap-2 self-start rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {t("back")}
        </Link>
      )}

      <section className="min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-7">
        <h1 className="text-2xl font-semibold">{t("create.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("create.description")}</p>
        <div className="mt-6">
          {services.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">{t("create.noServices")}</p>
              {permissions.has("services.create") && (
                <Link href="/services/new" className={linkClass}>
                  {t("create.addService")}
                </Link>
              )}
            </div>
          ) : (
            <InvoiceCreateForm
              employees={
                ownOnly
                  ? { ownName: user.name }
                  : employees.map((employee) => ({ ...employee, isActive: true }))
              }
              services={services.map((service) => ({
                id: service.id,
                name: locale === "ar" ? service.nameAr : service.nameEn,
                defaultPrice: service.defaultPrice.toString(),
                isActive: true,
              }))}
              currency={currency}
            />
          )}
        </div>
      </section>
    </div>
  );
}
