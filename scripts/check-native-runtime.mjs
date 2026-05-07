import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const requestedModules = process.argv.slice(2);
const moduleNames = requestedModules.length > 0 ? requestedModules : ["better-sqlite3"];
const supportedNodeMajor = 22;

function formatRuntime() {
  return [
    `node=${process.version}`,
    `modules=${process.versions.modules}`,
    `execPath=${process.execPath}`,
  ].join(" ");
}

let failed = false;

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);
if (nodeMajor !== supportedNodeMajor) {
  failed = true;
  process.stderr.write(
    [
      `[native-runtime] Unsupported Node.js major version ${process.version}.`,
      `[native-runtime] Runtime: ${formatRuntime()}`,
      `[native-runtime] Ordo native dependencies are built and tested on Node ${supportedNodeMajor}.`,
      "[native-runtime] Switch to the repo Node version from .nvmrc/.node-version, then run: npm rebuild better-sqlite3",
    ].join("\n") + "\n",
  );
}

for (const moduleName of moduleNames) {
  try {
    require(moduleName);
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    const installGuidance = message.includes("Cannot find module")
      ? "[native-runtime] Missing package from node_modules. Run: npm install"
      : "[native-runtime] This usually means node_modules was installed or rebuilt with a different Node.js major version.";
    const rebuildGuidance = message.includes("Cannot find module")
      ? "[native-runtime] If this is running in Docker, rebuild the image after package-lock.json changes."
      : "[native-runtime] Use Node 22 for this repo, then run: npm rebuild better-sqlite3";
    process.stderr.write(
      [
        `[native-runtime] Failed to load ${moduleName}.`,
        `[native-runtime] Runtime: ${formatRuntime()}`,
        `[native-runtime] ${message}`,
        installGuidance,
        rebuildGuidance,
      ].join("\n") + "\n",
    );
  }
}

if (failed) {
  process.exit(1);
}
