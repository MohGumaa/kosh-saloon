import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
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
      <ThemePreferenceSync stored={fromStoredTheme(user.theme)} />
      <Sidebar navKeys={navKeys} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Only display fields reach the client. */}
        <Header user={{ name: user.name, role: user.role, image: user.image }} navKeys={navKeys} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
