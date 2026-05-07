// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("provider capability edge parity", () => {
  it("keeps admin web-search sidecar client construction on the provider factory path", () => {
    const source = readRepoFile("mcp/admin-web-search-server.ts");

    expect(source).toContain("createAdminWebSearchDeps");
    expect(source).not.toContain("getOpenaiApiKey");
    expect(source).not.toContain("new OpenAI");
  });

  it("keeps the shared web-search helper free of env/provider preflight logic", () => {
    const source = readRepoFile("src/lib/capabilities/shared/web-search-tool.ts");

    expect(source).not.toContain("getOpenaiApiKey");
    expect(source).not.toContain("OPENAI_API_KEY environment variable is not set");
  });

  it("gates the generated-image E2E harness through image capability policy", () => {
    const source = readRepoFile("src/app/api/e2e/media/generated-image/route.ts");

    expect(source).toContain('assertProviderBackedToolAvailable("generate_blog_image")');
    expect(source).toContain("ProviderClientFactory.createOpenAiClient");
    expect(source).not.toContain("getOpenaiApiKey");
    expect(source).not.toContain("new OpenAI");
  });
});
