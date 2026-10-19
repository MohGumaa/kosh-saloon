import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { config, proxy } from "@/proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {},
  });

describe("proxy", () => {
  it("sends a visitor without a session cookie to login, keeping where they were going", () => {
    const response = proxy(request("/settlements?m=1"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/settlements?m=1");
  });

  it("sends a visitor at the root to login without a next path", () => {
    const location = new URL(proxy(request("/")).headers.get("location")!);

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.has("next")).toBe(false);
  });

  it("lets a request with a session cookie through; pages still validate it", () => {
    const response = proxy(request("/dashboard", "any-token"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("proxy matcher", () => {
  // Next.js anchors the matcher to the whole path.
  const matches = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path);

  it("leaves the sign-in pages, health check, and static assets public", () => {
    for (const path of ["/login", "/forgot-password", "/reset-password", "/api/health", "/_next/static/x.js", "/favicon.ico"]) {
      expect(matches(path), path).toBe(false);
    }
  });

  it("protects every other page and route", () => {
    for (const path of ["/", "/dashboard", "/settlements/abc", "/audit-log", "/api/other"]) {
      expect(matches(path), path).toBe(true);
    }
  });
});
