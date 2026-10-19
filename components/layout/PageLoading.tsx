const panelClass = "rounded-2xl border bg-card shadow-card";

/** Generic skeleton for a signed-in page: header, toolbar, and a table or card area. */
export function PageLoading({ label }: { label: string }) {
  return (
    <div role="status" className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="h-14 w-64 max-w-full animate-pulse rounded-xl bg-muted" />
      <div aria-hidden className={`${panelClass} h-16 animate-pulse`} />
      <div aria-hidden className={`${panelClass} h-96 animate-pulse`} />
    </div>
  );
}
