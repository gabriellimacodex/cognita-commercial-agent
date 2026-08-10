import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(toolRoot, "../..");
const validator = path.join(toolRoot, "src/validate.mjs");

function temporaryDirectory() {
  const temporaryRoot = path.join(toolRoot, ".test-tmp");
  mkdirSync(temporaryRoot, { recursive: true });
  const directory = mkdtempSync(path.join(temporaryRoot, "fixture-"));
  test.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function run(command, root, env = {}) {
  return spawnSync(process.execPath, [validator, command, "--root", root], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function createSkillFixture(root) {
  cpSync(path.join(repoRoot, ".agents"), path.join(root, ".agents"), { recursive: true });
  const references = new Set();
  for (const name of readdirSync(path.join(root, ".agents/skills"))) {
    const skillFile = path.join(root, ".agents/skills", name, "SKILL.md");
    for (const match of readFileSync(skillFile, "utf8").matchAll(/`(\.\.\/\.\.\/\.\.\/[^`]+)`/g)) {
      references.add(path.resolve(path.dirname(skillFile), match[1]));
    }
  }
  for (const reference of references) {
    mkdirSync(path.dirname(reference), { recursive: true });
    if (!path.extname(reference)) mkdirSync(reference, { recursive: true });
    else if (!readable(reference)) writeFileSync(reference, "# Fixture\n");
  }
}

function createCefFixture(root) {
  for (const entry of [".agents", ".github", "docs"]) {
    cpSync(path.join(repoRoot, entry), path.join(root, entry), { recursive: true });
  }
  cpSync(path.join(repoRoot, "AGENTS.md"), path.join(root, "AGENTS.md"));
}

function readable(file) {
  try {
    readFileSync(file);
    return true;
  } catch {
    return false;
  }
}

test("current repository passes structural validators", () => {
  for (const command of ["links", "skills", "skill-metadata", "placeholders", "cef-structure", "records"]) {
    const result = run(command, repoRoot);
    assert.equal(result.status, 0, `${command}: ${result.stderr}`);
  }
});

test("broken relative Markdown link fails", () => {
  const root = temporaryDirectory();
  writeFileSync(path.join(root, "README.md"), "# Valid title\n\n[missing](missing.md)\n");
  const result = run("links", root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing relative target/);
});

test("invalid Skill frontmatter fails", () => {
  const root = temporaryDirectory();
  createSkillFixture(root);
  const target = path.join(root, ".agents/skills/cognita-engineering/SKILL.md");
  writeFileSync(target, readFileSync(target, "utf8").replace("name: cognita-engineering", "name: wrong-name"));
  const result = run("skills", root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /frontmatter name/);
});

test("invalid openai YAML fails", () => {
  const root = temporaryDirectory();
  createSkillFixture(root);
  writeFileSync(path.join(root, ".agents/skills/cognita-engineering/agents/openai.yaml"), "interface: [\n");
  const result = run("skill-metadata", root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid YAML/);
});

test("unsafe Single Maintainer Ruleset fails", () => {
  const root = temporaryDirectory();
  createCefFixture(root);
  const target = path.join(root, ".github/rulesets/main.json");
  const ruleset = JSON.parse(readFileSync(target, "utf8"));
  ruleset.bypass_actors[0].bypass_mode = "always";
  writeFileSync(target, `${JSON.stringify(ruleset, null, 2)}\n`);
  const result = run("cef-structure", root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /bypass must be limited/);
});

test("prohibited placeholder marker fails", () => {
  const root = temporaryDirectory();
  const marker = ["TO", "DO"].join("");
  writeFileSync(path.join(root, "README.md"), `# Title\n\n${marker}: unresolved\n`);
  const result = run("placeholders", root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /prohibited placeholder marker/);
});

test("generated product directories are excluded from structural scans", () => {
  const root = temporaryDirectory();
  const marker = ["TO", "DO"].join("");
  for (const directory of [".cache", ".next", "coverage", "dist", "node_modules"]) {
    const target = path.join(root, directory);
    mkdirSync(target, { recursive: true });
    writeFileSync(path.join(target, "generated.js"), `${marker}: generated artifact\n`);
  }

  const result = run("placeholders", root);

  assert.equal(result.status, 0, result.stderr);
});

test("git whitespace violation fails", () => {
  const root = temporaryDirectory();
  const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(git("init", "-b", "main").status, 0);
  assert.equal(git("config", "user.email", "governance-test@example.invalid").status, 0);
  assert.equal(git("config", "user.name", "Governance Test").status, 0);
  writeFileSync(path.join(root, "README.md"), "# Clean\n");
  assert.equal(git("add", "README.md").status, 0);
  assert.equal(git("commit", "-m", "test: initialize fixture").status, 0);
  const base = git("rev-parse", "HEAD").stdout.trim();
  writeFileSync(path.join(root, "README.md"), "# Dirty   \n");
  const result = run("diff", root, { CEF_BASE_SHA: base });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /whitespace errors|trailing whitespace/);
});

test("synthetic secret is rejected by secretlint", () => {
  const root = temporaryDirectory();
  const secret = ["gh", "p_", "A".repeat(36)].join("");
  const fixture = path.join(root, "credential.txt");
  writeFileSync(fixture, `TOKEN=${secret}\n`);
  const executable = path.join(toolRoot, "node_modules/.bin/secretlint");
  const result = spawnSync(executable, ["--no-gitignore", "--secretlintrc", path.join(repoRoot, ".secretlintrc.json"), fixture], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 1, result.stdout || result.stderr);
});

test("invalid Markdown formatting is rejected", () => {
  const root = temporaryDirectory();
  const fixture = path.join(root, "bad.md");
  writeFileSync(fixture, "#Title\n");
  const executable = path.join(toolRoot, "node_modules/.bin/markdownlint-cli2");
  const result = spawnSync(executable, ["--config", path.join(repoRoot, ".markdownlint-cli2.jsonc"), fixture], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 1, result.stdout || result.stderr);
});
