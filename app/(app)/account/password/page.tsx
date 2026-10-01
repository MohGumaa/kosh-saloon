import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/current-user";

/** The password form moved to the profile Settings tab; old links keep working. */
export default async function ChangePasswordRedirect() {
  await requireSession();
  redirect("/account?tab=settings");
}
