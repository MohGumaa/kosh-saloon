import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Scissors } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { getSalonSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services");
  return { title: t("title") };
}

const COLUMNS = ["nameEn", "nameAr", "defaultPrice", "status"] as const;

const linkClass =
  "rounded-md font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

export default async function ServicesPage() {
  const { permissions } = await requirePermission("services.view");
  const canCreate = permissions.has("services.create");
  const canEdit = permissions.has("services.edit");
  const [t, locale, { currency }, services] = await Promise.all([
    getTranslations("services"),
    getLocale(),
    getSalonSettings(),
    db.service.findMany({
      orderBy: [{ isActive: "desc" }, { nameEn: "asc" }],
      select: { id: true, nameEn: true, nameAr: true, defaultPrice: true, isActive: true },
    }),
  ]);
  const price = new Intl.NumberFormat(locale, { style: "currency", currency });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {canCreate && (
          <Link
            href="/services/new"
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus aria-hidden className="size-4" />
            {t("new")}
          </Link>
        )}
      </div>

      {/* min-w-0 lets the card shrink below the table, so the table scrolls instead of widening the page. */}
      <section className="min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6">
        {services.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Scissors aria-hidden className="size-5" />
            </span>
            <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
            <p className="text-sm text-muted-foreground">{t(canCreate ? "empty.create" : "empty.view")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-sm">
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
                {services.map((service) => (
                  <tr key={service.id}>
                    <th scope="row" className="px-3 py-3 text-start font-medium">
                      <span dir="auto" className="break-words">
                        {canEdit ? (
                          <Link href={`/services/${service.id}`} className={linkClass}>
                            {service.nameEn}
                          </Link>
                        ) : (
                          service.nameEn
                        )}
                      </span>
                    </th>
                    <td className="px-3 py-3">
                      <span dir="rtl" className="break-words">
                        {service.nameAr}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      <span dir="ltr">{price.format(service.defaultPrice.toNumber())}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          service.isActive ? "bg-primary-soft" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {t(service.isActive ? "active" : "inactive")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
