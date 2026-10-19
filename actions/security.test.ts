/**
 * Signed-out sweep over every exported Server Action. Actions are discovered from the
 * folder, so a new one is covered without editing this file: it must either stop at
 * `requireSession()` before touching the database, or be listed below with a reason.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const NO_SESSION = new Error("NEXT_REDIRECT /login");
  const touched: string[] = [];
  // Any property read on `db` counts as database access.
  const db = new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key === "string" && key !== "then") touched.push(key);
        return undefined;
      },
    },
  );
  const redirect = vi.fn((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${url}`), { digest: "NEXT_REDIRECT" });
  });
  return {
    NO_SESSION,
    touched,
    db,
    redirect,
    requireSession: vi.fn(async () => {
      throw NO_SESSION;
    }),
    getCurrentSession: vi.fn(async () => null),
    blob: { put: vi.fn(), del: vi.fn() },
    sendEmail: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/current-user", () => ({
  requireSession: mocks.requireSession,
  getCurrentSession: mocks.getCurrentSession,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@vercel/blob", () => mocks.blob);
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail, appUrl: () => "http://localhost" }));

/** Reachable without a session by design; never called here because each is a public auth flow with its own tests. */
const PUBLIC = {
  login: "signs a visitor in (rate limited, same error for unknown and wrong password)",
  requestPasswordReset: "starts a reset for a visitor (rate limited, neutral response)",
  resetPassword: "finishes a reset with a single-use emailed token",
};

/** Work without a session but must then do nothing to stored data. */
const SESSION_OPTIONAL: Record<string, { reason: string; args: unknown[] }> = {
  logout: { reason: "clears the cookie; audits only a valid session", args: [] },
  saveThemePreference: { reason: "signed out, the theme lives only in the browser", args: ["dark"] },
  setLocale: { reason: "sets the locale cookie only", args: ["ar"] },
};

const actionsDir = fileURLToPath(new URL(".", import.meta.url));
const files = readdirSync(actionsDir).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));

const actions: { name: string; run: (...args: unknown[]) => Promise<unknown> }[] = [];
for (const file of files) {
  const exports: Record<string, unknown> = await import(/* @vite-ignore */ join(actionsDir, file));
  for (const [name, value] of Object.entries(exports)) {
    if (typeof value === "function") actions.push({ name, run: value as (...args: unknown[]) => Promise<unknown> });
  }
}

const guarded = actions.filter(({ name }) => !(name in PUBLIC) && !(name in SESSION_OPTIONAL));

beforeEach(() => {
  mocks.touched.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("signed-out sweep", () => {
  it("discovers every action module and its exports", () => {
    expect(files.length).toBeGreaterThanOrEqual(12);
    expect(actions.length).toBeGreaterThanOrEqual(40);
    // A stale allowlist entry would hide nothing but should not linger either.
    const names = actions.map(({ name }) => name);
    for (const name of [...Object.keys(PUBLIC), ...Object.keys(SESSION_OPTIONAL)]) expect(names).toContain(name);
  });

  it.each(guarded.map(({ name, run }) => [name, run] as const))(
    "%s stops at requireSession before any database access",
    async (_name, run) => {
      await expect(run(null, new FormData())).rejects.toBe(mocks.NO_SESSION);
      expect(mocks.requireSession).toHaveBeenCalled();
      expect(mocks.touched).toEqual([]);
      expect(mocks.blob.put).not.toHaveBeenCalled();
      expect(mocks.blob.del).not.toHaveBeenCalled();
      expect(mocks.sendEmail).not.toHaveBeenCalled();
    },
  );

  it.each(Object.entries(SESSION_OPTIONAL))("%s touches no stored data signed out", async (name, { args }) => {
    const action = actions.find((candidate) => candidate.name === name)!;
    try {
      await action.run(...args);
    } catch (error) {
      // logout ends with a redirect to /login.
      expect(mocks.redirect).toHaveBeenCalledWith("/login");
      expect(error).toMatchObject({ digest: "NEXT_REDIRECT" });
    }
    expect(mocks.touched).toEqual([]);
  });
});
