import { describe, expect, it } from "vitest";
import { missingRequiredEnv, REQUIRED_ENV, requestErrorLog } from "./ops";

const fullEnv = Object.fromEntries(REQUIRED_ENV.map((name) => [name, "value"]));

describe("missingRequiredEnv", () => {
  it("returns nothing when every variable is set", () => {
    expect(missingRequiredEnv(fullEnv)).toEqual([]);
  });

  it("lists missing, empty, and whitespace-only variables in order", () => {
    const env = { ...fullEnv, APP_URL: "", EMAIL_FROM: "   ", BLOB_READ_WRITE_TOKEN: undefined };
    delete (env as Record<string, unknown>).kosh_DATABASE_URL;
    expect(missingRequiredEnv(env)).toEqual(["kosh_DATABASE_URL", "APP_URL", "EMAIL_FROM", "BLOB_READ_WRITE_TOKEN"]);
  });
});

describe("requestErrorLog", () => {
  const context = { routePath: "/reset-password", routeType: "render", renderSource: "server-rendering" };

  it("strips the query string and hash from the path", () => {
    const log = requestErrorLog(new Error("boom"), { path: "/reset-password?token=secret#top", method: "GET" }, context);
    expect(log.path).toBe("/reset-password");
    expect(JSON.stringify(log)).not.toContain("secret");
  });

  it("keeps the message, digest, and route context", () => {
    const error = Object.assign(new Error("boom"), { digest: "123" });
    expect(requestErrorLog(error, { path: "/invoices", method: "POST" }, context)).toEqual({
      message: "boom",
      digest: "123",
      method: "POST",
      path: "/invoices",
      ...context,
    });
  });

  it("handles non-Error values", () => {
    const log = requestErrorLog("plain failure", { path: "/", method: "GET" }, {});
    expect(log.message).toBe("plain failure");
    expect(log.digest).toBeUndefined();
  });

  it("never includes headers or cookies", () => {
    const request = { path: "/", method: "GET", headers: { cookie: "kosh_session=abc" } };
    const log = requestErrorLog(new Error("boom"), request, context);
    expect(Object.keys(log)).not.toContain("headers");
    expect(JSON.stringify(log)).not.toContain("kosh_session");
  });
});
