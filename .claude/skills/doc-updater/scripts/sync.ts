import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

type CodemapSummary = {
  generatedAt: string;
  canonicalRoot: string;
  totalDomains: number;
  totalSubsystems: number;
  totalTopics: number;
  totalModules: number;
  byDomain: Record<string, { subsystems: number; topics: number; modules: number }>;
};

function run(command: string): void {
  console.log(`[docs:sync] run: ${command}`);
  execSync(command, { stdio: "inherit" });
}

async function readSummary(projectRoot: string): Promise<CodemapSummary | null> {
  const target = path.join(projectRoot, "docs", "_meta", "codemap-summary.json");
  try {
    const raw = await fs.readFile(target, "utf8");
    return JSON.parse(raw) as CodemapSummary;
  } catch {
    return null;
  }
}

async function writeChecklist(projectRoot: string, summary: CodemapSummary | null): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const target = path.join(projectRoot, "docs", "_meta", "docs-sync-checklist.md");
  const lines: string[] = [
    "# Docs Sync Checklist",
    "",
    `- Generated At: \`${new Date().toISOString()}\``,
    "- Pipeline: `docs:codemap` -> `docs:index`",
    "",
    "## Execution Status",
    "- [x] Codemap generated",
    "- [x] Link index generated",
    "- [ ] Governance review by `documentation-maintainer`",
    "",
    "## Artifact Pointers",
    "- Codemap root: `docs/development/00-overview/codemaps/`",
    "- Link index: `docs/_meta/link-index.json`",
    "- Codemap summary: `docs/_meta/codemap-summary.json`",
    "",
  ];

  if (summary) {
    lines.push("## Codemap Snapshot");
    lines.push(`- Canonical Root: \`${summary.canonicalRoot}\``);
    lines.push(`- Total Domains: \`${summary.totalDomains}\``);
    lines.push(`- Total Subsystems: \`${summary.totalSubsystems}\``);
    lines.push(`- Total Topics: \`${summary.totalTopics}\``);
    lines.push(`- Total Modules: \`${summary.totalModules}\``);
    lines.push("");
    lines.push("## Domain Breakdown");
    for (const [domain, stat] of Object.entries(summary.byDomain).sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`- \`${domain}\`: ${stat.subsystems} subsystems, ${stat.topics} topics, ${stat.modules} modules`);
    }
    lines.push("");
  }

  lines.push("## Governance Handoff (Required)");
  lines.push("- [ ] Validate canonical vs mirror path consistency");
  lines.push("- [ ] Validate split thresholds and oversized pages");
  lines.push("- [ ] Validate assumptions and unresolved items");
  lines.push("- [ ] Publish final decision (pass/rework)");
  lines.push("");
  lines.push("## Runbook");
  lines.push("```bash");
  lines.push("npm run docs:sync");
  lines.push("```");
  lines.push("");
  lines.push(`> Last sync day: ${date}`);

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${lines.join("\n")}\n`, "utf8");
}

async function main(): Promise<void> {
  const projectRoot = process.cwd();

  run("npm run docs:codemap");
  run("npm run docs:index");

  const summary = await readSummary(projectRoot);
  await writeChecklist(projectRoot, summary);
  console.log("[docs:sync] done. checklist generated at docs/_meta/docs-sync-checklist.md");
}

main().catch((error) => {
  console.error("[docs:sync] failed", error);
  process.exitCode = 1;
});

