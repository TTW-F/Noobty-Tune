import { promises as fs } from "node:fs";
import path from "node:path";

type Domain = "frontend" | "backend" | "database" | "integrations" | "workers";

type SourceModule = {
  filePath: string;
  relativePath: string;
  domain: Domain;
  subsystem: string;
  topic: string;
  imports: string[];
  exports: string[];
};

type TopicGroup = {
  topic: string;
  modules: SourceModule[];
};

type SubsystemGroup = {
  subsystem: string;
  topics: Map<string, TopicGroup>;
};

type DomainGroup = {
  domain: Domain;
  subsystems: Map<string, SubsystemGroup>;
};

type GeneratorOptions = {
  srcDir: string;
  outputDir: string;
  legacyMirrorDir: string | null;
  maxLeafModules: number;
};

const DOMAIN_ORDER: Domain[] = [
  "frontend",
  "backend",
  "database",
  "integrations",
  "workers",
];

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const args = new Set(process.argv.slice(2));

  const options: GeneratorOptions = {
    srcDir: path.join(projectRoot, "src"),
    outputDir: path.join(projectRoot, "docs", "development", "00-overview", "codemaps"),
    legacyMirrorDir: args.has("--mirror-legacy")
      ? path.join(projectRoot, "docs", "CODEMAPS")
      : null,
    maxLeafModules: readIntEnv("CODEMAP_LEAF_MAX_MODULES", 12),
  };

  await ensureDirectory(options.srcDir);
  const sourceFiles = await collectSourceFiles(options.srcDir);
  const modules = await Promise.all(sourceFiles.map((filePath) => analyzeModule(filePath, options.srcDir)));
  const grouped = groupModules(modules);

  await rmAndRecreate(options.outputDir);
  await writeCodemapTree(grouped, options.outputDir, options.maxLeafModules);
  const summary = buildSummary(grouped);
  await writeSummary(projectRoot, summary);

  if (options.legacyMirrorDir) {
    await rmAndRecreate(options.legacyMirrorDir);
    await writeLegacyMirror(grouped, options.legacyMirrorDir);
  }

  console.log(
    `[codemap] done. modules=${summary.totalModules}, domains=${summary.totalDomains}, subsystems=${summary.totalSubsystems}`,
  );
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function rmAndRecreate(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
  await fs.mkdir(dirPath, { recursive: true });
}

async function collectSourceFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (CODE_EXTENSIONS.has(ext)) files.push(fullPath);
    }
  }

  await walk(rootDir);
  return files.sort((a, b) => a.localeCompare(b));
}

async function analyzeModule(filePath: string, srcRoot: string): Promise<SourceModule> {
  const content = await fs.readFile(filePath, "utf8");
  const relativePath = toPosixPath(path.relative(srcRoot, filePath));
  const segments = relativePath.split("/");

  const imports = parseImports(content);
  const exports = parseExports(content);

  const domain = classifyDomain(relativePath, segments);
  const subsystem = classifySubsystem(segments);
  const topic = classifyTopic(segments, filePath);

  return {
    filePath,
    relativePath,
    domain,
    subsystem,
    topic,
    imports,
    exports,
  };
}

function parseImports(content: string): string[] {
  const set = new Set<string>();
  const fromRegex = /from\s+["']([^"']+)["']/g;
  const sideEffectRegex = /import\s+["']([^"']+)["']/g;
  for (const regex of [fromRegex, sideEffectRegex]) {
    let match: RegExpExecArray | null = regex.exec(content);
    while (match) {
      set.add(match[1]);
      match = regex.exec(content);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function parseExports(content: string): string[] {
  const set = new Set<string>();
  const namedRegex = /export\s+(?:const|function|class|type|interface|enum)\s+([A-Za-z0-9_]+)/g;
  const listRegex = /export\s*\{([^}]+)\}/g;

  let named = namedRegex.exec(content);
  while (named) {
    set.add(named[1]);
    named = namedRegex.exec(content);
  }

  let listed = listRegex.exec(content);
  while (listed) {
    for (const item of listed[1].split(",")) {
      const clean = item.replace(/\s+as\s+.+$/, "").trim();
      if (clean) set.add(clean);
    }
    listed = listRegex.exec(content);
  }

  if (content.includes("export default")) set.add("default");
  return [...set].sort((a, b) => a.localeCompare(b));
}

function classifyDomain(relativePath: string, segments: string[]): Domain {
  const full = relativePath.toLowerCase();
  const segs = segments.map((segment) => segment.toLowerCase());

  if (segs.some((s) => ["workers", "worker", "queue", "queues", "jobs", "cron", "schedule"].includes(s))) {
    return "workers";
  }
  if (segs.some((s) => ["db", "database", "schema", "migrations", "prisma", "supabase"].includes(s))) {
    return "database";
  }
  if (segs.some((s) => ["integrations", "integration", "clients", "sdk", "oauth", "stripe", "openai"].includes(s))) {
    return "integrations";
  }
  if (
    segs.some((s) => ["api", "server", "services", "middleware", "controllers", "routes"].includes(s)) ||
    full.includes("/api/")
  ) {
    return "backend";
  }
  return "frontend";
}

function classifySubsystem(segments: string[]): string {
  const candidate = segments[0]?.toLowerCase() ?? "misc";
  if (candidate === "index.ts" || candidate === "index.tsx") return "root";
  return slugify(stripExtension(candidate)) || "misc";
}

function classifyTopic(segments: string[], filePath: string): string {
  if (segments.length >= 3) {
    const parent = slugify(segments[segments.length - 2] ?? "");
    const file = slugify(stripExtension(segments[segments.length - 1] ?? ""));
    if (file === "index" && parent) return parent;
    if (file && parent && file !== parent) return `${parent}-${file}`;
    if (file) return file;
  }

  if (segments.length >= 2) {
    const name = stripExtension(segments[1] ?? "");
    if (name) return slugify(name);
  }
  return slugify(stripExtension(path.basename(filePath))) || "overview";
}

function groupModules(modules: SourceModule[]): Map<Domain, DomainGroup> {
  const root = new Map<Domain, DomainGroup>();
  for (const domain of DOMAIN_ORDER) {
    root.set(domain, { domain, subsystems: new Map() });
  }

  for (const mod of modules) {
    const domainGroup = root.get(mod.domain)!;
    let subsystem = domainGroup.subsystems.get(mod.subsystem);
    if (!subsystem) {
      subsystem = { subsystem: mod.subsystem, topics: new Map() };
      domainGroup.subsystems.set(mod.subsystem, subsystem);
    }
    let topic = subsystem.topics.get(mod.topic);
    if (!topic) {
      topic = { topic: mod.topic, modules: [] };
      subsystem.topics.set(mod.topic, topic);
    }
    topic.modules.push(mod);
  }

  for (const domainGroup of root.values()) {
    for (const subsystem of domainGroup.subsystems.values()) {
      for (const topic of subsystem.topics.values()) {
        topic.modules.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      }
    }
  }

  return root;
}

async function writeCodemapTree(grouped: Map<Domain, DomainGroup>, outputDir: string, maxLeafModules: number): Promise<void> {
  const domainLinks: string[] = [];

  for (const domain of DOMAIN_ORDER) {
    const group = grouped.get(domain);
    if (!group || group.subsystems.size === 0) continue;
    const domainDir = path.join(outputDir, domain);
    await fs.mkdir(domainDir, { recursive: true });
    domainLinks.push(`- [${title(domain)}](./${domain}/INDEX.md)`);

    const subsystemLinks: string[] = [];
    for (const subsystem of sortedValues(group.subsystems)) {
      const subsystemDir = path.join(domainDir, subsystem.subsystem);
      await fs.mkdir(subsystemDir, { recursive: true });
      subsystemLinks.push(`- [${title(subsystem.subsystem)}](./${subsystem.subsystem}/INDEX.md)`);

      const topicLinks: string[] = [];
      for (const topic of sortedValues(subsystem.topics)) {
        const chunks = chunkModules(topic.modules, maxLeafModules);
        if (chunks.length === 1) {
          const fileName = `${topic.topic}.md`;
          topicLinks.push(`- [${title(topic.topic)}](./${fileName})`);
          await fs.writeFile(path.join(subsystemDir, fileName), buildTopicPage(domain, subsystem.subsystem, topic.topic, chunks[0]), "utf8");
        } else {
          const topicDir = path.join(subsystemDir, topic.topic);
          await fs.mkdir(topicDir, { recursive: true });
          topicLinks.push(`- [${title(topic.topic)}](./${topic.topic}/INDEX.md)`);

          const partLinks: string[] = [];
          for (let i = 0; i < chunks.length; i += 1) {
            const fileName = `part-${i + 1}.md`;
            partLinks.push(`- [Part ${i + 1}](./${fileName})`);
            await fs.writeFile(
              path.join(topicDir, fileName),
              buildTopicPage(domain, subsystem.subsystem, `${topic.topic} (part ${i + 1}/${chunks.length})`, chunks[i]),
              "utf8",
            );
          }

          const topicIndex = [
            `# ${title(topic.topic)} Codemap`,
            "",
            `- Domain: \`${domain}\``,
            `- Subsystem: \`${subsystem.subsystem}\``,
            `- Total Modules: \`${topic.modules.length}\``,
            "",
            "## Parts",
            ...partLinks,
            "",
          ].join("\n");
          await fs.writeFile(path.join(topicDir, "INDEX.md"), topicIndex, "utf8");
        }
      }

      const subsystemIndex = [
        `# ${title(subsystem.subsystem)} Codemap`,
        "",
        `- Domain: \`${domain}\``,
        "",
        "## Topics",
        ...topicLinks,
        "",
      ].join("\n");
      await fs.writeFile(path.join(subsystemDir, "INDEX.md"), subsystemIndex, "utf8");
    }

    const domainIndex = [
      `# ${title(domain)} Codemap`,
      "",
      "## Subsystems",
      ...subsystemLinks,
      "",
    ].join("\n");
    await fs.writeFile(path.join(domainDir, "INDEX.md"), domainIndex, "utf8");
  }

  const rootIndex = [
    "# Codemaps Index",
    "",
    `- Canonical Root: \`docs/development/00-overview/codemaps/\``,
    `- Last Updated: \`${new Date().toISOString().slice(0, 10)}\``,
    "",
    "## Domains",
    ...(domainLinks.length > 0 ? domainLinks : ["- (no domains discovered)"]),
    "",
    "## Navigation Rules",
    "- INDEX pages are navigation-only and should remain concise.",
    "- Topic pages are generated from source code facts.",
    "",
  ].join("\n");
  await fs.writeFile(path.join(outputDir, "INDEX.md"), rootIndex, "utf8");
}

function chunkModules(modules: SourceModule[], maxSize: number): SourceModule[][] {
  if (modules.length <= maxSize) return [modules];
  const chunks: SourceModule[][] = [];
  for (let i = 0; i < modules.length; i += maxSize) {
    chunks.push(modules.slice(i, i + maxSize));
  }
  return chunks;
}

function buildTopicPage(domain: Domain, subsystem: string, topic: string, modules: SourceModule[]): string {
  const lines: string[] = [
    `# ${title(topic)} Codemap`,
    "",
    `- Domain: \`${domain}\``,
    `- Subsystem: \`${subsystem}\``,
    `- Modules: \`${modules.length}\``,
    "",
    "## Modules",
  ];

  for (const mod of modules) {
    lines.push(`### \`${mod.relativePath}\``);
    lines.push(`- Imports: ${mod.imports.length > 0 ? mod.imports.map((i) => `\`${i}\``).join(", ") : "_none_"}`);
    lines.push(`- Exports: ${mod.exports.length > 0 ? mod.exports.map((e) => `\`${e}\``).join(", ") : "_none_"}`);
    lines.push("");
  }

  return lines.join("\n");
}

async function writeLegacyMirror(grouped: Map<Domain, DomainGroup>, legacyDir: string): Promise<void> {
  const lines = [
    "# Legacy Codemap Mirror",
    "",
    "This folder is generated for compatibility links.",
    "Canonical path: `docs/development/00-overview/codemaps/`.",
    "",
    "## Domains",
  ];

  for (const domain of DOMAIN_ORDER) {
    const group = grouped.get(domain);
    if (!group || group.subsystems.size === 0) continue;
    const compatibilityFile = `${domain}.md`;
    lines.push(`- [${title(domain)}](./${compatibilityFile})`);

    const subsystemLines = sortedValues(group.subsystems)
      .map((s) => `- \`${s.subsystem}\` (${s.topics.size} topics)`)
      .join("\n");
    await fs.writeFile(
      path.join(legacyDir, compatibilityFile),
      `# ${title(domain)} (Legacy Mirror)\n\nCanonical: ../development/00-overview/codemaps/${domain}/INDEX.md\n\n## Subsystems\n${subsystemLines}\n`,
      "utf8",
    );
  }

  await fs.writeFile(path.join(legacyDir, "INDEX.md"), `${lines.join("\n")}\n", "utf8");
}

async function writeSummary(projectRoot: string, summary: ReturnType<typeof buildSummary>): Promise<void> {
  const target = path.join(projectRoot, "docs", "_meta", "codemap-summary.json");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(summary, null, 2), "utf8");
}

function buildSummary(grouped: Map<Domain, DomainGroup>) {
  let totalDomains = 0;
  let totalSubsystems = 0;
  let totalTopics = 0;
  let totalModules = 0;

  const byDomain: Record<string, { subsystems: number; topics: number; modules: number }> = {};

  for (const domain of DOMAIN_ORDER) {
    const group = grouped.get(domain);
    if (!group || group.subsystems.size === 0) continue;
    totalDomains += 1;

    let domainSubsystems = 0;
    let domainTopics = 0;
    let domainModules = 0;

    for (const subsystem of group.subsystems.values()) {
      domainSubsystems += 1;
      for (const topic of subsystem.topics.values()) {
        domainTopics += 1;
        domainModules += topic.modules.length;
      }
    }

    byDomain[domain] = {
      subsystems: domainSubsystems,
      topics: domainTopics,
      modules: domainModules,
    };

    totalSubsystems += domainSubsystems;
    totalTopics += domainTopics;
    totalModules += domainModules;
  }

  return {
    generatedAt: new Date().toISOString(),
    canonicalRoot: "docs/development/00-overview/codemaps/",
    totalDomains,
    totalSubsystems,
    totalTopics,
    totalModules,
    byDomain,
  };
}

function sortedValues<T extends { [key: string]: unknown }>(map: Map<string, T>): T[] {
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value);
}

function toPosixPath(input: string): string {
  return input.split(path.sep).join("/");
}

function stripExtension(input: string): string {
  return input.replace(/\.[^/.]+$/, "");
}

function slugify(input: string): string {
  const withWordBoundaries = input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2");

  const normalized = withWordBoundaries
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const withConnectorWords = normalized.replace(/[&+]/g, " and ");

  return withConnectorWords
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function title(input: string): string {
  return input
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

main().catch((error) => {
  console.error("[codemap] failed", error);
  process.exitCode = 1;
});

