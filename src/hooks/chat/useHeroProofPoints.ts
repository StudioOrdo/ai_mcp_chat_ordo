"use client";

import { useEffect, useState } from "react";

import type { HeroProofPoint, HeroProofPointsResponse } from "@/app/api/hero/proof-points/route";

/**
 * Phase 6: hero zero-state proof points sourced from the three
 * `class: "guide"` campaign corpus entries. Falls back to `null` while
 * fetching or on error, which lets the caller render its own
 * well-typed default without a layout shift.
 */
export function useHeroProofPoints(): readonly HeroProofPoint[] | null {
  const [proofPoints, setProofPoints] = useState<readonly HeroProofPoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/hero/proof-points", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as HeroProofPointsResponse;
        if (!cancelled && Array.isArray(payload.proofPoints) && payload.proofPoints.length > 0) {
          setProofPoints(payload.proofPoints);
        }
      } catch {
        // Hero is best-effort; a fetch failure falls back to the
        // hard-coded tour copy rather than rendering nothing.
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return proofPoints;
}
