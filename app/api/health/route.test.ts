import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: { $queryRaw: mocks.queryRaw } }));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
  });

  it("returns ok when the database answers", async () => {
    mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns 503 without error details when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.queryRaw.mockRejectedValue(new Error("connection refused at 10.0.0.1"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
