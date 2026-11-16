import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/SkipLink";
import { ThemePreferenceSync } from "@/components/layout/ThemePreferenceSync";
import { getPermissions } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { visibleNavKeys } from "@/lib/navigation";
import { fromStoredTheme } from "@/lib/theme";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireSession();
  // The client gets the visible item keys, not the permission list. Hiding an item is not
  // security: every page and action checks its own permission.
  const navKeys = visibleNavKeys(await getPermissions(user), user.role);

  return (
    <div className="flex min-h-dvh">
      {/* Printing shows only the page content (the closing statement prints as a sheet). */}
      <div className="contents print:hidden">
        <SkipLink />
        <Sidebar navKeys={navKeys} />
      </div>
      <ThemePreferenceSync stored={fromStoredTheme(user.theme)} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Only display fields reach the client. */}
        <div className="contents print:hidden">
          <Header user={{ name: user.name, role: user.role, image: user.image }} navKeys={navKeys} />
        </div>
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 p-4 outline-none lg:p-6 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
