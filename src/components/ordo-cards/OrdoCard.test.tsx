import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OrdoCard as OrdoCardModel } from "@/lib/ordo-cards";

import { OrdoCard } from "./OrdoCard";

const card: OrdoCardModel = {
  id: "media_asset:uf_image_1",
  kind: "media_asset",
  objectRef: {
    kind: "media_asset",
    id: "uf_image_1",
    label: "Hero image",
    href: "/studio/media/uf_image_1",
  },
  bucket: "produced",
  status: "succeeded",
  tone: "good",
  title: "Hero image",
  summary: "A generated image ready for reuse.",
  updatedAt: "2026-05-04T12:00:00.000Z",
  ownerUserId: "usr_1",
  roleVisibility: ["AUTHENTICATED"],
  sourceRefs: [{ sourceKind: "asset_catalog", sourceId: "uf_image_1" }],
  provenanceRefs: [
    { sourceKind: "asset_catalog", sourceId: "uf_image_1" },
    { sourceKind: "job", sourceId: "job_image" },
  ],
  detailHref: "/studio/media/uf_image_1",
  defaultLens: "provenance",
  preview: {
    kind: "image",
    href: "/api/user-files/uf_image_1",
    label: "hero.png",
    alt: "Hero image preview",
  },
  metrics: [
    { id: "type", label: "Type", value: "image" },
    { id: "source", label: "Source", value: "ai_generated" },
    { id: "size", label: "Size", value: "1200x800" },
    { id: "duration", label: "Duration", value: 0, unit: "sec" },
    { id: "hidden", label: "Hidden", value: "not rendered" },
  ],
  primaryAction: { id: "open", label: "Open asset", href: "/studio/media/uf_image_1", tone: "primary" },
  secondaryActions: [
    { id: "preview", label: "Preview", href: "/api/user-files/uf_image_1" },
    { id: "copy", label: "Copy handle", actionType: "copy", payload: { text: "uf_image_1" } },
  ],
};

describe("OrdoCard", () => {
  it("renders object identity, state, preview, metrics, and links", () => {
    render(<OrdoCard card={card} />);

    expect(screen.getByRole("article")).toHaveAttribute("data-ordo-card-kind", "media_asset");
    expect(screen.getByRole("link", { name: "Hero image" })).toHaveAttribute("href", "/studio/media/uf_image_1");
    expect(screen.getByText("succeeded")).toBeInTheDocument();
    expect(screen.getByText("Updated May 4 at 12:00 PM")).toBeInTheDocument();
    expect(screen.getByLabelText("Hero image preview")).toHaveAttribute("data-ordo-card-preview-kind", "image");
    expect(screen.getByText("1200x800")).toBeInTheDocument();
    expect(screen.queryByText("not rendered")).toBeNull();
    expect(screen.getByRole("link", { name: "Open asset" })).toHaveAttribute("href", "/studio/media/uf_image_1");
    expect(screen.getByRole("link", { name: "Preview" })).toHaveAttribute("href", "/api/user-files/uf_image_1");
  });

  it("dispatches non-link actions to callers", () => {
    const onAction = vi.fn();
    render(<OrdoCard card={card} onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy handle" }));

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({
      id: "copy",
      actionType: "copy",
    }));
  });

  it("handles copy actions without requiring a caller action handler", () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<OrdoCard card={card} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy handle" }));

    expect(writeText).toHaveBeenCalledWith("uf_image_1");
  });

  it("disables non-link, non-copy actions when no action handler is provided", () => {
    render(<OrdoCard card={{
      ...card,
      secondaryActions: [{ id: "queue", label: "Queue review", actionType: "queue" }],
    }} />);

    expect(screen.getByRole("button", { name: "Queue review" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Queue review" })).toHaveAttribute(
      "title",
      "Action unavailable in this surface",
    );
  });
});
