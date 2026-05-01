import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function listSourceFiles(relativeDir: string): string[] {
  const absoluteDir = join(process.cwd(), relativeDir);
  return readdirSync(absoluteDir).flatMap((entry) => {
    const relativePath = `${relativeDir}/${entry}`;
    const absolutePath = join(process.cwd(), relativePath);

    if (statSync(absolutePath).isDirectory()) {
      return listSourceFiles(relativePath);
    }

    if (!relativePath.endsWith(".ts") && !relativePath.endsWith(".tsx")) {
      return [];
    }

    if (relativePath.endsWith(".test.ts") || relativePath.endsWith(".test.tsx")) {
      return [];
    }

    return [relativePath];
  });
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

function sourceFilesContaining(pattern: RegExp): string[] {
  return listSourceFiles("src")
    .filter((path) => pattern.test(readSource(path)))
    .sort();
}

describe("Phase 10a audio job contract guardrails", () => {
  it("keeps the old direct runtime audio API deleted", () => {
    expect(existsSync(join(process.cwd(), "src/app/api/runtime/generate-audio/route.ts"))).toBe(false);
  });

  it("keeps provider byte generation inside the deferred worker lane only", () => {
    expect(sourceFilesContaining(/generateStoredAudioArtifact/)).toEqual([
      "src/lib/audio/audio-generation-provider.ts",
      "src/lib/audio/audio-generation-service.ts",
    ]);
  });

  it("keeps product code from creating browser-runtime generate_audio state", () => {
    expect(sourceFilesContaining(/browser:[^"`']*generate_audio/)).toEqual([]);
  });

  it("keeps transcript generate_audio payloads out of compose/product asset resolution", () => {
    const assetIndex = readSource("src/hooks/chat/useAssetResolutionIndex.ts");

    expect(assetIndex).not.toContain("GenerateAudioRuntimePayload");
    expect(assetIndex).not.toContain("getAudioPayloadByAssetId");
    expect(assetIndex).not.toContain('part.name === "generate_audio"');
  });

  it("routes media job enqueue through a strategy map instead of compose-only branching", () => {
    const route = readSource("src/app/api/chat/jobs/route.ts");

    expect(route).toContain("MEDIA_JOB_ENQUEUE_STRATEGIES");
    expect(route).toContain("generate_audio");
    expect(route).not.toContain('toolName !== "compose_media"');
    expect(route).not.toContain('toolName === "compose_media"');
  });

  it("keeps chat job clients on canonical job snapshots instead of legacy job.part payloads", () => {
    expect(readSource("src/hooks/chat/useBrowserCapabilityRuntime.ts")).not.toMatch(/job\??\.part/);
    expect(readSource("src/hooks/chat/composeMediaMaterializationCore.ts")).not.toMatch(/job\??\.part/);
  });
});
