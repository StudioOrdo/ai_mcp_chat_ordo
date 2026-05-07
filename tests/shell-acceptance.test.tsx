import { act, render, screen, within } from "@testing-library/react";
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

const publishedFeedContext = { hasPublicFeedItems: true };

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

vi.mock("@/components/AttentionInbox", () => ({
  AttentionInbox: () => <button type="button" aria-label="Open attention inbox" data-testid="attention-inbox" />,
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

async function renderShellAcceptance(
  navigationContext = { hasPublicFeedItems: false },
) {
  let view: ReturnType<typeof render> | undefined;

  await act(async () => {
    view = render(
      <ThemeProvider>
        <AppShell user={authenticatedUser} navigationContext={navigationContext}>
          <div>Acceptance Content</div>
        </AppShell>
      </ThemeProvider>,
    );
    await Promise.resolve();
  });

  return view as ReturnType<typeof render>;
}

async function renderAnonymousShellAcceptance(
  navigationContext = { hasPublicFeedItems: false },
) {
  let view: ReturnType<typeof render> | undefined;

  await act(async () => {
    view = render(
      <ThemeProvider>
        <AppShell user={anonymousUser} navigationContext={navigationContext}>
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
  it("renders visible public navigation plus signed-in governance access in the left rail", async () => {
    await renderShellAcceptance();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const workRail = screen.getByRole("navigation", { name: "Workspace" });
    const navLinks = getLinkNames(nav);

    expect(navLinks).toEqual(["Studio Ordo home", "Offers", "About"]);
    expect(nav).toHaveAttribute("data-shell-nav-rail", "true");
    expect(nav.querySelector('[data-shell-nav-region="brand"]')).not.toBeNull();
    expect(nav.querySelector('[data-shell-nav-region="account-access"]')).not.toBeNull();
    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).not.toBeNull();
    expect(within(nav).queryByTestId("jobs-rail")).toBeNull();
    expect(within(nav).queryByRole("button", { name: "Open attention inbox" })).toBeNull();
    expect(within(nav).getByRole("button", { name: /test user account menu/i })).toBeInTheDocument();
    expect(within(workRail).queryByTestId("jobs-rail")).toBeNull();
    expect(within(workRail).queryByRole("button", { name: "Open attention inbox" })).toBeNull();
    expect(within(workRail).getByRole("link", { name: "Today" })).toHaveAttribute("href", "/workspace");
    expect(within(workRail).getByRole("link", { name: "Studio" })).toHaveAttribute("href", "/studio");
    expect(within(workRail).getByRole("link", { name: "People" })).toHaveAttribute("href", "/business");
    expect(within(workRail).getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(within(workRail).getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(within(workRail).queryByRole("link", { name: "Jobs" })).toBeNull();
    expect(within(workRail).queryByRole("link", { name: "Activity" })).toBeNull();
    expect(within(workRail).queryByRole("link", { name: "My Media" })).toBeNull();
    expect(within(workRail).queryByRole("link", { name: "Referrals" })).toBeNull();
    expect(within(workRail).queryByRole("link", { name: "Profile" })).toBeNull();
    expect(within(workRail).queryByRole("link", { name: "My profile" })).toBeNull();
    expect(within(nav).getByRole("link", { name: /studio ordo home/i })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(within(nav).getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(within(nav).queryByRole("link", { name: "Feed" })).toBeNull();
    expect(within(nav).queryByRole("button", { name: "Open workspace menu" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Training" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Studio" })).toBeNull();
  });

  it("adds feed to public discovery when public feed content exists without restoring the drawer", async () => {
    await renderShellAcceptance(publishedFeedContext);

    const nav = screen.getByRole("navigation", { name: "Primary" });

    expect(within(nav).getByRole("link", { name: "Feed" })).toHaveAttribute("href", "/feed");
    expect(within(nav).queryByRole("button", { name: "Open workspace menu" })).toBeNull();
  });

  it("renders only canonical grouped footer links and reuses the shared brand primitive", async () => {
    const { container } = await renderShellAcceptance();

    expect(container.querySelectorAll('[data-shell-brand="true"]')).toHaveLength(2);

    const footer = screen.getByRole("contentinfo");
    const footerLinks = getLinkNames(footer);

    expect(footerLinks).toEqual([
      "Studio Ordo home",
      "Home",
      "Offers",
      "About",
      "Today",
      "Studio",
      "People",
    ]);
    expect(within(footer).getByRole("link", { name: /studio ordo home/i })).toHaveAttribute("href", "/");
    expect(within(footer).getByText("Information")).toBeInTheDocument();
    expect(within(footer).getByText("Workspace")).toBeInTheDocument();
  });

  it("adds feed to footer discovery when public feed content exists", async () => {
    await renderShellAcceptance(publishedFeedContext);

    const footer = screen.getByRole("contentinfo");

    expect(within(footer).getByRole("link", { name: "Feed" })).toHaveAttribute("href", "/feed");
  });

  it("renders anonymous footer access links without signed-in workspace destinations", async () => {
    await renderAnonymousShellAcceptance();

    const footer = screen.getByRole("contentinfo");
    const footerLinks = getLinkNames(footer);
    const publicDock = screen.getByRole("navigation", { name: "Public navigation" });

    expect(screen.queryByRole("navigation", { name: "Workspace" })).toBeNull();
    expect(footerLinks).toEqual([
      "Studio Ordo home",
      "Home",
      "Offers",
      "About",
      "Login",
      "Register",
    ]);
    expect(within(footer).getByText("Information")).toBeInTheDocument();
    expect(within(footer).getByText("Access")).toBeInTheDocument();
    expect(within(footer).queryByText("Workspace")).toBeNull();
    expect(within(publicDock).getByRole("link", { name: "Chat" })).toHaveAttribute("href", "/");
    expect(within(publicDock).getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(within(publicDock).getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(within(publicDock).queryByRole("link", { name: "Feed" })).toBeNull();
  });

  it("adds feed to anonymous mobile dock when public feed content exists", async () => {
    await renderAnonymousShellAcceptance(publishedFeedContext);

    const publicDock = screen.getByRole("navigation", { name: "Public navigation" });

    expect(within(publicDock).getByRole("link", { name: "Feed" })).toHaveAttribute("href", "/feed");
  });
});
