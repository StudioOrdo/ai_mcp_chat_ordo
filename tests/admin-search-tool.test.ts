import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

import { adminSearchTool } from "@/core/use-cases/tools/admin-search.tool";

function mockDb(rows: unknown[] = []) {
  getDbMock.mockReturnValue({
    prepare: vi.fn(() => ({ all: vi.fn().mockReturnValue(rows) })),
  });
}

describe("adminSearchTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has expected tool descriptor properties", () => {
    expect(adminSearchTool.name).toBe("admin_search");
    expect(adminSearchTool.roles).toContain("ADMIN");
    expect(adminSearchTool.category).toBe("system");
    expect(adminSearchTool.schema.input_schema.required).toContain("query");
  });

  it("returns empty results for short queries", async () => {
    mockDb();
    const result = await adminSearchTool.command.execute({ query: "a" });
    expect(result.results).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it("treats wildcard user-list requests as a valid admin listing query", async () => {
    const mockResults = [
      {
        entityType: "user",
        id: "usr_1",
        title: "Keith Williams",
        subtitle: "User — keith@example.com",
        href: "/admin/users/usr_1",
        matchField: "name",
        updatedAt: "2026-05-02",
      },
    ];
    mockDb(mockResults);

    const result = await adminSearchTool.command.execute({
      query: "*",
      entityTypes: ["user"],
    });

    expect(result.totalCount).toBe(1);
    expect(result.results[0].entityType).toBe("user");
  });

  it("returns results with correct structure", async () => {
    const mockResults = [
      {
        entityType: "lead",
        id: "lead_1",
        title: "Test Lead",
        subtitle: "Lead — qualified",
        href: "/admin/leads/lead_1",
        matchField: "name",
        updatedAt: "2024-06-01",
      },
    ];
    mockDb(mockResults);

    const result = await adminSearchTool.command.execute({ query: "Test" });
    expect(result.totalCount).toBe(1);
    expect(result.results[0].entityType).toBe("lead");
    expect(result.results[0].title).toBe("Test Lead");
  });

  it("passes entity type filter to search", async () => {
    const prepareMock = vi.fn((sql: string) => ({ all: vi.fn().mockReturnValue([]), sql }));
    getDbMock.mockReturnValue({ prepare: prepareMock });

    await adminSearchTool.command.execute({
      query: "test",
      entityTypes: ["journal"],
    });

    const sql = String(prepareMock.mock.calls[0]?.[0]);
    expect(sql).toContain("blog_posts");
    expect(sql).not.toContain("lead_records");
  });
});
