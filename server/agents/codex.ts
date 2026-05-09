import {
  Codex,
  type ModelReasoningEffort,
  type Thread,
  type ThreadEvent,
  type ThreadItem,
  type ThreadOptions,
} from "@openai/codex-sdk";
import type { Agent, AgentSpawn } from "./types";

const EFFORT_LEVELS = ["minimal", "low", "medium", "high", "xhigh"] as const;
const ITEM_DEDUP_CAP = 1024;

function isEffort(v: string | undefined): v is ModelReasoningEffort {
  return typeof v === "string" && (EFFORT_LEVELS as readonly string[]).includes(v);
}

function permissionToApproval(mode: string | undefined): ThreadOptions["approvalPolicy"] {
  return mode === "acceptEdits" ? "never" : "on-failure";
}

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

export function codexAgent(spawn: AgentSpawn): Agent {
  let sessionId: string | undefined;
  let thread: Thread | null = null;
  let closing = false;
  let queued: Promise<void> = Promise.resolve();
  let activeAbort: AbortController | null = null;

  let currentModel = spawn.model && spawn.model.length > 0 ? spawn.model : undefined;
  let currentEffort: ModelReasoningEffort | undefined = isEffort(spawn.effort) ? spawn.effort : undefined;
  let currentPermission = spawn.permissionMode ?? "default";
  const resumeId = spawn.resume;

  const codex = new Codex();

  // Per-message streaming state — agent_message text is updated cumulatively
  // by the SDK, so we diff to produce assistant_partial deltas.
  const messageText = new BoundedMap<string, string>(ITEM_DEDUP_CAP);
  // Tool item lifecycle: tracks whether we've emitted tool_use / tool_result.
  const seenItem = new BoundedMap<string, "started" | "done">(ITEM_DEDUP_CAP);

  // Surface readiness on the next tick so server-side bookkeeping mirrors the
  // other adapters (don't fire `ready` synchronously inside the factory).
  queueMicrotask(() => {
    if (!closing) spawn.emit({ type: "ready", agent: "codex" });
  });

  function buildThreadOptions(): ThreadOptions {
    const opts: ThreadOptions = {
      workingDirectory: spawn.cwd,
      skipGitRepoCheck: true,
      sandboxMode: "workspace-write",
      approvalPolicy: permissionToApproval(currentPermission),
    };
    if (currentModel) opts.model = currentModel;
    if (currentEffort) opts.modelReasoningEffort = currentEffort;
    return opts;
  }

  function ensureThread(): Thread {
    if (thread) return thread;
    thread = resumeId ? codex.resumeThread(resumeId, buildThreadOptions()) : codex.startThread(buildThreadOptions());
    return thread;
  }

  function rebindThread() {
    if (!thread) return; // first send() will pick up the new options anyway
    if (sessionId) {
      thread = codex.resumeThread(sessionId, buildThreadOptions());
    } else {
      // No session id yet (first turn never started) — drop the placeholder and
      // let the next send() construct a fresh thread with the new options.
      thread = null;
    }
  }

  return {
    get sessionId() {
      return sessionId;
    },
    async send(text: string) {
      const next = queued.then(() => runOnce(text));
      queued = next.catch(() => {});
      await next;
    },
    // Codex thread options bind at thread construction — there is no in-flight
    // setter on Thread itself. We swap the live Thread object for a fresh
    // `resumeThread(id, options)` so the next turn picks up the new model /
    // effort / approval policy without a server restart, while keeping the
    // remote conversation by reusing the session id.
    async setModel(model: string) {
      currentModel = model && model.length > 0 ? model : undefined;
      rebindThread();
    },
    async setEffort(effort: string) {
      currentEffort = isEffort(effort) ? effort : undefined;
      rebindThread();
    },
    async setPermissionMode(mode: string) {
      currentPermission = mode;
      rebindThread();
    },
    async listModels() {
      // The Codex SDK does not expose a model-discovery API, so this is a
      // curated fallback. Users can still type a custom model id by editing
      // the Codex CLI config directly.
      return [
        { value: "gpt-5", label: "GPT-5" },
        { value: "gpt-5-codex", label: "GPT-5 Codex" },
        { value: "gpt-5-mini", label: "GPT-5 Mini" },
      ];
    },
    interrupt() {
      activeAbort?.abort();
    },
    async close() {
      closing = true;
      activeAbort?.abort();
    },
  };

  async function runOnce(text: string) {
    if (closing) return;
    const t = ensureThread();
    const abort = new AbortController();
    activeAbort = abort;
    try {
      const streamed = await t.runStreamed(text, { signal: abort.signal });
      for await (const event of streamed.events) {
        if (closing) return;
        handleEvent(event, spawn, messageText, seenItem, (id) => (sessionId = id));
      }
    } catch (err) {
      if (closing) return;
      spawn.emit({ type: "error", message: `codex turn failed: ${errMsg(err)}` });
    } finally {
      if (activeAbort === abort) activeAbort = null;
    }
  }
}

function handleEvent(
  event: ThreadEvent,
  spawn: AgentSpawn,
  messageText: Map<string, string>,
  seenItem: Map<string, "started" | "done">,
  captureSession: (id: string) => void,
) {
  if (event.type === "thread.started") {
    captureSession(event.thread_id);
    return;
  }
  if (event.type === "item.started") {
    handleItemStart(event.item, spawn, seenItem);
    return;
  }
  if (event.type === "item.updated") {
    handleItemUpdate(event.item, spawn, messageText);
    return;
  }
  if (event.type === "item.completed") {
    handleItemComplete(event.item, spawn, messageText, seenItem);
    return;
  }
  if (event.type === "turn.failed") {
    spawn.emit({ type: "error", message: event.error.message });
    return;
  }
  if (event.type === "error") {
    spawn.emit({ type: "error", message: event.message });
  }
}

function handleItemStart(item: ThreadItem, spawn: AgentSpawn, seenItem: Map<string, "started" | "done">) {
  if (seenItem.get(item.id) === "started" || seenItem.get(item.id) === "done") return;
  if (item.type === "command_execution") {
    seenItem.set(item.id, "started");
    spawn.emit({ type: "tool_use", name: "command", toolUseId: item.id });
  } else if (item.type === "file_change") {
    seenItem.set(item.id, "started");
    spawn.emit({ type: "tool_use", name: "file_change", toolUseId: item.id });
  } else if (item.type === "mcp_tool_call") {
    seenItem.set(item.id, "started");
    spawn.emit({ type: "tool_use", name: item.tool, toolUseId: item.id });
  } else if (item.type === "web_search") {
    seenItem.set(item.id, "started");
    spawn.emit({ type: "tool_use", name: "web_search", toolUseId: item.id });
  }
}

function handleItemUpdate(item: ThreadItem, spawn: AgentSpawn, messageText: Map<string, string>) {
  if (item.type !== "agent_message") return;
  const prev = messageText.get(item.id) ?? "";
  const next = item.text;
  if (next === prev) return;
  if (next.startsWith(prev)) {
    const delta = next.slice(prev.length);
    if (delta.length > 0) spawn.emit({ type: "assistant_partial", text: delta });
  }
  // Non-append updates (revisions / shrinks) are intentionally not emitted as
  // partials: `assistant_partial` is append-only on the frontend, so emitting
  // the new text would double-count. The terminal `item.completed` event
  // re-emits the full final text via `assistant_text`, which replaces the
  // narrator entry's text with the canonical value, so any drift here is
  // reconciled when the message finalizes.
  messageText.set(item.id, next);
}

function handleItemComplete(
  item: ThreadItem,
  spawn: AgentSpawn,
  messageText: Map<string, string>,
  seenItem: Map<string, "started" | "done">,
) {
  if (item.type === "agent_message") {
    spawn.emit({ type: "assistant_text", text: item.text });
    messageText.delete(item.id);
    return;
  }
  if (item.type === "command_execution" || item.type === "file_change" || item.type === "mcp_tool_call") {
    seenItem.set(item.id, "done");
    const ok = item.status === "completed";
    const name =
      item.type === "mcp_tool_call" ? item.tool : item.type === "command_execution" ? "command" : "file_change";
    spawn.emit({ type: "tool_result", name, ok });
    return;
  }
  if (item.type === "web_search") {
    // WebSearchItem in @openai/codex-sdk has no status field — the SDK only
    // exposes `id`, `type`, `query`. Reaching `item.completed` for a
    // web_search means the search finished; if it had failed it would arrive
    // as an `error` item instead. Report success accordingly.
    seenItem.set(item.id, "done");
    spawn.emit({ type: "tool_result", name: "web_search", ok: true });
    return;
  }
  if (item.type === "error") {
    spawn.emit({ type: "error", message: item.message });
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
