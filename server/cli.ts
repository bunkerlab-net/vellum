import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { agents } from "./agents/index";
import { startServer } from "./server";

const projectRoot = process.cwd();
const distDir = join(projectRoot, "dist");
const campaignsDir = join(projectRoot, "campaigns");

const raw = Bun.argv.slice(2);
const flags = new Set<string>();
const passthrough: string[] = [];
let agentName: string | null = null;

for (let i = 0; i < raw.length; i++) {
  const arg = raw[i];
  if (arg === "--no-build" || arg === "--no-open") {
    flags.add(arg);
    continue;
  }
  if (agentName == null && !arg.startsWith("-") && agents[arg]) {
    agentName = arg;
    continue;
  }
  passthrough.push(arg);
}

agentName ??= "claude";

const port = Number(Bun.env.PORT ?? 4321);

if (!flags.has("--no-build") && distNeedsRebuild(projectRoot, distDir)) {
  console.log("Building frontend (astro build)…");
  const proc = Bun.spawn({
    cmd: ["bun", "x", "astro", "build"],
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    console.error("astro build failed");
    process.exit(code);
  }
}

if (!existsSync(distDir)) {
  console.error(`No dist/ at ${distDir}. Run 'bun run build' first.`);
  process.exit(1);
}

await startServer({
  agentName,
  agentArgv: passthrough,
  port,
  cwd: projectRoot,
  distDir,
  campaignsDir,
});

function distNeedsRebuild(root: string, out: string): boolean {
  const indexPath = join(out, "index.html");
  if (!existsSync(indexPath)) return true;
  const distMtime = statSync(indexPath).mtimeMs;
  const watch = ["src", "astro.config.mjs", "package.json"];
  for (const rel of watch) {
    const p = join(root, rel);
    if (!existsSync(p)) continue;
    if (newestMtime(p) > distMtime) return true;
  }
  return false;
}

function newestMtime(path: string): number {
  const st = statSync(path);
  if (st.isFile()) return st.mtimeMs;
  if (st.isDirectory()) {
    const fs = require("node:fs") as typeof import("node:fs");
    const entries = fs.readdirSync(path, { withFileTypes: true });
    let max = st.mtimeMs;
    for (const e of entries) {
      const m = newestMtime(join(path, e.name));
      if (m > max) max = m;
    }
    return max;
  }
  return 0;
}
