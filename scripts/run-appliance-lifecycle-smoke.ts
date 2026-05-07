import { loadLocalEnv } from "./load-local-env";
import { runApplianceLifecycleSmoke } from "@/lib/appliance/verification/lifecycle-smoke";
import type { ApplianceSmokeMode } from "@/lib/appliance/verification/lifecycle-types";

loadLocalEnv();

const mode = (process.env.APPLIANCE_SMOKE_MODE ?? "local") as ApplianceSmokeMode;
if (!["local", "docker", "compose-single-image"].includes(mode)) {
  throw new Error(`Unsupported APPLIANCE_SMOKE_MODE: ${mode}`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});

async function main(): Promise<void> {
  const result = await runApplianceLifecycleSmoke({
    mode,
    writeEvidence: process.env.APPLIANCE_SMOKE_WRITE_EVIDENCE !== "0",
  });

  process.stdout.write(`${JSON.stringify({
    status: result.evidence.status,
    mode: result.evidence.mode,
    evidencePaths: result.evidencePaths,
    warnings: result.evidence.warnings,
  }, null, 2)}\n`);

  if (result.evidence.status === "failed") {
    process.exit(1);
  }
}
