import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

describe("retired public journal/blog rendering", () => {
  it("keeps public journal and blog route modules as not-found guards", () => {
    for (const routePath of [
      "src/app/journal/page.tsx",
      "src/app/journal/[slug]/page.tsx",
      "src/app/blog/page.tsx",
      "src/app/blog/[slug]/page.tsx",
    ]) {
      const source = readSource(routePath);
      expect(source).toContain("notFound");
      expect(source).not.toContain("PublicJournalPages");
    }
  });

  it("keeps donor journal rendering code available for later feed migration", () => {
    const source = readSource("src/components/journal/PublicJournalPages.tsx");

    expect(source).toContain("renderPublicJournalIndexPage");
    expect(source).toContain("renderPublicJournalPostPage");
  });
});
