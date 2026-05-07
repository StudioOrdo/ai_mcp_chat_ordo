import fs from "node:fs";
import path from "node:path";

const OUTPUT_FILE = "ordo_llm_export.txt";
const ROOT_DIR = process.cwd();

/** Directories to skip entirely */
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".data",
  ".lighthouseci",
  "test-results",
  "release",
  "test-results",
  "coverage",
]);

/** File extensions to skip (binaries, assets) */
const EXCLUDED_EXTENSIONS = new Set([
  ".mp3", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot", ".zip", ".pdf", ".map", ".mp4", ".webm",
]);

/** Specific files in the root that we WANT to include */
const INCLUDED_ROOT_FILES = new Set([
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "README.md",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "stylelint.config.mjs",
  "vitest.config.ts",
  "next-env.d.ts",
  "playwright.config.ts",
  "Dockerfile",
  "compose.yaml",
]);

/** Subdirectories we want to recursively crawl */
const INCLUDED_DIRS = new Set([
  "src",
  "docs",
  "mcp",
  "tests",
  "config",
  "scripts",
]);

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);

  // Exclude environment files to prevent secret leakage
  if (basename.startsWith(".env")) return false;
  // Exclude common binary/asset types
  if (EXCLUDED_EXTENSIONS.has(ext)) return false;
  // Exclude lock files (too large/noisy)
  if (basename === "package-lock.json" || basename === "yarn.lock" || basename === "pnpm-lock.yaml") return false;

  return true;
}

function walk(dir: string, callback: (filePath: string) => void) {
  const items = fs.readdirSync(dir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(ROOT_DIR, fullPath);

    if (item.isDirectory()) {
      if (EXCLUDED_DIRS.has(item.name)) continue;
      walk(fullPath, callback);
    } else if (item.isFile()) {
      const isRootFile = path.dirname(fullPath) === ROOT_DIR;

      if (isRootFile) {
        if (INCLUDED_ROOT_FILES.has(item.name)) {
          callback(fullPath);
        }
      } else {
        const topDir = relativePath.split(path.sep)[0];
        if (INCLUDED_DIRS.has(topDir)) {
          if (isTextFile(fullPath)) {
            callback(fullPath);
          }
        }
      }
    }
  }
}

function run() {
  const outputFilePath = path.join(ROOT_DIR, OUTPUT_FILE);
  const outputStream = fs.createWriteStream(outputFilePath);

  outputStream.write(`--- ORDO PROJECT EXPORT ---\n`);
  outputStream.write(`Generated: ${new Date().toISOString()}\n`);
  outputStream.write(`---------------------------\n\n`);

  console.log(`Starting export to ${OUTPUT_FILE}...`);

  let fileCount = 0;

  walk(ROOT_DIR, (fullPath) => {
    const relativePath = path.relative(ROOT_DIR, fullPath);
    console.log(`  + ${relativePath}`);

    try {
      const content = fs.readFileSync(fullPath, "utf8");
      outputStream.write(`\n\n--- FILE: ${relativePath} ---\n\n`);
      outputStream.write(content);
      fileCount++;
    } catch (err) {
      console.error(`  ! Failed to read ${relativePath}:`, err);
    }
  });

  outputStream.end(() => {
    console.log(`\nExport complete! Concatenated ${fileCount} files into ${OUTPUT_FILE}.`);
  });
}

run();
