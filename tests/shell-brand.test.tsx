import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShellBrand } from "@/components/shell/ShellBrand";
import { InstanceConfigProvider } from "@/lib/config/InstanceConfigContext";
import { DEFAULT_IDENTITY } from "@/lib/config/defaults";

describe("ShellBrand", () => {
  it("renders the canonical brand label and points to the home route by default", () => {
    const { container } = render(<ShellBrand />);

    const brandLink = screen.getByRole("link", { name: /studio ordo home/i });

    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute("href", "/");
    expect(screen.getByText("Studio Ordo")).toBeInTheDocument();
    expect(container.querySelector("[data-shell-brand-mark='true']")).toHaveAttribute(
      "data-shell-brand-mark-source",
      "/ordo-mark.png",
    );
    expect(container.querySelector("[data-shell-brand-wordmark='true']")?.className).not.toContain("theme-display");
  });

  it("uses configured markPath before falling back to the OpenGraph logo path", () => {
    const { container, rerender } = render(
      <InstanceConfigProvider
        identity={{
          ...DEFAULT_IDENTITY,
          name: "Acme",
          markPath: "/acme-mark.png",
          logoPath: "/acme-lockup.png",
        }}
      >
        <ShellBrand />
      </InstanceConfigProvider>,
    );

    expect(container.querySelector("[data-shell-brand-mark='true']")).toHaveAttribute(
      "data-shell-brand-mark-source",
      "/acme-mark.png",
    );

    rerender(
      <InstanceConfigProvider
        identity={{
          ...DEFAULT_IDENTITY,
          name: "Fallback",
          markPath: undefined,
          logoPath: "/fallback-lockup.png",
        }}
      >
        <ShellBrand />
      </InstanceConfigProvider>,
    );

    expect(container.querySelector("[data-shell-brand-mark='true']")).toHaveAttribute(
      "data-shell-brand-mark-source",
      "/fallback-lockup.png",
    );
  });

  it("can hide the visible wordmark while preserving an accessible label", () => {
    const { container } = render(<ShellBrand showWordmark={false} />);

    expect(screen.getByRole("link", { name: /studio ordo home/i })).toBeInTheDocument();
    expect(container.querySelector("[data-shell-brand-wordmark='true']")).toBeNull();
  });

  it("can hide the visible mark while preserving the wordmark and home link", () => {
    const { container } = render(<ShellBrand showMark={false} />);

    expect(screen.getByRole("link", { name: /studio ordo home/i })).toBeInTheDocument();
    expect(screen.getByText("Studio Ordo")).toBeInTheDocument();
    expect(container.querySelector("[data-shell-brand-mark='true']")).toBeNull();
  });
});
