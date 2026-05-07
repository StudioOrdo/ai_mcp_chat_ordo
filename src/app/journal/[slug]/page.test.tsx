import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function routePath(relativePath: string): string {
  return join(process.cwd(), relativePath);
}

function readSource(relativePath: string): string {
  return readFileSync(routePath(relativePath), "utf-8");
}

describe("/app/journal/[slug] retired public route guard", () => {
  it("keeps stale journal article routes visible as not-found only", () => {
    const relativePath = "src/app/journal/[slug]/page.tsx";
    const exists = existsSync(routePath(relativePath));

    expect(exists).toBe(true);
    if (!exists) return;

    const src = readSource(relativePath);

    expect(src).toContain("notFound");
    expect(src).toContain("index: false");
    expect(src).not.toContain("PublicJournalPages");
  });
});
