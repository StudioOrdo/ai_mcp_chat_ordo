#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const source = resolve("target", "release", "ordo-backup");
const destination = resolve("bin", "ordo-backup");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("cargo", ["build", "--release", "-p", "ordo-backup"]);

mkdirSync(dirname(destination), { recursive: true });
rmSync(destination, { force: true });
if (process.platform === "darwin") {
  symlinkSync(relative(dirname(destination), source), destination);
} else {
  copyFileSync(source, destination);
  chmodSync(destination, 0o755);
}

console.info(`[backup-executor] installed ${destination}`);
