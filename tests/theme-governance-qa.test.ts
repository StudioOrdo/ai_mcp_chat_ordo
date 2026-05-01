import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function readWorkspaceFile(relativePath: string) {
  const testDirectory = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(testDirectory, "..", relativePath), "utf8");
}

describe("Sprint 4 theme governance audit", () => {
  it("keeps supported theme authority centralized in the manifest and provider boundaries", () => {
    const hotspotFiles = [
      "src/frameworks/ui/MessageList.tsx",
      "src/frameworks/ui/ChatInput.tsx",
      "src/components/journal/JournalLayout.tsx",
      "src/components/journal/PublicJournalPages.tsx",
      "src/components/SiteNav.tsx",
      "src/components/shell/ShellBrand.tsx",
    ];

    for (const filePath of hotspotFiles) {
      const source = readWorkspaceFile(filePath);

      expect(source).not.toMatch(/\[\s*["']bauhaus["']/);
      expect(source).not.toContain("SUPPORTED_THEME_IDS");
      expect(source).not.toContain("THEME_MANIFEST");
    }
  });

  it("binds hotspot semantic surfaces to their dedicated CSS partitions", () => {
    const semanticSurfaceOwnership = [
      {
        componentPath: "src/frameworks/ui/MessageList.tsx",
        cssPath: "src/app/styles/chat.css",
        hooks: [
          "ui-chat-message-user",
          "ui-chat-message-assistant",
          "data-chat-bubble-surface",
          "ui-chat-followup-frame",
          "ui-chat-hero-chip",
        ],
        selectors: [
          ".ui-chat-message-user",
          ".ui-chat-message-assistant",
          "[data-chat-bubble-surface=\"true\"]",
          ".ui-chat-followup-frame",
          ".ui-chat-hero-chip",
        ],
      },
      {
        componentPath: "src/frameworks/ui/ChatInput.tsx",
        cssPath: "src/app/styles/chat.css",
        hooks: [
          "ui-chat-composer-frame",
          "ui-chat-composer-frame-hover",
          "ui-chat-composer-frame-focus",
        ],
        selectors: [
          ".ui-chat-composer-frame",
          ".ui-chat-composer-frame-hover",
          ".ui-chat-composer-frame-focus",
        ],
      },
      {
        componentPath: "src/components/journal/JournalLayout.tsx",
        cssPath: "src/app/styles/editorial.css",
        hooks: ["journal-intro-card", "journal-feature-card", "journal-feature-media"],
        selectors: [".journal-intro-card", ".journal-feature-card", ".journal-feature-media"],
      },
      {
        componentPath: "src/components/journal/PublicJournalPages.tsx",
        cssPath: "src/app/styles/editorial.css",
        hooks: ["journal-empty-shell", "journal-archive-shell", "data-journal-region"],
        selectors: [".journal-empty-shell", ".journal-archive-shell", ".editorial-page-shell"],
      },
      {
        componentPath: "src/components/SiteNav.tsx",
        cssPath: "src/app/styles/shell.css",
        hooks: ["ui-shell-rail", "shell-nav-frame", "shell-nav-band", "shell-nav-actions"],
        selectors: [".ui-shell-rail", ".shell-nav-frame", ".shell-nav-band", ".shell-nav-actions"],
      },
      {
        componentPath: "src/components/shell/ShellBrand.tsx",
        cssPath: "src/app/styles/shell.css",
        hooks: ["shell-brand-row"],
        selectors: [".shell-brand-row"],
      },
      {
        componentPath: "src/components/admin/AdminSection.tsx",
        cssPath: "src/app/styles/admin.css",
        hooks: ["admin-hero-surface"],
        selectors: [".admin-hero-surface"],
      },
      {
        componentPath: "src/components/admin/AdminCard.tsx",
        cssPath: "src/app/styles/admin.css",
        hooks: ["admin-panel-surface", "admin-status-neutral", "admin-status-ok", "admin-status-warning"],
        selectors: [".admin-panel-surface", ".admin-status-neutral", ".admin-status-ok", ".admin-status-warning"],
      },
      {
        componentPath: "src/components/admin/AdminSidebar.tsx",
        cssPath: "src/app/styles/admin.css",
        hooks: ["admin-panel-surface", "admin-nav-link", "admin-nav-link-active", "admin-nav-link-idle", "admin-nav-link-icon"],
        selectors: [".admin-panel-surface", ".admin-nav-link", ".admin-nav-link-active", ".admin-nav-link-idle", ".admin-nav-link-icon"],
      },
    ] as const;

    for (const ownership of semanticSurfaceOwnership) {
      const componentSource = readWorkspaceFile(ownership.componentPath);
      const cssSource = readWorkspaceFile(ownership.cssPath);

      for (const hook of ownership.hooks) {
        expect(componentSource).toContain(hook);
      }

      for (const selector of ownership.selectors) {
        expect(cssSource).toContain(selector);
      }
    }
  });

  it("keeps covered chat and journal surfaces above the low-opacity drift floor", () => {
    const guardedLiterals = [
      {
        filePath: "src/frameworks/ui/ChatInput.tsx",
        forbiddenPatterns: [
          /placeholder:text-foreground\/(?:3[0-9]|4[0-9])/,
          /hover:text-foreground\/(?:3[0-9]|4[0-9])/,
          /text-foreground\/(?:3[0-9]|4[0-9]) transition-colors hover:text-red-500/,
        ],
      },
      {
        filePath: "src/components/journal/JournalLayout.tsx",
        forbiddenPatterns: [
          /text-foreground\/(?:42|44|46|48|54|56|58)/,
        ],
      },
      {
        filePath: "src/components/journal/PublicJournalPages.tsx",
        forbiddenPatterns: [
          /text-foreground\/(?:46|56|58)/,
        ],
      },
    ] as const;

    for (const guard of guardedLiterals) {
      const source = readWorkspaceFile(guard.filePath);

      for (const forbiddenPattern of guard.forbiddenPatterns) {
        expect(source).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("keeps shell blur-adjacent muted text floors at the hardened level", () => {
    const shellSource = readWorkspaceFile("src/app/styles/shell.css");

    expect(shellSource).toMatch(/\.ui-shell-nav-item-idle\s*\{[\s\S]*?color:\s*color-mix\(in oklab, var\(--foreground\) 68%, transparent\);/);
    expect(shellSource).toMatch(/\.ui-shell-account-ghost-trigger\s*\{[\s\S]*?color:\s*color-mix\(in oklab, var\(--foreground\) 68%, transparent\);/);

    expect(shellSource).not.toMatch(/\.ui-shell-nav-item-idle\s*\{[^}]*var\(--foreground\) (?:3[0-9]|4[0-9]|5[0-9]|6[0-7])%, transparent/);
    expect(shellSource).not.toMatch(/\.ui-shell-account-ghost-trigger\s*\{[^}]*var\(--foreground\) (?:3[0-9]|4[0-9]|5[0-9]|6[0-7])%, transparent/);
  });
});
