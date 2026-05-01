import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShellBrand } from "@/components/shell/ShellBrand";

describe("ShellBrand", () => {
  it("renders the canonical brand label and points to the home route by default", () => {
    render(<ShellBrand />);

    const brandLink = screen.getByRole("link", { name: /studio ordo home/i });

    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute("href", "/");
    expect(screen.getByText("Studio Ordo")).toBeInTheDocument();
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
