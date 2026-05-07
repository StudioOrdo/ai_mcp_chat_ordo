import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("appliance image release CLI", () => {
  it("is exposed through package scripts with Rust release helpers", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["appliance:release"]).toBe("tsx scripts/run-appliance-image-release.ts");
    expect(pkg.scripts["release:manifest"]).toBe("node scripts/generate-release-manifest.mjs");
    expect(pkg.scripts["rust:fmt"]).toBe("cargo fmt --check");
    expect(pkg.scripts["rust:test"]).toBe("cargo test -p ordo-backup");
    expect(pkg.scripts["rust:clippy"]).toBe("cargo clippy -p ordo-backup -- -D warnings");
  });

  it("supports the required local release flags", () => {
    const script = readFileSync(join(process.cwd(), "scripts/run-appliance-image-release.ts"), "utf-8");

    expect(script).toContain("--allow-missing-scanners");
    expect(script).toContain("--full-test");
    expect(script).toContain("--keep-image");
    expect(script).toContain("--tag");
    expect(script).toContain("--sign");
    expect(script).toContain("--skip-sign");
  });
});
