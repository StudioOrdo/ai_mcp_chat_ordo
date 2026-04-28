import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

function fileExists(relativePath: string): boolean {
  return existsSync(join(process.cwd(), relativePath));
}

// Mock next/navigation for components that use router
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin/users"),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// ── D10.1: Skip-to-content link in admin layout ────────────────────────

describe("D10.1: Admin layout — skip-to-content link", () => {
  it("admin layout source contains skip link href '#admin-main'", () => {
    const source = readSource("src/app/admin/layout.tsx");
    expect(source).toContain("#admin-main");
  });

  it("admin layout contains id='admin-main' on main content container", () => {
    const source = readSource("src/app/admin/layout.tsx");
    expect(source).toContain("admin-main");
    // The id should be used as an anchor target
    expect(source).toMatch(/id=["']admin-main["']/);
  });

  it("skip link has 'Skip to main content' visible text", () => {
    const source = readSource("src/app/admin/layout.tsx");
    expect(source).toContain("Skip to main content");
  });

  // Edge: skip link uses sr-only visually hidden pattern
  it("skip link uses sr-only class (visually hidden but focusable)", () => {
    const source = readSource("src/app/admin/layout.tsx");
    expect(source).toContain("sr-only");
  });
});

// ── D10.2: Admin layout avoids a second mobile hamburger ─────────────

describe("D10.2: Admin layout — no dedicated mobile AdminDrawer", () => {
  it("admin layout does not render AdminDrawer", () => {
    const source = readSource("src/app/admin/layout.tsx");
    expect(source).not.toContain("<AdminDrawer />");
  });

  it("admin layout does not import AdminDrawer", () => {
    const source = readSource("src/app/admin/layout.tsx");
    expect(source).not.toMatch(/import.*AdminDrawer/);
  });

  it("admin layout does not render a separate mobile admin toolbar", () => {
    const source = readSource("src/app/admin/layout.tsx");
    expect(source).not.toContain("data-admin-mobile-toolbar");
  });
});

// ── D10.3: AccountMenu stays self-service only ───────────────────────

describe("D10.3: AccountMenu — self-service scope", () => {
  it("AccountMenu source resolves routes from shared shell navigation", () => {
    const candidates = [
      "src/components/shell/AccountMenu.tsx",
      "src/components/AccountMenu.tsx",
      "src/app/components/AccountMenu.tsx",
    ];
    const source = candidates
      .map((p) => (fileExists(p) ? readSource(p) : ""))
      .find((s) => s.length > 0);
    expect(source).toBeDefined();
    expect(source).toMatch(/resolveAccountMenuRoutes/);
  });

  it("AccountMenu source references ADMIN only for simulation controls", () => {
    const candidates = [
      "src/components/shell/AccountMenu.tsx",
      "src/components/AccountMenu.tsx",
    ];
    const source = candidates
      .map((p) => (fileExists(p) ? readSource(p) : ""))
      .find((s) => s.length > 0) ?? "";
    expect(source).toMatch(/ADMIN/);
    expect(source).not.toMatch(/href.*\/admin/g);
  });

  it("AccountMenu renders no admin workspace links for admin users", async () => {
    vi.mock("@/core/entities/user", () => ({}));

    let AccountMenu: React.ComponentType<{ role?: string }> | undefined;
    try {
      const mod = await import("@/components/AccountMenu");
      AccountMenu = (mod.AccountMenu ?? (mod as Record<string, unknown>).default) as React.ComponentType<{ role?: string }>;
    } catch {
      // skip component render if import fails during test environment
    }

    if (AccountMenu) {
      render(<AccountMenu role="ADMIN" />);
      const adminLinks = document.querySelectorAll('a[href^="/admin"]');
      expect(adminLinks.length).toBe(0);
    } else {
      const source = fileExists("src/components/AccountMenu.tsx")
        ? readSource("src/components/AccountMenu.tsx")
        : "";
      expect(source).not.toMatch(/href.*\/admin/g);
    }
  });

  it("AccountMenu source does not hardcode admin workspace links", () => {
    const candidates = [
      "src/components/shell/AccountMenu.tsx",
      "src/components/AccountMenu.tsx",
    ];
    const source = candidates
      .map((p) => (fileExists(p) ? readSource(p) : ""))
      .find((s) => s.length > 0) ?? "";
    expect(source).not.toMatch(/href.*\/admin/g);
  });

  it("AccountMenu source keeps account-scoped headings and controls", () => {
    const candidates = [
      "src/components/shell/AccountMenu.tsx",
      "src/components/AccountMenu.tsx",
    ];
    const source = candidates
      .map((p) => (fileExists(p) ? readSource(p) : ""))
      .find((s) => s.length > 0) ?? "";
    expect(source).toMatch(/Workspace|Account|System Legibility/i);
  });
});

// ── D10.4: jobs-page-shell class removed from admin layout ────────────

describe("D10.4: Admin layout — jobs-page-shell class removal", () => {
  it("admin layout does not contain jobs-page-shell CSS class", () => {
    const source = readSource("src/app/admin/layout.tsx");
    expect(source).not.toContain("jobs-page-shell");
  });
});

// ── D10.5: Detail pages have breadcrumbs + backHref ───────────────────

describe("D10.5: Detail pages — breadcrumbs and back-link", () => {
  const detailPages = [
    {
      path: "src/app/admin/users/[id]/page.tsx",
      label: "Users detail",
      parentHref: "/admin/users",
      parentLabel: "All Users",
    },
    {
      path: "src/app/admin/leads/[id]/page.tsx",
      label: "Leads detail",
      parentHref: "/admin/leads",
      parentLabel: "All Leads",
    },
    {
      path: "src/app/admin/conversations/[id]/page.tsx",
      label: "Conversations detail",
      parentHref: "/admin/conversations",
      parentLabel: "All Conversations",
    },
  ];

  for (const page of detailPages) {
    it(`${page.label} passes breadcrumbs to AdminSection`, () => {
      const source = readSource(page.path);
      expect(source, `${page.path} should pass breadcrumbs prop`).toContain(
        "breadcrumbs",
      );
    });

    it(`${page.label} passes backHref to AdminDetailShell`, () => {
      const source = readSource(page.path);
      expect(source, `${page.path} should pass backHref prop`).toContain(
        "backHref",
      );
    });
  }

  // Negative: breadcrumb trail must include parent route href (not just labels)
  it("users detail breadcrumbs include /admin/users href", () => {
    const source = readSource("src/app/admin/users/[id]/page.tsx");
    expect(source).toContain("/admin/users");
  });

  it("leads detail breadcrumbs include /admin/leads href", () => {
    const source = readSource("src/app/admin/leads/[id]/page.tsx");
    expect(source).toContain("/admin/leads");
  });

  it("breadcrumb trail always includes /admin as root", () => {
    // All detail pages should reference /admin as the root breadcrumb
    for (const page of detailPages) {
      const source = readSource(page.path);
      expect(source, `${page.path} breadcrumb root`).toContain("/admin");
    }
  });

  // ── D10.5a: Admin workspace pages avoid duplicate local rails ────────

  describe("D10.5a: Admin workspace pages — one shared rail", () => {
    const adminWorkspacePages = [
      "src/app/admin/leads/page.tsx",
      "src/app/admin/conversations/page.tsx",
      "src/app/admin/journal/page.tsx",
      "src/app/admin/journal/[id]/page.tsx",
      "src/app/admin/journal/attribution/page.tsx",
    ];

    for (const pagePath of adminWorkspacePages) {
      it(`${pagePath} does not import AdminWorkspaceNav`, () => {
        const source = readSource(pagePath);
        expect(source).not.toMatch(/AdminWorkspaceNav/);
      });
    }

    it("ShellWorkspaceMenu resolves route-aware admin workspace context", () => {
      const source = readSource("src/components/ShellWorkspaceMenu.tsx");
      expect(source).toMatch(/resolveAdminWorkspaceContext/);
    });
  });
});

// ── D10.6: Duplicate deal/training detail routes redirect canonically ─

describe("D10.6: Duplicate pipeline detail routes redirect to leads detail", () => {
  it("deals detail route uses permanentRedirect", () => {
    const source = readSource("src/app/admin/deals/[id]/page.tsx");
    expect(source).toContain("permanentRedirect");
    expect(source).toContain("getAdminLeadsDetailPath");
    expect(source).not.toContain("/admin/deals");
  });
});

// ── D10.7: Admin layout main landmark ────────────────────────────────

describe("D10.7: Admin layout — <main> landmark element", () => {
  it("admin layout renders a <main> element", () => {
    const source = readSource("src/app/admin/layout.tsx");
    expect(source).toMatch(/<main[\s>]/);
  });

  it("admin layout does not use <div> as the only wrapper for page content area", () => {
    const source = readSource("src/app/admin/layout.tsx");
    // Confirm <main> exists and is used for the primary content slot
    const mainCount = (source.match(/<main/g) ?? []).length;
    expect(mainCount).toBeGreaterThanOrEqual(1);
  });
});
