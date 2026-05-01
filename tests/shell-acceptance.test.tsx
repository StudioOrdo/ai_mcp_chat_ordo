import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import type { User } from "@/core/entities/user";

let pathname = "/";

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
  name: "Anonymous User",
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
  pathname = "/";
  pushMock.mockReset();
  switchRoleMock.mockReset();
  logoutMock.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ preferences: [] }),
    status: 200,
  });
  localStorageMock.getItem.mockReset();
  localStorageMock.getItem.mockReturnValue(null);
  localStorageMock.setItem.mockReset();
  localStorageMock.removeItem.mockReset();
  localStorageMock.clear.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("matchMedia", matchMediaMock);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function renderShellAcceptance() {
  let view: ReturnType<typeof render> | undefined;

  await act(async () => {
    view = render(
      <ThemeProvider>
        <AppShell user={authenticatedUser}>
          <div>Acceptance Content</div>
        </AppShell>
      </ThemeProvider>,
    );
    await Promise.resolve();
  });

  return view as ReturnType<typeof render>;
}

async function renderAnonymousShellAcceptance() {
  let view: ReturnType<typeof render> | undefined;

  await act(async () => {
    view = render(
      <ThemeProvider>
        <AppShell user={anonymousUser}>
          <div>Acceptance Content</div>
        </AppShell>
      </ThemeProvider>,
    );
    await Promise.resolve();
  });

  return view as ReturnType<typeof render>;
}

function getLinkNames(container: HTMLElement) {
  return within(container)
    .getAllByRole("link")
    .map((link) => link.getAttribute("aria-label") ?? link.textContent?.trim());
}

describe("shell acceptance", () => {
  it("renders only the canonical primary navigation contract in the shell header", async () => {
    await renderShellAcceptance();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const navLinks = getLinkNames(nav);

    expect(navLinks).toEqual(["Studio Ordo home"]);
    expect(nav).toHaveAttribute("data-shell-nav-rail", "true");
    expect(nav.querySelector('[data-shell-nav-region="brand"]')).not.toBeNull();
    expect(nav.querySelector('[data-shell-nav-region="account-access"]')).not.toBeNull();
    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).toBeNull();
    expect(within(nav).getByTestId("jobs-rail")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /studio ordo home/i })).toHaveAttribute("href", "/");
    fireEvent.click(within(nav).getByRole("button", { name: "Open workspace menu" }));

    const drawer = screen.getByRole("dialog", { name: "Workspace menu" });

    expect(within(drawer).queryByRole("link", { name: "Home" })).toBeNull();
    expect(within(drawer).getByRole("link", { name: /^Library/i })).toHaveAttribute("href", "/library");
    expect(within(drawer).getByRole("link", { name: /^Journal/i })).toHaveAttribute("href", "/journal");
    expect(within(drawer).getByRole("link", { name: "My Jobs" })).toHaveAttribute("href", "/jobs");
    expect(within(nav).queryByRole("link", { name: "Training" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Studio" })).toBeNull();
  });

  it("renders only canonical grouped footer links and reuses the shared brand primitive", async () => {
    const { container } = await renderShellAcceptance();

    expect(container.querySelectorAll('[data-shell-brand="true"]')).toHaveLength(2);

    const footer = screen.getByRole("contentinfo");
    const footerLinks = getLinkNames(footer);

    expect(footerLinks).toEqual([
      "Studio Ordo home",
      "Library",
      "Journal",
      "Current Work",
      "Referrals",
      "Profile",
    ]);
    expect(within(footer).getByRole("link", { name: /studio ordo home/i })).toHaveAttribute("href", "/");
    expect(within(footer).getByText("Information")).toBeInTheDocument();
    expect(within(footer).getByText("Workspace")).toBeInTheDocument();
  });

  it("renders anonymous footer access links without signed-in workspace destinations", async () => {
    await renderAnonymousShellAcceptance();

    const footer = screen.getByRole("contentinfo");
    const footerLinks = getLinkNames(footer);

    expect(footerLinks).toEqual(["Studio Ordo home", "Library", "Journal", "Login", "Register"]);
    expect(within(footer).getByText("Information")).toBeInTheDocument();
    expect(within(footer).getByText("Access")).toBeInTheDocument();
    expect(within(footer).queryByText("Workspace")).toBeNull();
  });
});
