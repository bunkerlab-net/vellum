import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import {
  createSdkMcpServer,
  type Query,
  query,
  type SDKMessage,
  type SDKUserMessage,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { log } from "../log";
import type { Agent, AgentSpawn, EmitFn } from "./types";

type PermissionMode = "default" | "acceptEdits";
type EffortLevel = "low" | "medium" | "high" | "xhigh";
const EFFORT_LEVELS: ReadonlyArray<EffortLevel> = ["low", "medium", "high", "xhigh"];

function isPermissionMode(v: unknown): v is PermissionMode {
  return v === "default" || v === "acceptEdits";
}

function isEffort(v: unknown): v is EffortLevel {
  return typeof v === "string" && (EFFORT_LEVELS as readonly string[]).includes(v);
}

// Best-effort: read the user's claude settings file to surface their configured
// effortLevel back to the UI. The SDK does not expose a getter for the resolved
// effort, so we mirror the CLI's settings layering at the simplest layer (user)
// and fall back to undefined if the file is missing or unreadable.
function readUserEffort(cwd: string): EffortLevel | undefined {
  const candidates = [
    join(cwd, ".claude", "settings.local.json"),
    join(cwd, ".claude", "settings.json"),
    join(homedir(), ".claude", "settings.json"),
  ];
  for (const path of candidates) {
    try {
      const raw = readFileSync(path, "utf8");
      const parsed = JSON.parse(raw) as { effortLevel?: unknown };
      if (isEffort(parsed.effortLevel)) return parsed.effortLevel;
    } catch {
      // ignore — file missing, malformed, or no effortLevel
    }
  }
  return undefined;
}

const ASK_SYSTEM_PROMPT = [
  "When you would normally use the AskUserQuestion tool to pose curated multi-choice",
  "questions to the player, instead call `mcp__vellum__ask`. The host frontend renders",
  "those calls as a themed picker UI; the player's selection comes back as the tool",
  "result text. The built-in AskUserQuestion tool is disabled in this session — only",
  "use `mcp__vellum__ask` for shortlists.",
].join(" ");

// Vellum's DM workflow expects the agent to read and edit campaign markdown
// freely; the live-persistence rules in AGENTS.md mean every state change writes
// to disk inline. Pre-approving every file-touching tool against `campaigns/**`
// removes the per-call permission prompt while leaving every other path subject
// to the normal Claude Code permission flow.
const CAMPAIGN_TOOLS = ["Read", "Write", "Edit", "MultiEdit", "NotebookEdit", "Glob", "Grep"] as const;

function campaignAllowRules(cwd: string): string[] {
  const abs = isAbsolute(cwd) ? join(cwd, "campaigns") : resolve(cwd, "campaigns");
  // Triple the patterns so Claude's path matcher hits regardless of whether the
  // tool input arrives as bare-relative, dot-relative, or absolute.
  return CAMPAIGN_TOOLS.flatMap((t) => [`${t}(campaigns/**)`, `${t}(./campaigns/**)`, `${t}(${abs}/**)`]);
}

export function claudeAgent(spawn: AgentSpawn): Agent {
  let sessionId: string | undefined;
  let closing = false;
  const pending = new Map<string, (answer: string) => void>();
  const inbox = createInbox<SDKUserMessage>();
  const abort = new AbortController();
  const initialPermission = isPermissionMode(spawn.permissionMode) ? spawn.permissionMode : undefined;
  const initialEffort: EffortLevel | undefined = isEffort(spawn.effort) ? spawn.effort : readUserEffort(spawn.cwd);
  const initialModel = spawn.model && spawn.model.length > 0 ? spawn.model : undefined;

  const askTool = tool(
    "ask",
    "Pose a curated multi-choice question (or batch of questions) to the player. Use for any pick-from-N shortlist — level-up choices, encounter parameters, in-fiction picks. Each question may set its own multiSelect flag.",
    {
      questions: z.array(
        z.object({
          question: z.string(),
          header: z.string().optional(),
          multiSelect: z.boolean().optional(),
          options: z.array(
            z.object({
              label: z.string(),
              description: z.string().optional(),
            }),
          ),
        }),
      ),
    },
    async (args) => {
      const toolUseId = crypto.randomUUID();
      const answer = await new Promise<string>((resolve) => {
        pending.set(toolUseId, resolve);
        spawn.emit({
          type: "tool_use",
          name: "AskUserQuestion",
          toolUseId,
          input: args,
        });
      });
      return { content: [{ type: "text", text: answer }] };
    },
  );

  const mcp = createSdkMcpServer({
    name: "vellum",
    tools: [askTool],
  });

  const q: Query = query({
    prompt: inbox.iterable,
    options: {
      cwd: spawn.cwd,
      abortController: abort,
      includePartialMessages: true,
      mcpServers: { vellum: mcp },
      // We host the picker ourselves, so the SDK MCP tool is always trusted —
      // without this it falls through to the permission prompt and is denied.
      allowedTools: ["mcp__vellum__ask"],
      disallowedTools: ["AskUserQuestion"],
      settings: {
        permissions: {
          allow: campaignAllowRules(spawn.cwd),
        },
      },
      systemPrompt: { type: "preset", preset: "claude_code", append: ASK_SYSTEM_PROMPT },
      permissionMode: initialPermission,
      model: initialModel,
      effort: initialEffort,
      resume: spawn.resume,
    },
  });

  void consume(
    q,
    spawn,
    (id) => (sessionId = id),
    () => closing,
    initialEffort,
  );

  return {
    get sessionId() {
      return sessionId;
    },
    async send(text: string) {
      inbox.push({
        type: "user",
        message: { role: "user", content: [{ type: "text", text }] },
        parent_tool_use_id: null,
      });
    },
    async sendToolReply(toolUseId: string, content: string) {
      const resolve = pending.get(toolUseId);
      if (!resolve) {
        log.warn("claude", `no pending ask for toolUseId=${toolUseId}`);
        return;
      }
      pending.delete(toolUseId);
      resolve(content);
    },
    async setModel(model: string) {
      await q.setModel(model.length > 0 ? model : undefined).catch((err) => {
        log.warn("claude", `setModel failed: ${errMsg(err)}`);
      });
    },
    async setEffort(effort: string) {
      if (!isEffort(effort)) {
        log.warn("claude", `ignoring unknown effort: ${effort}`);
        return;
      }
      await q.applyFlagSettings({ effortLevel: effort }).catch((err) => {
        log.warn("claude", `setEffort failed: ${errMsg(err)}`);
      });
    },
    async setPermissionMode(mode: string) {
      if (!isPermissionMode(mode)) {
        log.warn("claude", `ignoring unknown permission mode: ${mode}`);
        return;
      }
      await q.setPermissionMode(mode).catch((err) => {
        log.warn("claude", `setPermissionMode failed: ${errMsg(err)}`);
      });
    },
    async listModels() {
      try {
        const models = await q.supportedModels();
        return models.map((m) => ({ value: m.value, label: m.displayName }));
      } catch (err) {
        log.warn("claude", `supportedModels failed: ${errMsg(err)}`);
        return [];
      }
    },
    interrupt() {
      void q.interrupt().catch((err) => {
        log.warn("claude", `interrupt failed: ${errMsg(err)}`);
      });
    },
    async close() {
      log.debug("claude", "close");
      closing = true;
      for (const [id, resolve] of pending) {
        pending.delete(id);
        resolve("[interrupted]");
      }
      inbox.close();
      abort.abort();
    },
  };
}

async function consume(
  q: Query,
  spawn: AgentSpawn,
  captureSession: (id: string) => void,
  isClosing: () => boolean,
  initialEffort: EffortLevel | undefined,
) {
  log.debug("claude", "consume loop started");
  try {
    for await (const msg of q) {
      handleSdkMessage(msg, spawn.emit, captureSession, initialEffort);
    }
    if (!isClosing()) {
      log.warn("claude", "consume loop ended unexpectedly (no closing flag set)");
      spawn.emit({ type: "agent_exit", code: 0 });
    } else {
      log.debug("claude", "consume loop ended after close");
    }
  } catch (err) {
    if (isClosing()) {
      log.debug("claude", `consume loop aborted after close: ${errMsg(err)}`);
      return;
    }
    log.error("claude", `consume loop threw: ${errMsg(err)}`);
    spawn.emit({ type: "error", message: errMsg(err), fatal: true });
    spawn.emit({ type: "agent_exit", code: null });
  }
}

function handleSdkMessage(
  msg: SDKMessage,
  emit: EmitFn,
  captureSession: (id: string) => void,
  initialEffort: EffortLevel | undefined,
) {
  if (msg.type === "system" && msg.subtype === "init") {
    captureSession(msg.session_id);
    log.info("claude", `system.init session=${msg.session_id.slice(0, 8)} model=${msg.model}`);
    emit({
      type: "ready",
      agent: "claude",
      sessionId: msg.session_id,
      model: msg.model,
      permissionMode: msg.permissionMode,
      effort: initialEffort,
    });
    return;
  }
  if (msg.type === "stream_event") {
    const ev = msg.event;
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
      emit({ type: "assistant_partial", text: ev.delta.text });
    }
    return;
  }
  if (msg.type === "assistant") {
    for (const block of msg.message.content) {
      if (block.type === "text") {
        emit({ type: "assistant_text", text: block.text });
      } else if (block.type === "tool_use") {
        // The MCP ask tool is surfaced from inside its handler with the
        // canonical "AskUserQuestion" name; skip the raw pre-call event.
        if (block.name === "mcp__vellum__ask") continue;
        emit({
          type: "tool_use",
          name: block.name,
          toolUseId: block.id,
          input: block.input,
        });
      }
    }
    return;
  }
  if (msg.type === "user") {
    const content = msg.message.content;
    if (typeof content === "string") return;
    for (const block of content) {
      if (block.type === "tool_result") {
        emit({ type: "tool_result", name: "tool", ok: !block.is_error });
      }
    }
    return;
  }
  if (msg.type === "result" && msg.is_error) {
    emit({
      type: "error",
      message: msg.subtype === "success" ? "agent error" : msg.subtype,
    });
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface Inbox<T> {
  iterable: AsyncIterable<T>;
  push(item: T): void;
  close(): void;
}

function createInbox<T>(): Inbox<T> {
  const queue: T[] = [];
  let resolver: ((value: IteratorResult<T>) => void) | null = null;
  let closed = false;

  const iterable: AsyncIterable<T> = {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<T>> {
          const head = queue.shift();
          if (head !== undefined) return Promise.resolve({ value: head, done: false });
          if (closed) return Promise.resolve({ value: undefined as never, done: true });
          return new Promise<IteratorResult<T>>((r) => {
            resolver = r;
          });
        },
      };
    },
  };

  return {
    iterable,
    push(item: T) {
      if (resolver) {
        const r = resolver;
        resolver = null;
        r({ value: item, done: false });
        return;
      }
      queue.push(item);
    },
    close() {
      closed = true;
      if (resolver) {
        const r = resolver;
        resolver = null;
        r({ value: undefined as never, done: true });
      }
    },
  };
}
