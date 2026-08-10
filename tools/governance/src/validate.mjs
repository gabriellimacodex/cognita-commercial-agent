import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import GithubSlugger from "github-slugger";
import MarkdownIt from "markdown-it";
import { parse as parseYaml } from "yaml";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, "../../..");
const markdown = new MarkdownIt({ html: true, linkify: false, typographer: false });

const expectedSkills = {
  "cognita-engineering": [
    "../../../AGENTS.md",
    "../../../docs/engineering/constitution.md",
    "../../../docs/engineering/README.md",
    "../../../docs/adr/README.md",
    "../../../docs/engineering/workflows/change-lifecycle.md",
  ],
  "cognita-plan-change": [
    "../../../docs/engineering/workflows/change-lifecycle.md",
    "../../../docs/engineering/checklists/planning.md",
    "../../../docs/engineering/templates/change-plan.md",
  ],
  "cognita-write-adr": [
    "../../../docs/adr/README.md",
    "../../../docs/engineering/workflows/adr-lifecycle.md",
    "../../../docs/engineering/templates/adr.md",
  ],
  "cognita-implement-change": [
    "../../../docs/engineering/workflows/change-lifecycle.md",
    "../../../docs/engineering/checklists/implementation.md",
    "../../../docs/engineering/checklists/self-review.md",
  ],
  "cognita-review-change": [
    "../../../docs/engineering/workflows/code-review.md",
    "../../../docs/engineering/checklists/reviewer.md",
    "../../../docs/engineering/workflows/pull-request.md",
  ],
  "cognita-prepare-pr": [
    "../../../docs/engineering/workflows/pull-request.md",
    "../../../docs/engineering/checklists/self-review.md",
    "../../../.github/PULL_REQUEST_TEMPLATE.md",
    "../../../.github/CODEOWNERS",
  ],
};

const ignoredDirectories = new Set([".git", ".cache", "coverage", "dist", "node_modules"]);

function parseArguments(argv) {
  const command = argv[2];
  const rootIndex = argv.indexOf("--root");
  const root = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : defaultRoot;
  return { command, root };
}

function relative(root, target) {
  return path.relative(root, target).split(path.sep).join("/") || ".";
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...walkFiles(target));
    if (entry.isFile()) files.push(target);
  }
  return files;
}

function finish(label, errors) {
  if (errors.length > 0) {
    process.stderr.write(`${label} failed:\n${errors.map((error) => `- ${error}`).join("\n")}\n`);
    return false;
  }
  process.stdout.write(`${label}: ok\n`);
  return true;
}

function parseFrontmatter(content, file) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter`);
  return parseYaml(match[1]);
}

function markdownTargets(content) {
  const targets = [];
  const visit = (tokens) => {
    for (const token of tokens) {
      if (token.type === "link_open") {
        const href = token.attrGet("href");
        if (href) targets.push(href);
      }
      if (token.type === "image") {
        const src = token.attrGet("src");
        if (src) targets.push(src);
      }
      if (token.children) visit(token.children);
    }
  };
  visit(markdown.parse(content, {}));
  return targets;
}

function headingSlugs(content) {
  const tokens = markdown.parse(content, {});
  const slugger = new GithubSlugger();
  const slugs = new Set();
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type === "heading_open" && tokens[index + 1]?.type === "inline") {
      slugs.add(slugger.slug(tokens[index + 1].content));
    }
  }
  return slugs;
}

export function checkLinks(root) {
  const errors = [];
  const markdownFiles = walkFiles(root).filter((file) => file.endsWith(".md"));
  const slugCache = new Map();

  for (const file of markdownFiles) {
    const content = readFileSync(file, "utf8");
    for (const rawTarget of markdownTargets(content)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget) || rawTarget.startsWith("//")) continue;
      const [rawPath, rawFragment = ""] = rawTarget.split("#", 2);
      const withoutQuery = rawPath.split("?", 1)[0];
      let decodedPath;
      let decodedFragment;
      try {
        decodedPath = decodeURIComponent(withoutQuery);
        decodedFragment = decodeURIComponent(rawFragment);
      } catch {
        errors.push(`${relative(root, file)}: invalid URL encoding in ${rawTarget}`);
        continue;
      }

      const target = decodedPath.length === 0
        ? file
        : decodedPath.startsWith("/")
          ? path.join(root, decodedPath.slice(1))
          : path.resolve(path.dirname(file), decodedPath);

      const targetRelative = path.relative(root, target);
      if (targetRelative === ".." || targetRelative.startsWith(`..${path.sep}`)) {
        errors.push(`${relative(root, file)}: relative target escapes repository (${rawTarget})`);
        continue;
      }

      if (!existsSync(target)) {
        errors.push(`${relative(root, file)}: missing relative target ${rawTarget}`);
        continue;
      }

      if (decodedFragment && statSync(target).isFile() && target.endsWith(".md")) {
        if (!slugCache.has(target)) slugCache.set(target, headingSlugs(readFileSync(target, "utf8")));
        if (!slugCache.get(target).has(decodedFragment)) {
          errors.push(`${relative(root, file)}: missing heading #${decodedFragment} in ${relative(root, target)}`);
        }
      }
    }
  }

  return finish("relative-links", errors);
}

export function checkSkills(root) {
  const errors = [];
  const skillsRoot = path.join(root, ".agents/skills");
  const actual = existsSync(skillsRoot)
    ? readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    : [];
  const expected = Object.keys(expectedSkills).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`expected Skills ${expected.join(", ")}; found ${actual.join(", ") || "none"}`);
  }

  for (const [name, references] of Object.entries(expectedSkills)) {
    const skillFile = path.join(skillsRoot, name, "SKILL.md");
    if (!existsSync(skillFile)) {
      errors.push(`${relative(root, skillFile)}: missing`);
      continue;
    }
    const content = readFileSync(skillFile, "utf8");
    try {
      const metadata = parseFrontmatter(content, relative(root, skillFile));
      if (metadata?.name !== name) errors.push(`${relative(root, skillFile)}: frontmatter name must equal ${name}`);
      if (typeof metadata?.description !== "string" || metadata.description.trim().length < 40) {
        errors.push(`${relative(root, skillFile)}: description must be specific and non-empty`);
      }
    } catch (error) {
      errors.push(error.message);
    }
    if (name !== "cognita-engineering" && !content.includes("$cognita-engineering")) {
      errors.push(`${relative(root, skillFile)}: must delegate first to $cognita-engineering`);
    }
    for (const reference of references) {
      if (!content.includes(`\`${reference}\``)) {
        errors.push(`${relative(root, skillFile)}: missing canonical reference ${reference}`);
      }
      const target = path.resolve(path.dirname(skillFile), reference);
      if (!existsSync(target)) errors.push(`${relative(root, skillFile)}: unresolved reference ${reference}`);
    }
  }

  return finish("skills", errors);
}

export function checkSkillMetadata(root) {
  const errors = [];
  for (const name of Object.keys(expectedSkills)) {
    const metadataFile = path.join(root, ".agents/skills", name, "agents/openai.yaml");
    if (!existsSync(metadataFile)) {
      errors.push(`${relative(root, metadataFile)}: missing`);
      continue;
    }
    try {
      const metadata = parseYaml(readFileSync(metadataFile, "utf8"));
      const ui = metadata?.interface;
      for (const field of ["display_name", "short_description", "default_prompt"]) {
        if (typeof ui?.[field] !== "string" || ui[field].trim() === "") {
          errors.push(`${relative(root, metadataFile)}: interface.${field} must be a non-empty string`);
        }
      }
      if (typeof ui?.default_prompt === "string" && !ui.default_prompt.includes(`$${name}`)) {
        errors.push(`${relative(root, metadataFile)}: default_prompt must invoke $${name}`);
      }
    } catch (error) {
      errors.push(`${relative(root, metadataFile)}: invalid YAML (${error.message})`);
    }
  }
  return finish("skill-metadata", errors);
}

function runGit(root, args, errors) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    errors.push(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
}

export function checkDiff(root) {
  const errors = [];
  runGit(root, ["diff", "--check"], errors);
  runGit(root, ["diff", "--cached", "--check"], errors);

  let base = process.env.CEF_BASE_SHA;
  if (!base) {
    const result = spawnSync("git", ["merge-base", "HEAD", "origin/main"], { cwd: root, encoding: "utf8" });
    if (result.status === 0) base = result.stdout.trim();
  }
  if (base) runGit(root, ["diff", "--check", `${base}...HEAD`], errors);

  return finish("git-diff-check", errors);
}

export function checkPlaceholders(root) {
  const errors = [];
  const textExtensions = new Set([".cjs", ".env", ".example", ".js", ".json", ".jsonc", ".md", ".mjs", ".sh", ".txt", ".yaml", ".yml"]);
  const markerNames = [
    ["TO", "DO"].join(""),
    ["T", "BD"].join(""),
    ["FIX", "ME"].join(""),
    ["X", "XX"].join(""),
    ["CHANGE", "ME"].join(""),
  ];
  const marker = new RegExp(`\\b(?:${markerNames.join("|")})\\b|\\bYOUR_[A-Z0-9_]+\\b|<REPLACE(?:D|_ME)?>`, "g");
  const ignored = ["docs/engineering/templates/", ".github/PULL_REQUEST_TEMPLATE.md"];

  for (const file of walkFiles(root)) {
    const rel = relative(root, file);
    if (ignored.some((prefix) => rel === prefix || rel.startsWith(prefix))) continue;
    if (!textExtensions.has(path.extname(file)) && path.basename(file) !== ".env.example") continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      marker.lastIndex = 0;
      if (marker.test(line)) errors.push(`${rel}:${index + 1}: prohibited placeholder marker`);
    });
  }

  return finish("placeholders", errors);
}

function checkActionReferences(root, workflowFiles, errors) {
  for (const file of workflowFiles) {
    const content = readFileSync(file, "utf8");
    if (/\bpull_request_target\b/.test(content)) {
      errors.push(`${relative(root, file)}: pull_request_target is prohibited`);
    }
    for (const match of content.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)) {
      const reference = match[1].replace(/^['"]|['"]$/g, "");
      if (reference.startsWith("./")) continue;
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/.test(reference)) {
        errors.push(`${relative(root, file)}: Action must use a full commit SHA (${reference})`);
      }
    }
  }
}

export function checkCefStructure(root) {
  const errors = [];
  const required = [
    "AGENTS.md",
    ".agents/skills",
    ".github/CODEOWNERS",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/rulesets/main.json",
    "docs/adr/README.md",
    "docs/engineering/README.md",
    "docs/engineering/constitution.md",
    "docs/engineering/checklists",
    "docs/engineering/conventions",
    "docs/engineering/standards",
    "docs/engineering/templates",
    "docs/engineering/workflows",
    "docs/rfcs/README.md",
  ];
  for (const item of required) {
    if (!existsSync(path.join(root, item))) errors.push(`${item}: required CEF path is missing`);
  }

  const rulesetPath = path.join(root, ".github/rulesets/main.json");
  if (existsSync(rulesetPath)) {
    try {
      const ruleset = JSON.parse(readFileSync(rulesetPath, "utf8"));
      const ruleByType = new Map((ruleset.rules || []).map((rule) => [rule.type, rule]));
      const bypass = ruleset.bypass_actors || [];
      const pullRequest = ruleByType.get("pull_request")?.parameters;
      const statusChecks = ruleByType.get("required_status_checks")?.parameters;

      if (ruleset.name !== "main-protection-single-maintainer") {
        errors.push(".github/rulesets/main.json: unexpected Ruleset name");
      }
      if (ruleset.target !== "branch") errors.push(".github/rulesets/main.json: target must be branch");
      if (!["disabled", "active"].includes(ruleset.enforcement)) {
        errors.push(".github/rulesets/main.json: enforcement must be disabled or active");
      }
      if (JSON.stringify(ruleset.conditions?.ref_name) !== JSON.stringify({ include: ["~DEFAULT_BRANCH"], exclude: [] })) {
        errors.push(".github/rulesets/main.json: Ruleset must target only the default branch");
      }
      if (JSON.stringify(bypass) !== JSON.stringify([{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request" }])) {
        errors.push(".github/rulesets/main.json: bypass must be limited to the administrator role in pull_request mode");
      }
      if (!ruleByType.has("deletion")) errors.push(".github/rulesets/main.json: deletion protection is required");
      if (!ruleByType.has("non_fast_forward")) errors.push(".github/rulesets/main.json: force-push protection is required");
      if (!pullRequest) {
        errors.push(".github/rulesets/main.json: pull_request rule is required");
      } else {
        if (pullRequest.required_approving_review_count !== 0) {
          errors.push(".github/rulesets/main.json: Single Maintainer requires zero approvals");
        }
        if (pullRequest.require_code_owner_review !== false || pullRequest.require_last_push_approval !== false) {
          errors.push(".github/rulesets/main.json: nonexistent independent approvals must not be required");
        }
        if (pullRequest.required_review_thread_resolution !== true) {
          errors.push(".github/rulesets/main.json: conversation resolution is required");
        }
      }
      if (!statusChecks) {
        errors.push(".github/rulesets/main.json: required_status_checks rule is required");
      } else {
        if (statusChecks.strict_required_status_checks_policy !== true) {
          errors.push(".github/rulesets/main.json: the branch must be current before merge");
        }
        if (JSON.stringify(statusChecks.required_status_checks) !== JSON.stringify([{ context: "CEF Governance", integration_id: 15368 }])) {
          errors.push(".github/rulesets/main.json: CEF Governance must be the only required check and come from GitHub Actions");
        }
      }
    } catch (error) {
      errors.push(`.github/rulesets/main.json: invalid JSON (${error.message})`);
    }
  }

  const agentPortal = existsSync(path.join(root, "AGENTS.md")) ? readFileSync(path.join(root, "AGENTS.md"), "utf8") : "";
  for (const name of Object.keys(expectedSkills)) {
    if (!agentPortal.includes(`\`${name}\``)) errors.push(`AGENTS.md: missing official Skill ${name}`);
  }

  const yamlFiles = walkFiles(root).filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"));
  for (const file of yamlFiles) {
    try {
      parseYaml(readFileSync(file, "utf8"));
    } catch (error) {
      errors.push(`${relative(root, file)}: invalid YAML (${error.message})`);
    }
  }
  const workflowRoot = path.join(root, ".github/workflows");
  const workflowFiles = walkFiles(workflowRoot).filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"));
  checkActionReferences(root, workflowFiles, errors);

  const governanceWorkflow = path.join(workflowRoot, "cef-governance.yml");
  if (!existsSync(governanceWorkflow)) {
    errors.push(".github/workflows/cef-governance.yml: required workflow is missing");
  } else {
    const content = readFileSync(governanceWorkflow, "utf8");
    const parsed = parseYaml(content);
    if (JSON.stringify(parsed?.permissions) !== JSON.stringify({ contents: "read" })) {
      errors.push(".github/workflows/cef-governance.yml: permissions must be exactly contents: read");
    }
    if (parsed?.jobs?.governance?.name !== "CEF Governance") {
      errors.push(".github/workflows/cef-governance.yml: stable job name must be CEF Governance");
    }
    if (parsed?.jobs?.governance?.["runs-on"] !== "ubuntu-24.04") {
      errors.push(".github/workflows/cef-governance.yml: governance job must use ubuntu-24.04");
    }
    if (content.includes("${{ secrets.")) {
      errors.push(".github/workflows/cef-governance.yml: basic governance workflow must not use secrets");
    }
    if (/runs-on:\s*.*self-hosted/.test(content)) {
      errors.push(".github/workflows/cef-governance.yml: self-hosted runner is prohibited");
    }
    if (!content.includes("persist-credentials: false")) {
      errors.push(".github/workflows/cef-governance.yml: checkout credentials must not persist");
    }
    if (!content.includes("run: npm run check")) {
      errors.push(".github/workflows/cef-governance.yml: workflow must execute the canonical local command");
    }
  }

  return finish("cef-structure", errors);
}

function parseIndexRows(content, digits, columns) {
  const rows = [];
  const expression = columns === 3
    ? new RegExp(`^\\| \\[(\\d{${digits}})\\]\\(([^)]+)\\) \\| ([^|]+) \\| ([^|]+) \\|$`, "gm")
    : new RegExp(`^\\| \\[(\\d{${digits}})\\]\\(([^)]+)\\) \\| ([^|]+) \\| ([^|]+) \\| ([^|]+) \\|$`, "gm");
  for (const match of content.matchAll(expression)) {
    rows.push({ id: match[1], file: match[2], title: match[3].trim(), status: match[4].trim(), disposition: match[5]?.trim() });
  }
  return rows;
}

export function checkRecords(root) {
  const errors = [];
  const adrRoot = path.join(root, "docs/adr");
  const adrIndex = path.join(adrRoot, "README.md");
  const allowedAdrStatuses = new Set(["Proposed", "Accepted", "Rejected", "Deprecated", "Superseded"]);
  const adrRows = existsSync(adrIndex) ? parseIndexRows(readFileSync(adrIndex, "utf8"), 3, 3) : [];
  const adrFiles = existsSync(adrRoot) ? readdirSync(adrRoot).filter((file) => /^\d{3}-.+\.md$/.test(file)).sort() : [];
  if (adrRows.length !== adrFiles.length) errors.push(`docs/adr: index has ${adrRows.length} entries for ${adrFiles.length} ADR files`);
  for (const file of adrFiles) {
    const id = file.slice(0, 3);
    const row = adrRows.find((candidate) => candidate.id === id);
    const content = readFileSync(path.join(adrRoot, file), "utf8");
    if (!row || row.file !== file) errors.push(`docs/adr/${file}: missing or mismatched index entry`);
    const title = content.match(new RegExp(`^# ADR ${id} — (.+)$`, "m"));
    const status = content.match(/^- \*\*Status:\*\* (.+)$/m)?.[1];
    if (!title) errors.push(`docs/adr/${file}: title must match ADR ${id}`);
    if (row && title && row.title !== title[1]) errors.push(`docs/adr/${file}: index title differs from document title`);
    if (!status || !allowedAdrStatuses.has(status)) errors.push(`docs/adr/${file}: invalid status ${status || "missing"}`);
    if (row && row.status !== status) errors.push(`docs/adr/${file}: index status ${row.status} differs from ${status}`);
    for (const heading of ["Contexto", "Problema", "Restrições", "Alternativas consideradas", "Decisão", "Consequências positivas", "Consequências negativas", "Riscos", "Adoção", "Reversão", "Referências"]) {
      if (!content.includes(`## ${heading}`)) errors.push(`docs/adr/${file}: missing section ${heading}`);
    }
  }

  const rfcRoot = path.join(root, "docs/rfcs");
  const rfcIndex = path.join(rfcRoot, "README.md");
  const allowedRfcStatuses = new Set(["Draft", "In Review", "Final", "Withdrawn", "Superseded"]);
  const rfcRows = existsSync(rfcIndex) ? parseIndexRows(readFileSync(rfcIndex, "utf8"), 4, 4) : [];
  const rfcFiles = existsSync(rfcRoot) ? readdirSync(rfcRoot).filter((file) => /^\d{4}-.+\.md$/.test(file)).sort() : [];
  if (rfcRows.length !== rfcFiles.length) errors.push(`docs/rfcs: index has ${rfcRows.length} entries for ${rfcFiles.length} RFC files`);
  for (const file of rfcFiles) {
    const id = file.slice(0, 4);
    const row = rfcRows.find((candidate) => candidate.id === id);
    const content = readFileSync(path.join(rfcRoot, file), "utf8");
    if (!row || row.file !== file) errors.push(`docs/rfcs/${file}: missing or mismatched index entry`);
    if (!new RegExp(`^# RFC-${id} — `, "m").test(content)) errors.push(`docs/rfcs/${file}: title must match RFC-${id}`);
    const title = content.match(new RegExp(`^# RFC-${id} — (.+)$`, "m"));
    if (row && title && row.title !== title[1]) errors.push(`docs/rfcs/${file}: index title differs from document title`);
    const status = content.match(/^- \*\*Status:\*\* (.+)$/m)?.[1];
    if (!status || !allowedRfcStatuses.has(status)) errors.push(`docs/rfcs/${file}: invalid status ${status || "missing"}`);
    if (row && row.status !== status) errors.push(`docs/rfcs/${file}: index status ${row.status} differs from ${status}`);
    if (row && !row.disposition) errors.push(`docs/rfcs/${file}: index disposition is required`);
    if (!/^- \*\*Efeito normativo:\*\* não autorizador$/m.test(content)) {
      errors.push(`docs/rfcs/${file}: RFC must declare non-authorizing normative effect`);
    }
  }

  return finish("architecture-records", errors);
}

const commands = {
  links: checkLinks,
  skills: checkSkills,
  "skill-metadata": checkSkillMetadata,
  diff: checkDiff,
  placeholders: checkPlaceholders,
  "cef-structure": checkCefStructure,
  records: checkRecords,
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { command, root } = parseArguments(process.argv);
  if (!commands[command]) {
    process.stderr.write(`Unknown validation command: ${command || "missing"}\n`);
    process.exit(2);
  }
  process.exit(commands[command](root) ? 0 : 1);
}
