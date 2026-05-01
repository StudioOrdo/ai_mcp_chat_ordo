// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useChatSurfaceStateMock } = vi.hoisted(() => ({
  useChatSurfaceStateMock: vi.fn(),
}));

vi.mock("./useChatSurfaceState", () => ({
  useChatSurfaceState: useChatSurfaceStateMock,
}));

vi.mock("@/hooks/useViewTransitionReady", () => ({
  useViewTransitionReady: () => false,
}));

vi.mock("./ProductExperienceSummary", () => ({
  ProductExperienceSummary: ({ summary }: { summary: { headline: string } }) => (
    <div data-testid="product-experience-summary">{summary.headline}</div>
  ),
}));

import { WorkspaceOverviewSurface } from "./WorkspaceOverviewSurface";

describe("WorkspaceOverviewSurface", () => {
  it("renders the dedicated workspace summary surface", () => {
    useChatSurfaceStateMock.mockReturnValue({
      contentProps: {
        productExperienceSummary: {
          headline: "Revenue follow-up workspace",
        },
      },
      handleActionClick: vi.fn(),
    });

    render(<WorkspaceOverviewSurface />);

    expect(screen.getByTestId("product-experience-summary")).toHaveTextContent("Revenue follow-up workspace");
  });

  it("shows an empty state when no workspace summary is available", () => {
    useChatSurfaceStateMock.mockReturnValue({
      contentProps: {
        productExperienceSummary: null,
      },
      handleActionClick: vi.fn(),
    });

    render(<WorkspaceOverviewSurface />);

    expect(screen.getByText("No active workspace snapshot yet.")).toBeInTheDocument();
    expect(screen.getByText(/Return to chat to start a thread/)).toBeInTheDocument();
  });
});