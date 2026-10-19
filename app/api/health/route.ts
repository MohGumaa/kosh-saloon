import { db } from "@/lib/db";

const headers = { "Cache-Control": "no-store" };

/** Uptime check: confirms the database answers. Public, so it reveals no details. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error("[health] database check failed", error instanceof Error ? error.message : String(error));
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
