import { spawnSync } from "node:child_process";

const checks = [
  "check:markdown",
  "check:links",
  "check:skills",
  "check:skill-metadata",
  "check:diff",
  "check:placeholders",
  "check:secrets",
  "check:cef-structure",
  "check:records",
  "test",
];

const failures = [];

for (const check of checks) {
  process.stdout.write(`\n=== ${check} ===\n`);
  const npmCli = process.env.npm_execpath;
  const result = npmCli
    ? spawnSync(process.execPath, [npmCli, "run", check], { stdio: "inherit" })
    : spawnSync("npm", ["run", check], { stdio: "inherit" });

  if (result.status !== 0) {
    failures.push(check);
  }
}

if (failures.length > 0) {
  process.stderr.write(`\nGovernance checks failed: ${failures.join(", ")}\n`);
  process.exit(1);
}

process.stdout.write("\nAll governance checks passed.\n");
