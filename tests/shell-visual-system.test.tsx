import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/AppShell";
import { AccountMenu } from "@/components/AccountMenu";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ChatHeader } from "@/frameworks/ui/ChatHeader";
import { ChatSurfaceHeader } from "@/frameworks/ui/ChatSurfaceHeader";
import type { User } from "@/core/entities/user";

let pathname = "/dashboard";

const pushMock = vi.fn();
const switchRoleMock = vi.fn();
const logoutMock = vi.fn();
const fetchMock = vi.fn();

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

const matchMediaMock = vi.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

const authenticatedUser: User = {
  id: "usr_1",
  email: "user@example.com",
  name: "Test User",
  roles: ["AUTHENTICATED"],
};

const anonymousUser: User = {
  id: "usr_anon",
  email: "anon@example.com",
  name: "Anonymous Visitor",
  roles: ["ANONYMOUS"],
};

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useMockAuth", () => ({
  useMockAuth: () => ({
    switchRole: switchRoleMock,
    logout: logoutMock,
  }),
}));

vi.mock("@/frameworks/ui/jobs-rail/JobsRail", () => ({
  JobsRail: () => <div data-testid="jobs-rail" />,
}));

vi.mock("@/frameworks/ui/jobs-rail/useJobsRailController", () => ({
  useJobsRailController: () => ({
    model: { items: [] },
    utilityActions: [],
    onAction: vi.fn(),
  }),
}));

beforeEach(() => {
  pathname = "/dashboard";
  pushMock.mockReset();
  switchRoleMock.mockReset();
  logoutMock.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ preferences: [] }),
  });
  localStorageMock.getItem.mockReset();
  localStorageMock.getItem.mockReturnValue(null);
  localStorageMock.setItem.mockReset();
  localStorageMock.removeItem.mockReset();
  localStorageMock.clear.mockReset();
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("matchMedia", matchMediaMock);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function renderWithTheme(children: React.ReactNode) {
  let view: ReturnType<typeof render> | undefined;

  await act(async () => {
    view = render(
      <ThemeProvider>
        {children}
      </ThemeProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  return view!;
}

describe("shell visual system", () => {
  it("reuses shell brand sizing and truthful footer roles across shell surfaces", async () => {
    const { container } = await renderWithTheme(
      <AppShell user={authenticatedUser}>
        <div>Shell Content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Global Status: Optimal")).toBeNull();

    const brandMarks = Array.from(
      container.querySelectorAll<HTMLElement>('[data-shell-brand-mark="true"]'),
    );

    expect(brandMarks).toHaveLength(1);
    for (const mark of brandMarks) {
      expect(mark.className).toContain("shell-brand-mark");
    }

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const primaryLinksRegion = nav.querySelector('[data-shell-nav-region="primary-links"]');
    const workspaceMenuTrigger = within(nav).getByRole("button", { name: "Open workspace menu" });

    expect(within(nav).getByRole("link", { name: /studio ordo home/i }).className).toContain("whitespace-nowrap");
    expect(primaryLinksRegion).toBeNull();
    expect(workspaceMenuTrigger.className).toContain("shell-nav-icon-button");
    expect(nav.firstElementChild?.className).toContain("shell-nav-frame");

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("Information").className).toContain("shell-section-heading");
    expect(within(footer).getByRole("link", { name: "Library" }).className).toContain("shell-nav-label");
    expect(within(footer).getByText(/© 2026 Studio Ordo/i).className).toContain("shell-micro-text");
  });

  it("uses shared shell role primitives inside the real account menu", async () => {
    await renderWithTheme(<AccountMenu user={authenticatedUser} />);

    fireEvent.click(screen.getByRole("button", { name: /test user/i }));

    const legibilityToggle = await screen.findByRole("button", { name: "System Legibility" });
    expect(screen.getByRole("button", { name: /test user/i }).className).toContain("shell-account-trigger");
    expect(legibilityToggle.className).toContain("shell-account-label");
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("link", { name: "Jobs" }).className).toContain("shell-account-label");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "Profile" }).className).toContain("shell-account-label");
    expect(screen.queryByRole("link", { name: "Library" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Profile Settings" })).toBeNull();

    fireEvent.click(legibilityToggle);

    expect(screen.getByText("Type Scale").className).toContain("shell-micro-text");
    expect(screen.getByRole("button", { name: "Sign Out" }).className).toContain("shell-section-heading");
  });

  it("applies shared shell heading and meta roles in the real chat header", () => {
    render(
      <ChatHeader
        title="PD Advisor"
        subtitle="Intelligent Orchestrator"
        searchQuery=""
        onSearchChange={() => undefined}
        density="normal"
        onDensityChange={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "PD Advisor" }).className).toContain("shell-panel-heading");
    expect(screen.getByText("Intelligent Orchestrator").className).toContain("shell-meta-text");
    expect(screen.getByRole("button", { name: "Set density to compact" }).className).toContain("shell-micro-text");
  });

  it("keeps unauthenticated account links on shared shell nav label styling", async () => {
    await renderWithTheme(<AccountMenu user={anonymousUser} />);

    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));

    expect(screen.getByRole("link", { name: "Login" }).className).toContain("shell-account-label");
    expect(screen.getByRole("link", { name: "Register" }).className).toContain("shell-account-label");
  });

  it("lets anonymous users toggle dark mode from the account rail", async () => {
    await renderWithTheme(<AccountMenu user={anonymousUser} />);

    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));

    const toggle = screen.getByRole("button", { name: "Toggle dark mode" });
    fireEvent.click(toggle);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button", { name: "Toggle dark mode" })).toBeInTheDocument();
  });

  it("applies shared shell meta roles in the floating chat header variant", () => {
    render(
      <ChatSurfaceHeader
        mode="floating"
        onMinimize={() => undefined}
        onFullScreenToggle={() => undefined}
        isFullScreen={false}
      />,
    );

    expect(screen.queryByText("PD Advisor")).not.toBeInTheDocument();
    expect(screen.queryByText("Intelligent Orchestrator")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimize Chat" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set density to compact/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/filter session/i)).not.toBeInTheDocument();
  });

  it("renders embedded and floating headers in the same tree without prop leakage", () => {
    render(
      <div>
        <ChatHeader
          title="PD Advisor"
          subtitle="Intelligent Orchestrator"
          searchQuery=""
          onSearchChange={() => undefined}
          density="normal"
          onDensityChange={() => undefined}
        />
        <ChatSurfaceHeader
          mode="floating"
          onMinimize={() => undefined}
          onFullScreenToggle={() => undefined}
          isFullScreen={false}
        />
      </div>,
    );

    // Embedded header retains its controls
    expect(screen.getByRole("heading", { name: "PD Advisor" })).toBeInTheDocument();
    expect(screen.getByText("Intelligent Orchestrator")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set density to compact" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Filter session...")).toBeInTheDocument();

    // Floating header retains only its controls
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimize Chat" })).toBeInTheDocument();

    // Only one heading, one subtitle, one search — all from the embedded header
    expect(screen.getAllByRole("heading", { name: "PD Advisor" })).toHaveLength(1);
    expect(screen.getAllByPlaceholderText("Filter session...")).toHaveLength(1);
  });

  it("confirms ChatSurfaceHeader does not consume useTheme for local header rendering", () => {
    // The useTheme mock returns density: "compact".
    // If ChatSurfaceHeader were forwarding theme state to the floating header,
    // we would see density controls in the output.
    render(
      <ChatSurfaceHeader
        mode="floating"
        onMinimize={() => undefined}
        onFullScreenToggle={() => undefined}
        isFullScreen={false}
      />,
    );

    // Floating header must not expose any theme-derived controls
    expect(screen.queryByRole("button", { name: /set density/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/filter session/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/compact/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/relaxed/i)).not.toBeInTheDocument();

    // Only window-chrome controls exist
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimize Chat" })).toBeInTheDocument();
  });
});
