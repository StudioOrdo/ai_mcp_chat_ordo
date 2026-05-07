import { loadLocalEnv } from "./load-local-env";
import { getHealthSweepReport } from "../src/lib/admin/processes";

loadLocalEnv();

function main() {
  return getHealthSweepReport().then((report) => {
    if (report.status === "error") {
      process.stderr.write(`${JSON.stringify(report)}\n`);
      process.exit(1);
    }

    process.stdout.write(`${JSON.stringify(report)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
