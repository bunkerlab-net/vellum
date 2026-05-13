import { isAbsolute, resolve, sep } from "node:path";
import { createOpencodeClient, createOpencodeServer, type Event, type Part, type Permission } from "@opencode-ai/sdk";
import { log } from "../log";
import type { Agent, AgentSpawn } from "./types";

type OpencodeServer = Awaited<ReturnType<typeof createOpencodeServer>>;
type OpencodeClient = ReturnType<typeof createOpencodeClient>;

const DEDUP_CAP = 1024;
const STREAM_MAX_RETRIES = 8;
const STREAM_BACKOFF_BASE_MS = 500;
const STREAM_BACKOFF_MAX_MS = 30_000;

class BoundedMap<K, V> extends Map<K, V> {
  constructor(private readonly cap: number) {
    super();
  }
  override set(key: K, value: V): this {
    if (this.size >= this.cap && !this.has(key)) {
      const oldest = this.keys().next();
      if (!oldest.done) this.delete(oldest.value);
    }
    return super.set(key, value);
  }
}

class BoundedSet<T> extends Set<T> {
  constructor(private readonly cap: number) {
    super();
  }
  override add(value: T): this {
    if (this.size >= this.cap && !this.has(value)) {
      const oldest = this.values().next();
      if (!oldest.done) this.delete(oldest.value);
    }
    return super.add(value);
  }
}

type ParsedModel = { providerID: string; modelID: string };

function parseModel(spec: string | undefined): ParsedModel | undefined {
  if (!spec) return undefined;
  const idx = spec.indexOf("/");
  if (idx <= 0 || idx >= spec.length - 1) return undefined;
  return { providerID: spec.slice(0, idx), modelID: spec.slice(idx + 1) };
}

export function opencodeAgent(spawn: AgentSpawn): Agent {
  let sessionId: string | undefined;
  let server: OpencodeServer | undefined;
  let client: OpencodeClient | undefined;
  let closing = false;
  const eventAbort = new AbortController();
  const seenTool = new BoundedMap<string, "started" | "done">(DEDUP_CAP);
  const seenTextEnd = new BoundedSet<string>(DEDUP_CAP);
  let queued: Promise<void> = Promise.resolve();
  let currentModel: ParsedModel | undefined = parseModel(spawn.model);
  const campaignsDir = resolve(spawn.cwd, "campaigns");

  const ready = boot();

  return {
    get sessionId() {
      return sessionId;
    },
    async send(text: string) {
      const next = queued.then(() => runOnce(text));
      queued = next.catch(() => {});
      await next;
    },
    async setModel(model: string) {
      currentModel = parseModel(model);
    },
    async listModels() {
      try {
        await ready;
        if (!client) return [];
        const r = await client.provider.list({ query: { directory: spawn.cwd } });
        const all = r.data?.all ?? [];
        const out: { value: string; label: string }[] = [];
        for (const provider of all) {
          for (const model of Object.values(provider.models)) {
            out.push({
              value: `${provider.id}/${model.id}`,
              label: `${provider.name} · ${model.name}`,
            });
          }
        }
        out.sort((a, b) => a.label.localeCompare(b.label));
        return out;
      } catch (err) {
        log.warn("opencode", `provider.list failed: ${errMsg(err)}`);
        return [];
      }
    },
    interrupt() {
      if (!client || !sessionId) return;
      void client.session
        .abort({ path: { id: sessionId } })
        .catch((err) => log.warn("opencode", `abort failed: ${errMsg(err)}`));
    },
    async close() {
      log.debug("opencode", "close");
      closing = true;
      eventAbort.abort();
      try {
        await ready;
      } catch {
        // ignore boot errors
      }
      server?.close();
    },
  };

  async function boot() {
    try {
      server = await createOpencodeServer({
        hostname: "127.0.0.1",
        port: 0,
        // OpenCode's typed permission schema is global per tool category — it
        // can't express "allow edits only under campaigns/". Routing `edit`
        // through "ask" lets us subscribe to the `permission.updated` event
        // and reply per-request: approve when every path lands under
        // `campaigns/`, reject otherwise. See `respondToPermission` below.
        // Other tool categories keep their SDK defaults so we don't widen the
        // surface or break flows (e.g. `mise run roll` via bash) that already
        // rely on the unchanged defaults.
        config: { permission: { edit: "ask" } },
      });
      client = createOpencodeClient({ baseUrl: server.url });
      log.info("opencode", `server booted at ${server.url}`);
      spawn.emit({ type: "ready", agent: "opencode" });
      void streamEvents();
    } catch (err) {
      log.error("opencode", `boot failed: ${errMsg(err)}`);
      spawn.emit({ type: "error", message: `opencode boot failed: ${errMsg(err)}`, fatal: true });
      spawn.emit({ type: "agent_exit", code: null });
      throw err;
    }
  }

  async function ensureSession(c: OpencodeClient): Promise<string> {
    if (sessionId) return sessionId;
    const created = await c.session.create({
      query: { directory: spawn.cwd },
      body: { title: "Vellum" },
    });
    const id = created.data?.id;
    if (!id) throw new Error("opencode session create returned no id");
    sessionId = id;
    return id;
  }

  async function runOnce(text: string) {
    try {
      await ready;
      if (!client) throw new Error("opencode client not initialized");
      const id = await ensureSession(client);
      await client.session.prompt({
        path: { id },
        query: { directory: spawn.cwd },
        body: {
          parts: [{ type: "text", text }],
          ...(currentModel ? { model: currentModel } : {}),
        },
      });
    } catch (err) {
      if (closing) return;
      log.error("opencode", `prompt failed: ${errMsg(err)}`);
      spawn.emit({ type: "error", message: `opencode prompt failed: ${errMsg(err)}` });
    }
  }

  async function streamEvents() {
    if (!client) return;
    let attempts = 0;
    while (!closing) {
      try {
        const result = await client.event.subscribe({
          signal: eventAbort.signal,
          query: { directory: spawn.cwd },
        });
        attempts = 0;
        for await (const event of result.stream) {
          if (closing) return;
          const ev = event as Event;
          if (ev.type === "permission.updated") {
            void respondToPermission(ev.properties);
            continue;
          }
          handleEvent(ev, spawn, seenTool, seenTextEnd);
        }
      } catch (err) {
        if (closing) return;
        attempts++;
        log.warn("opencode", `event stream error (attempt ${attempts}): ${errMsg(err)}`);
        if (attempts >= STREAM_MAX_RETRIES) {
          spawn.emit({
            type: "error",
            message: `opencode event stream failed after ${STREAM_MAX_RETRIES} retries: ${errMsg(err)}`,
            fatal: true,
          });
          spawn.emit({ type: "agent_exit", code: null });
          return;
        }
        const delay = Math.min(STREAM_BACKOFF_MAX_MS, STREAM_BACKOFF_BASE_MS * 2 ** (attempts - 1));
        await sleep(delay);
      }
    }
  }

  async function respondToPermission(p: Permission) {
    if (!client) return;
    const allow = p.type === "edit" && allPathsInCampaigns(p.pattern);
    try {
      await client.postSessionIdPermissionsPermissionId({
        path: { id: p.sessionID, permissionID: p.id },
        body: { response: allow ? "once" : "reject" },
      });
      if (!allow) {
        log.warn("opencode", `rejected ${p.type} permission outside campaigns/ (pattern=${JSON.stringify(p.pattern)})`);
      }
    } catch (err) {
      log.warn("opencode", `permission respond failed: ${errMsg(err)}`);
    }
  }

  function allPathsInCampaigns(pattern: Permission["pattern"]): boolean {
    if (pattern == null) return false;
    const list = Array.isArray(pattern) ? pattern : [pattern];
    if (list.length === 0) return false;
    return list.every(pathInCampaigns);
  }

  function pathInCampaigns(p: unknown): boolean {
    if (typeof p !== "string" || p.length === 0) return false;
    // Globs would slip through `startsWith` (e.g. `*` in the middle of an
    // otherwise campaigns-rooted path). Concrete file paths only.
    if (/[*?[\]]/.test(p)) return false;
    const abs = isAbsolute(p) ? p : resolve(spawn.cwd, p);
    return abs === campaignsDir || abs.startsWith(campaignsDir + sep);
  }
}

function handleEvent(
  event: Event,
  spawn: AgentSpawn,
  seenTool: Map<string, "started" | "done">,
  seenTextEnd: Set<string>,
) {
  if (event.type !== "message.part.updated") return;
  const { part, delta } = event.properties;
  if (part.type === "text") {
    handleTextPart(part, delta, spawn, seenTextEnd);
    return;
  }
  if (part.type === "tool") {
    handleToolPart(part, spawn, seenTool);
  }
}

function handleTextPart(
  part: Extract<Part, { type: "text" }>,
  delta: string | undefined,
  spawn: AgentSpawn,
  seenTextEnd: Set<string>,
) {
  if (typeof delta === "string" && delta.length > 0) {
    spawn.emit({ type: "assistant_partial", text: delta });
    return;
  }
  if (part.time?.end !== undefined && !seenTextEnd.has(part.id)) {
    seenTextEnd.add(part.id);
    spawn.emit({ type: "assistant_text", text: part.text });
  }
}

function handleToolPart(
  part: Extract<Part, { type: "tool" }>,
  spawn: AgentSpawn,
  seenTool: Map<string, "started" | "done">,
) {
  const status = part.state.status;
  const prior = seenTool.get(part.callID);
  if ((status === "pending" || status === "running") && prior !== "started" && prior !== "done") {
    seenTool.set(part.callID, "started");
    spawn.emit({ type: "tool_use", name: part.tool, toolUseId: part.callID });
    return;
  }
  if ((status === "completed" || status === "error") && prior !== "done") {
    seenTool.set(part.callID, "done");
    spawn.emit({
      type: "tool_result",
      name: part.tool,
      ok: status === "completed",
    });
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
