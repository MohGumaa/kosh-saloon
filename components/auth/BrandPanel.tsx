import { getTranslations } from "next-intl/server";

const SMALL_BARS = ["h-4", "h-7", "h-5", "h-9", "h-6", "h-10"];
const TALL_BARS = ["h-6", "h-10", "h-8", "h-12", "h-9", "h-14", "h-11"];

/** A drawing of the app, not real data; hidden from assistive technology. */
function DashboardIllustration() {
  return (
    <div aria-hidden className="w-full max-w-md rounded-3xl bg-white/95 p-4 shadow-2xl">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-destructive" />
        <span className="size-2.5 rounded-full bg-warning" />
        <span className="size-2.5 rounded-full bg-success" />
        <span className="ms-3 h-2 flex-1 rounded-full bg-slate-200" />
      </div>
      <div className="flex gap-3">
        <div className="flex w-9 flex-col items-center gap-2 rounded-xl bg-sidebar py-3">
          <span className="size-4 rounded-full bg-sidebar-primary" />
          <span className="size-4 rounded-full border-2 border-white/40" />
          <span className="size-4 rounded-full border-2 border-white/40" />
          <span className="size-4 rounded-full border-2 border-white/40" />
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 rounded-xl bg-slate-100 p-3">
              <span className="h-2 w-10 rounded-full bg-slate-300" />
              <span className="h-3 w-16 rounded-full bg-slate-400" />
              <div className="mt-1 flex items-end gap-1">
                {SMALL_BARS.map((height, index) => (
                  <span key={index} className={`w-2 rounded-full bg-chart-3 ${height}`} />
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-xl bg-sidebar p-3">
              <span className="h-2 w-12 rounded-full bg-white/50" />
              <div className="flex items-end justify-between gap-1">
                {TALL_BARS.map((height, index) => (
                  <span key={index} className={`w-2 rounded-full bg-success ${height}`} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-slate-100 p-3">
            <span className="size-16 shrink-0 rounded-full border-[10px] border-sidebar-primary border-e-warning border-b-success" />
            <div className="flex flex-1 flex-col gap-2">
              <span className="h-2 w-full rounded-full bg-slate-300" />
              <span className="h-2 w-4/5 rounded-full bg-slate-300" />
              <span className="h-2 w-3/5 rounded-full bg-slate-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The brand side of the signed-out pages; shown from the `lg` breakpoint. */
export async function BrandPanel() {
  const t = await getTranslations("brand");

  return (
    <aside className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div aria-hidden className="absolute -end-24 -top-24 size-80 rounded-full bg-sidebar-primary/25 blur-3xl" />
      <div aria-hidden className="absolute -start-24 bottom-0 size-72 rounded-full bg-sidebar-primary/15 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div
          aria-hidden
          className="flex size-11 items-center justify-center rounded-xl bg-sidebar-primary text-xl font-bold text-sidebar-primary-foreground"
        >
          K
        </div>
        <div>
          <div className="text-lg font-semibold">{t("name")}</div>
          <div className="text-sm text-sidebar-foreground/70">{t("tagline")}</div>
        </div>
      </div>

      <div className="relative flex justify-center py-10">
        <DashboardIllustration />
      </div>

      <div className="relative">
        <p className="text-3xl leading-tight font-semibold">{t("panelTitle")}</p>
        <p className="mt-3 max-w-md text-base text-sidebar-foreground/80">{t("panelBody")}</p>
      </div>
    </aside>
  );
}
