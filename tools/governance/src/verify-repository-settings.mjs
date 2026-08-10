import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const repository = process.env.CEF_GITHUB_REPOSITORY || "gabriellimacodex/cognita-commercial-agent";
const desiredPath = path.join(root, ".github/rulesets/main.json");

function ghJson(endpoint) {
  const result = spawnSync("gh", ["api", endpoint], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `gh api ${endpoint} failed`);
  return JSON.parse(result.stdout);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !["_links", "created_at", "id", "node_id", "source", "source_type", "updated_at"].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

const desired = JSON.parse(readFileSync(desiredPath, "utf8"));
const summaries = ghJson(`repos/${repository}/rulesets`);
const summary = summaries.find((item) => item.name === desired.name);
if (!summary) throw new Error(`Ruleset ${desired.name} does not exist`);
const actual = ghJson(`repos/${repository}/rulesets/${summary.id}`);

const desiredStable = JSON.stringify(stable(desired));
const actualStable = JSON.stringify(stable(actual));
if (desiredStable !== actualStable) {
  process.stderr.write(`Ruleset drift detected.\nDesired: ${desiredStable}\nActual:  ${actualStable}\n`);
  process.exit(1);
}

const actions = ghJson(`repos/${repository}/actions/permissions`);
const workflow = ghJson(`repos/${repository}/actions/permissions/workflow`);
const errors = [];
if (!actions.enabled) errors.push("GitHub Actions must be enabled");
if (!actions.sha_pinning_required) errors.push("full SHA pinning must be required");
if (workflow.default_workflow_permissions !== "read") errors.push("GITHUB_TOKEN default permission must be read");
if (workflow.can_approve_pull_request_reviews !== false) errors.push("workflows must not approve pull requests");

if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`repository-settings: ok (${repository}, ruleset ${summary.id})\n`);
