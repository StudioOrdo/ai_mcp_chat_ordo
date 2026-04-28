/**
 * Phase 6 hero zero-state proof points.
 *
 * Replaces the hard-coded `HERO_PROOF_POINTS` constant in `MessageList.tsx`
 * with an honest, small set of suggestion chips sourced from the three
 * `class: "guide"` campaign corpus entries authored in Phase 4:
 *
 *   - `campaign/friends-and-family`
 *   - `campaign/local-flyers`
 *   - `campaign/lightweight-paid-outreach`
 *
 * Audience filtering goes through the same `canUserAccessAudience`
 * helper used by every retrieval path, so anonymous viewers see only
 * entries tagged `audience: "public"`.
 */
import { NextResponse } from "next/server";

import { FileSystemCorpusRepository } from "@/adapters/FileSystemCorpusRepository";
import { getSessionUser } from "@/lib/auth";
import { canUserAccessAudience } from "@/lib/access/content-access";

const CAMPAIGN_BOOK_SLUG = "campaign";

export interface HeroProofPoint {
  readonly slug: string;
  readonly title: string;
  readonly body: string;
}

export interface HeroProofPointsResponse {
  readonly proofPoints: readonly HeroProofPoint[];
}

function extractBody(markdown: string): string {
  const withoutFrontmatter = markdown.replace(/^---[\s\S]*?---\s*/m, "");
  const withoutHeading = withoutFrontmatter.replace(/^#\s[^\n]*\n+/, "");
  const firstParagraph = withoutHeading
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.length > 0 && !chunk.startsWith("#"));
  if (!firstParagraph) {
    return "";
  }
  const collapsed = firstParagraph.replace(/\s+/g, " ").trim();
  return collapsed.length > 180 ? `${collapsed.slice(0, 177).trimEnd()}…` : collapsed;
}

export async function GET(): Promise<NextResponse<HeroProofPointsResponse>> {
  try {
    const user = await getSessionUser();
    const role = user.roles[0] ?? "ANONYMOUS";
    const tier = user.tier;

    const repo = new FileSystemCorpusRepository();
    const book = await repo.getDocument(CAMPAIGN_BOOK_SLUG);
    if (!book || book.class !== "guide") {
      return NextResponse.json({ proofPoints: [] });
    }

    if (!canUserAccessAudience({ audience: book.audience, role, tier })) {
      return NextResponse.json({ proofPoints: [] });
    }

    const sections = await repo.getSectionsByDocument(CAMPAIGN_BOOK_SLUG);
    const accessible = sections.filter((section) =>
      canUserAccessAudience({ audience: section.audience, role, tier }),
    );

    const proofPoints: HeroProofPoint[] = accessible.slice(0, 3).map((section) => ({
      slug: `${section.documentSlug}/${section.sectionSlug}`,
      title: section.title,
      body: extractBody(section.content),
    }));

    return NextResponse.json({ proofPoints });
  } catch {
    return NextResponse.json({ proofPoints: [] });
  }
}
