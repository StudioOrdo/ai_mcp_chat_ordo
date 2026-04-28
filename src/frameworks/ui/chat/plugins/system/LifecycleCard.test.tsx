import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { LifecycleCard } from "./LifecycleCard";
import {
  createLifecycleEnvelope,
  isLifecycleResultEnvelope,
} from "./lifecycle-descriptor";
import { resolveSystemCardKind } from "./resolve-system-card";

describe("LifecycleCard (Phase 1)", () => {
  const envelope = createLifecycleEnvelope({
    variant: "role_changed",
    occurredAt: "2025-01-15T10:30:00Z",
    actor: "Admin",
    detail: "Role updated to Apprentice.",
  });

  it("produces a lifecycle system envelope", () => {
    expect(envelope.family).toBe("system");
    expect(envelope.cardKind).toBe("lifecycle");
    expect(envelope.toolName).toBe("lifecycle_event");
    expect(envelope.payload?.variant).toBe("role_changed");
    expect(isLifecycleResultEnvelope(envelope)).toBe(true);
  });

  it("renders the variant label, caption, and timestamp", () => {
    const { container } = render(<LifecycleCard envelope={envelope} />);
    const card = container.querySelector("[data-capability-card]");
    expect(card).not.toBeNull();
    expect(card?.getAttribute("data-capability-kind")).toBe("lifecycle");
    expect(card?.getAttribute("data-capability-state")).toBe("succeeded");

    const title = container.querySelector("[data-lifecycle-title]");
    expect(title?.textContent).toMatch(/Role updated/i);

    const caption = container.querySelector("[data-lifecycle-caption]");
    expect(caption?.getAttribute("data-lifecycle-occurred-at")).toBe(
      "2025-01-15T10:30:00Z",
    );
    expect(caption?.textContent ?? "").toMatch(/Admin/);

    const timeline = container.querySelector("[data-capability-timeline]");
    expect(timeline).not.toBeNull();
    expect(timeline?.textContent ?? "").toMatch(/Role updated to Apprentice/);
  });

  it("routes lifecycle envelopes through resolveSystemCardKind", () => {
    expect(resolveSystemCardKind({ resultEnvelope: envelope })).toBeNull();
  });

  it("renders installed variant without detail", () => {
    const installed = createLifecycleEnvelope({
      variant: "installed",
      occurredAt: "2025-02-01T00:00:00Z",
    });
    const { container } = render(<LifecycleCard envelope={installed} />);
    expect(container.querySelector("[data-lifecycle-variant]")?.getAttribute("data-lifecycle-variant")).toBe(
      "installed",
    );
  });
});
