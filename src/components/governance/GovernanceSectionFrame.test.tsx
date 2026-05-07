import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  GovernanceSectionFrame,
  type GovernanceSectionModel,
  type GovernanceSelectorItem,
} from "./GovernanceSectionFrame";

interface TestObject {
  id: string;
  title: string;
}

interface TestSummary {
  total: number;
}

function model(
  overrides: Partial<GovernanceSectionModel<TestObject, TestSummary>> = {},
): GovernanceSectionModel<TestObject, TestSummary> {
  const object = { id: "asset_1", title: "Founder audio" };

  return {
    sectionId: "studio",
    sectionTitle: "Studio",
    brief: {
      id: "brief_1",
      sectionId: "studio",
      status: "fresh",
      title: "Production Brief",
      summary: "One asset is ready to inspect.",
      bullets: ["Review the audio before publishing."],
      recommendedAction: { label: "Ask Ordo", href: "/" },
      evidenceRefs: [{
        kind: "asset",
        id: "asset_1",
        label: "Founder audio",
        href: "/studio?q=audio&bucket=produced&object=asset_1",
        visibility: "owner",
      }],
      limitations: [],
      asOf: "2026-05-06T12:00:00.000Z",
      version: 1,
    },
    summary: { total: 1 },
    objects: [object],
    selectedObject: null,
    permissions: { canView: true, canSelect: true, canFilter: true },
    ...overrides,
  };
}

function selectorItems(selected = false): GovernanceSelectorItem[] {
  return [
    {
      id: "asset_1",
      href: "/studio?q=audio&bucket=produced&object=asset_1",
      title: "Founder audio",
      summary: "Generated audio",
      meta: "Produced",
      iconLabel: "A",
      statusLabel: "Media",
      selected,
      diagnosticLabel: "Internal route",
    },
  ];
}

function renderFrame({
  detailRequested = false,
  selectedObject = null,
  canViewDiagnostics = false,
}: {
  detailRequested?: boolean;
  selectedObject?: TestObject | null;
  canViewDiagnostics?: boolean;
} = {}) {
  return render(
    <GovernanceSectionFrame
      model={model({
        selectedObject,
        permissions: {
          canView: true,
          canSelect: true,
          canFilter: true,
          canViewDiagnostics,
        },
      })}
      detailRequested={detailRequested}
      listHref="/studio?q=audio&bucket=produced"
      mobileBackLabel="Back to Studio"
      selector={{
        ariaLabel: "Studio selection",
        title: "Studio",
        guidance: "Select production objects.",
        overview: (
          <div data-section-overview-tile="true">
            <p>Total</p>
            <p>1</p>
          </div>
        ),
        search: {
          action: "/studio",
          label: "Search Studio",
          placeholder: "Search Studio...",
          defaultValue: "audio",
          hiddenFields: [{ name: "bucket", value: "produced" }],
        },
        filters: {
          label: "Open Studio filters",
          action: "/studio",
          clearHref: "/studio",
          hiddenFields: [{ name: "q", value: "audio" }],
          controls: [{
            id: "kind-filter",
            label: "Object type",
            name: "kind",
            value: "media_asset",
            options: [
              { label: "All work", value: null },
              { label: "Media", value: "media_asset" },
            ],
          }],
        },
        items: selectorItems(detailRequested),
        emptyTitle: "No objects match",
        emptySummary: "Generated work appears here.",
        footer: <p>Showing 1 of 1 Studio objects.</p>,
      }}
      main={{
        ariaLabel: "Studio detail",
        renderDetail: (object) => (
          <article data-selected-object-detail="true">
            <h1>{object.title}</h1>
            <p>Selected object detail.</p>
          </article>
        ),
      }}
    />,
  );
}

describe("GovernanceSectionFrame", () => {
  it("renders the base section brief with a second-column selector", () => {
    renderFrame();

    expect(screen.getByLabelText("Studio selection")).toHaveAttribute("data-governance-selector-column", "true");
    expect(screen.getByLabelText("Studio detail")).toHaveAttribute("data-governance-main-column", "true");
    expect(screen.getByRole("heading", { name: "Production Brief", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("One asset is ready to inspect.")).toBeInTheDocument();
    expect(screen.getByText("As of 2026-05-06T12:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search Studio...")).toHaveValue("audio");
    expect(screen.getByLabelText("Open Studio filters")).toBeInTheDocument();
    expect(screen.getByLabelText("Object type")).toHaveValue("media_asset");
    expect(within(screen.getByLabelText("Studio selection")).getByRole("link", { name: /Founder audio/i })).toHaveAttribute(
      "href",
      "/studio?q=audio&bucket=produced&object=asset_1",
    );
    const main = screen.getByLabelText("Studio detail");
    expect(within(main).getByText("Evidence behind the brief")).toBeInTheDocument();
    expect(within(main).getByRole("link", { name: "Founder audio" })).toHaveAttribute(
      "href",
      "/studio?q=audio&bucket=produced&object=asset_1",
    );
    expect(screen.getByText("Showing 1 of 1 Studio objects.")).toBeInTheDocument();
  });

  it("renders limited and stale brief state with explicit limitations", () => {
    const baseModel = model();
    if (!baseModel.brief) {
      throw new Error("Test model must include a brief.");
    }

    render(
      <GovernanceSectionFrame
        model={model({
          brief: {
            ...baseModel.brief,
            id: "brief_2",
            status: "stale",
            evidenceRefs: [],
            limitations: ["Source evidence changed after this brief was generated."],
          },
        })}
        detailRequested={false}
        listHref="/studio"
        mobileBackLabel="Back to Studio"
        selector={{
          ariaLabel: "Studio selection",
          items: [],
          emptyTitle: "No objects match",
          emptySummary: "Generated work appears here.",
          footer: <p>Showing 0 of 0 Studio objects.</p>,
        }}
        main={{
          ariaLabel: "Studio detail",
          renderDetail: (object) => <p>{object.title}</p>,
        }}
      />,
    );

    expect(screen.getByLabelText("Studio detail").querySelector('[data-governance-brief-panel="stale"]')).not.toBeNull();
    expect(screen.getByText("Limitations")).toBeInTheDocument();
    expect(screen.getByText("Source evidence changed after this brief was generated.")).toBeInTheDocument();
  });

  it("renders selected object detail with mobile back control and without section overview in the main pane", () => {
    const { container } = renderFrame({
      detailRequested: true,
      selectedObject: { id: "asset_1", title: "Founder audio" },
    });

    expect(container.querySelector('[data-governance-mobile-state="detail"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: "Back to Studio" })).toHaveAttribute(
      "href",
      "/studio?q=audio&bucket=produced",
    );
    const main = screen.getByLabelText("Studio detail");
    expect(within(main).getByRole("heading", { name: "Founder audio", level: 1 })).toBeInTheDocument();
    expect(within(main).queryByText("Total")).not.toBeInTheDocument();
  });

  it("falls back to a quiet missing-detail state when selection is unauthorized or missing", () => {
    renderFrame({ detailRequested: true, selectedObject: null });

    expect(screen.getByText("Studio item was not found.")).toBeInTheDocument();
    expect(screen.getByText("Return to the section brief or select another item from the evidence index.")).toBeInTheDocument();
  });

  it("keeps diagnostic labels out of regular owner selector rows", () => {
    renderFrame();

    expect(screen.queryByText("Internal route")).not.toBeInTheDocument();
  });

  it("allows diagnostics only when a role-gated model requests them", () => {
    renderFrame({ canViewDiagnostics: true });

    expect(screen.getByText("Internal route")).toBeInTheDocument();
  });
});
