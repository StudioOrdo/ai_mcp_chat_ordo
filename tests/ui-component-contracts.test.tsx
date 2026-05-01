import { act, render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type React from "react";

// ── AdminBrowseFilters ─────────────────────────────────────────────────

describe("AdminBrowseFilters", () => {
  it("renders search, select, and toggle fields", async () => {
    const { AdminBrowseFilters } = await import(
      "@/components/admin/AdminBrowseFilters"
    );
    render(
      <AdminBrowseFilters
        fields={[
          { name: "q", label: "Search", type: "search", placeholder: "Search…" },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
            ],
          },
          {
            name: "kind",
            label: "Kind",
            type: "toggle",
            options: [
              { value: "post", label: "Post" },
              { value: "page", label: "Page" },
            ],
          },
        ]}
        values={{ q: "hello", status: "active", kind: "post" }}
      />,
    );

    expect(screen.getByRole("searchbox")).toHaveValue("hello");
    expect(screen.getByRole("combobox")).toHaveValue("active");
    expect(screen.getByRole("radio", { name: "Post" })).toBeChecked();
  });

  it("uses method=get form with a Filter submit button", async () => {
    const { AdminBrowseFilters } = await import(
      "@/components/admin/AdminBrowseFilters"
    );
    const { container } = render(
      <AdminBrowseFilters fields={[]} values={{}} />,
    );

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "get");
    expect(
      screen.getByRole("button", { name: "Filter" }),
    ).toBeInTheDocument();
  });
});

// ── AdminDataTable ─────────────────────────────────────────────────────

describe("AdminDataTable", () => {
  const columns = [
    { key: "name", header: "Name" },
    { key: "status", header: "Status" },
  ];
  const rows = [
    { id: "1", name: "Alice", status: "active" },
    { id: "2", name: "Bob", status: "archived" },
  ];

  it("renders desktop table with th scope=col headers", async () => {
    const { AdminDataTable } = await import(
      "@/components/admin/AdminDataTable"
    );
    const { container } = render(
      <AdminDataTable columns={columns} rows={rows} emptyMessage="No rows" />,
    );

    const desktop = container.querySelector(
      '[data-admin-data-table="desktop"]',
    );
    expect(desktop).not.toBeNull();
    const headers = desktop!.querySelectorAll("th[scope='col']");
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toBe("Name");
  });

  it("renders mobile card stack", async () => {
    const { AdminDataTable } = await import(
      "@/components/admin/AdminDataTable"
    );
    const { container } = render(
      <AdminDataTable columns={columns} rows={rows} emptyMessage="No rows" />,
    );

    const mobile = container.querySelector(
      '[data-admin-data-table="mobile"]',
    );
    expect(mobile).not.toBeNull();
    expect(mobile!.children).toHaveLength(2);
  });

  it("toggles row selection via checkboxes", async () => {
    const { AdminDataTable } = await import(
      "@/components/admin/AdminDataTable"
    );
    const onSelectionChange = vi.fn();
    render(
      <AdminDataTable
        columns={columns}
        rows={rows}
        emptyMessage="No rows"
        selectable
        selectedIds={new Set<string>()}
        onSelectionChange={onSelectionChange}
      />,
    );

    const checkbox = screen.getAllByRole("checkbox", {
      name: /Select row 1/i,
    })[0];
    fireEvent.click(checkbox);
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["1"]));
  });

  it("renders a mobile select-all control for selectable multi-row tables", async () => {
    const { AdminDataTable } = await import(
      "@/components/admin/AdminDataTable"
    );
    const onSelectionChange = vi.fn();
    render(
      <AdminDataTable
        columns={columns}
        rows={rows}
        emptyMessage="No rows"
        selectable
        selectedIds={new Set<string>()}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Select all rows/i }));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["1", "2"]));
  });
});

// ── AdminDetailShell ───────────────────────────────────────────────────

describe("AdminDetailShell", () => {
  it("renders 2-column layout with sidebar", async () => {
    const { AdminDetailShell } = await import(
      "@/components/admin/AdminDetailShell"
    );
    const { container } = render(
      <AdminDetailShell
        main={<div>Main content</div>}
        sidebar={<div>Sidebar content</div>}
      />,
    );

    expect(
      container.querySelector('[data-admin-detail-shell="true"]'),
    ).not.toBeNull();
    expect(screen.getByText("Main content")).toBeInTheDocument();
    expect(screen.getByText("Sidebar content")).toBeInTheDocument();
    expect(container.querySelector("aside")).not.toBeNull();
  });

  it("renders single column when sidebar is omitted", async () => {
    const { AdminDetailShell } = await import(
      "@/components/admin/AdminDetailShell"
    );
    const { container } = render(
      <AdminDetailShell main={<div>Main only</div>} />,
    );

    expect(screen.getByText("Main only")).toBeInTheDocument();
    expect(container.querySelector("aside")).toBeNull();
  });
});

// ── AdminWorkflowBar ───────────────────────────────────────────────────

describe("AdminWorkflowBar", () => {
  const actions = [
    { nextStatus: "published", label: "Publish", description: "Make live" },
    { nextStatus: "archived", label: "Archive", description: "Shelve it" },
  ];

  it("renders status and transition action buttons", async () => {
    const { AdminWorkflowBar } = await import(
      "@/components/admin/AdminWorkflowBar"
    );
    render(<AdminWorkflowBar actions={actions} currentStatus="draft" />);

    expect(screen.getByText("draft")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Archive" }),
    ).toBeInTheDocument();
  });

  it("shows confirmation dialog when action button clicked", async () => {
    const { AdminWorkflowBar } = await import(
      "@/components/admin/AdminWorkflowBar"
    );
    render(<AdminWorkflowBar actions={actions} currentStatus="draft" />);

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(screen.getByText("Make live")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
  });
});

// ── AdminEmptyState ────────────────────────────────────────────────────

describe("AdminEmptyState", () => {
  it("renders heading, description, and optional action", async () => {
    const { AdminEmptyState } = await import(
      "@/components/admin/AdminEmptyState"
    );
    const { container } = render(
      <AdminEmptyState
        heading="No entries"
        description="Create your first entry to get started."
        action={<button type="button">Create entry</button>}
      />,
    );

    expect(
      container.querySelector('[data-admin-empty-state="true"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "No entries" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create your first entry to get started."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create entry" }),
    ).toBeInTheDocument();
  });
});

// ── AdminBulkActionBar ─────────────────────────────────────────────────

describe("AdminBulkActionBar", () => {
  const actions = [
    { label: "Export", action: "export" },
    { label: "Delete", action: "delete", variant: "destructive" as const },
  ];

  it("renders count, action buttons, and clear when count > 0", async () => {
    const { AdminBulkActionBar } = await import(
      "@/components/admin/AdminBulkActionBar"
    );
    const onClear = vi.fn();
    render(
      <AdminBulkActionBar count={3} actions={actions} onClear={onClear} />,
    );

    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear" }),
    ).toBeInTheDocument();
  });

  it("returns null when count is 0", async () => {
    const { AdminBulkActionBar } = await import(
      "@/components/admin/AdminBulkActionBar"
    );
    const { container } = render(
      <AdminBulkActionBar count={0} actions={actions} onClear={vi.fn()} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("shows confirmation dialog on destructive action click", async () => {
    const { AdminBulkActionBar } = await import(
      "@/components/admin/AdminBulkActionBar"
    );
    render(
      <AdminBulkActionBar count={2} actions={actions} onClear={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText(/Delete 2 items\?/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
  });
});

// ── AdminDrawer interaction ────────────────────────────────────────────

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("AdminDrawer interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    usePathnameMock.mockReturnValue("/admin");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("closes drawer on Escape key", async () => {
    const { AdminDrawer } = await import(
      "@/components/admin/AdminDrawer"
    );
    render(<AdminDrawer />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open admin menu" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes drawer on route change", async () => {
    const { AdminDrawer } = await import(
      "@/components/admin/AdminDrawer"
    );
    const { rerender } = render(<AdminDrawer />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open admin menu" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Simulate route change
    await act(async () => {
      usePathnameMock.mockReturnValue("/admin/users");
      rerender(<AdminDrawer />);
      await Promise.resolve();
    });

    // requestAnimationFrame is used internally — flush it
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
