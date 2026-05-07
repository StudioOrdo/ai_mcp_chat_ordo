import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { CommandRegistry } from "@/core/commands/CommandRegistry";
import { useCommandRegistry } from "@/hooks/useCommandRegistry";
import {
  createCommandMentions,
  createShellCommands,
  resolveShellCommandDefinitions,
  resolveShellNavigationCommandDefinitions,
  SHELL_COMMAND_DEFINITIONS,
  SHELL_NAVIGATION_COMMAND_DEFINITIONS,
  SHELL_THEME_DEFINITIONS,
} from "@/lib/shell/shell-commands";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const setThemeSpy = vi.hoisted(() => vi.fn());
const publishedFeedContext = { hasPublicFeedItems: true };

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ setTheme: setThemeSpy }),
}));

function RegistryHarness() {
  const { findCommands } = useCommandRegistry();
  const commands = findCommands("theme");

  return createElement(
    "pre",
    { "data-testid": "command-results" },
    JSON.stringify(commands),
  );
}

describe("shell command parity", () => {
  it("keeps palette and slash surfaces aligned to the same command ids", () => {
    const paletteCommands = createShellCommands({
      navigate: () => undefined,
      setTheme: () => undefined,
    });
    const slashMentions = createCommandMentions();

    expect(paletteCommands.map((command) => command.id)).toEqual(
      slashMentions.map((command) => command.id),
    );
  });

  it("uses canonical empty-feed shell navigation ids and destinations", () => {
    expect(SHELL_NAVIGATION_COMMAND_DEFINITIONS).toEqual([
      {
        id: "nav-home",
        title: "Home",
        category: "Navigation",
        kind: "navigation",
        href: "/",
      },
      {
        id: "nav-offers",
        title: "Offers",
        category: "Navigation",
        kind: "navigation",
        href: "/offers",
      },
      {
        id: "nav-about",
        title: "About",
        category: "Navigation",
        kind: "navigation",
        href: "/about",
      },
    ]);
  });

  it("adds feed command definitions only when public feed content exists", () => {
    expect(resolveShellNavigationCommandDefinitions(null, publishedFeedContext)).toEqual([
      {
        id: "nav-home",
        title: "Home",
        category: "Navigation",
        kind: "navigation",
        href: "/",
      },
      {
        id: "nav-feed",
        title: "Feed",
        category: "Navigation",
        kind: "navigation",
        href: "/feed",
      },
      {
        id: "nav-offers",
        title: "Offers",
        category: "Navigation",
        kind: "navigation",
        href: "/offers",
      },
      {
        id: "nav-about",
        title: "About",
        category: "Navigation",
        kind: "navigation",
        href: "/about",
      },
    ]);
  });

  it("keeps theme command ids stable across both surfaces", () => {
    expect(SHELL_THEME_DEFINITIONS.map((command) => command.id)).toEqual([
      "theme-bauhaus",
      "theme-swiss",
      "theme-skeuomorphic",
      "theme-fluid",
    ]);
  });

  it("does not reintroduce removed placeholder or dead-route commands", () => {
    const commandIds = SHELL_COMMAND_DEFINITIONS.map((command) => command.id);

    expect(commandIds).not.toContain("nav-feed");
    expect(commandIds).not.toContain("training");
    expect(commandIds).not.toContain("studio");
    expect(commandIds).not.toContain("search");
    expect(commandIds).not.toContain("checklists");
    expect(commandIds).not.toContain("practitioners");
  });

  it("projects mention items directly from the shared command definitions", () => {
    expect(createCommandMentions()).toEqual(
      SHELL_COMMAND_DEFINITIONS.map((command) => ({
        id: command.id,
        name: command.title,
        category: "command",
        description: command.category,
      })),
    );
  });

  it("keeps useCommandRegistry aligned with the shared command mentions", () => {
    render(createElement(RegistryHarness));

    expect(screen.getByTestId("command-results")).toHaveTextContent(
      JSON.stringify(createCommandMentions().filter((command) => command.description === "Themes")),
    );
  });

  it("routes theme command execution through the setTheme setter", () => {
    setThemeSpy.mockClear();

    function ExecuteHarness() {
      const { executeCommand } = useCommandRegistry();
      return createElement("button", {
        "data-testid": "exec",
        onClick: () => executeCommand("theme-bauhaus"),
      });
    }

    render(createElement(ExecuteHarness));
    fireEvent.click(screen.getByTestId("exec"));

    expect(setThemeSpy).toHaveBeenCalledWith("bauhaus");
  });

  it("returns false for an unrecognized command id without calling setTheme", () => {
    setThemeSpy.mockClear();

    function RejectHarness() {
      const { executeCommand } = useCommandRegistry();
      return createElement("button", {
        "data-testid": "exec-bad",
        onClick: () => executeCommand("nonexistent-command"),
      });
    }

    render(createElement(RejectHarness));
    fireEvent.click(screen.getByTestId("exec-bad"));

    expect(setThemeSpy).not.toHaveBeenCalled();
  });

  it("keeps shell command ids compatible with slash-normalized registry lookup", () => {
    const registry = CommandRegistry.create(createShellCommands({
      navigate: () => undefined,
      setTheme: () => undefined,
    }));

    expect(registry.resolveCommand("/nav-offers")?.id).toBe("nav-offers");
    expect(registry.resolveCommand("/theme-bauhaus")?.id).toBe("theme-bauhaus");
  });

  it("keeps feed command execution available in published-feed context", () => {
    const registry = CommandRegistry.create(createShellCommands({
      navigate: () => undefined,
      setTheme: () => undefined,
      navigationContext: publishedFeedContext,
    }));

    expect(resolveShellCommandDefinitions({ navigationContext: publishedFeedContext }).map((command) => command.id)).toContain("nav-feed");
    expect(registry.resolveCommand("/nav-feed")?.id).toBe("nav-feed");
  });
});
