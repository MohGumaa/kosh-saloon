import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Power } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/layout/Panel";
import { ServiceEditForm } from "@/components/services/ServiceEditForm";
import { ServiceStatusForm } from "@/components/services/ServiceStatusForm";
import { requirePermission } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { getSalonSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services");
  return { title: t("edit.title") };
}

export default async function ServicePage({ params }: PageProps<"/services/[id]">) {
  const { permissions } = await requirePermission("services.edit");
  const { id } = await params;
  const [t, { currency }, service] = await Promise.all([
    getTranslations("services"),
    getSalonSettings(),
    db.service.findUnique({
      where: { id },
      select: { id: true, nameEn: true, nameAr: true, defaultPrice: true, isActive: true },
    }),
  ]);
  if (!service) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {permissions.has("services.view") && (
        <Link
          href="/services"
          className="flex items-center gap-2 self-start rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {t("back")}
        </Link>
      )}

      <h1 className="text-2xl font-semibold break-words lg:text-3xl">
        <span dir="auto">{service.nameEn}</span>
      </h1>

      <Panel icon={Pencil} title={t("edit.title")} description={t("edit.description")}>
        <ServiceEditForm
          id={service.id}
          values={{ nameEn: service.nameEn, nameAr: service.nameAr, defaultPrice: service.defaultPrice.toString() }}
          currency={currency}
        />
      </Panel>

      <Panel
        icon={Power}
        title={t("status.title")}
        description={t(service.isActive ? "status.activeDescription" : "status.inactiveDescription")}
      >
        <ServiceStatusForm id={service.id} isActive={service.isActive} />
      </Panel>
    </div>
  );
}
