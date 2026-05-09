import {
  createSdkMcpServer,
  type Query,
  query,
  type SDKMessage,
  type SDKUserMessage,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { Agent, AgentSpawn, EmitFn } from "./types";

type PermissionMode = "default" | "acceptEdits";

interface ParsedClaudeArgs {
  permissionMode?: PermissionMode;
  resume?: string;
}

function parseClaudeArgs(argv: string[]): ParsedClaudeArgs {
  const out: ParsedClaudeArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--permission-mode" && i + 1 < argv.length) {
      const v = argv[++i];
      if (v === "acceptEdits" || v === "default") out.permissionMode = v;
      continue;
    }
    if (a.startsWith("--permission-mode=")) {
      const v = a.slice("--permission-mode=".length);
      if (v === "acceptEdits" || v === "default") out.permissionMode = v;
      continue;
    }
    if (a.startsWith("--resume=")) {
      out.resume = a.slice("--resume=".length);
      continue;
    }
    if (a.startsWith("-r=")) {
      out.resume = a.slice("-r=".length);
      continue;
    }
    if ((a === "--resume" || a === "-r") && i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
      out.resume = argv[++i];
    }
  }
  return out;
}

const ASK_SYSTEM_PROMPT = [
  "When you would normally use the AskUserQuestion tool to pose curated multi-choice",
  "questions to the player, instead call `mcp__vellum__ask`. The host frontend renders",
  "those calls as a themed picker UI; the player's selection comes back as the tool",
  "result text. The built-in AskUserQuestion tool is disabled in this session — only",
  "use `mcp__vellum__ask` for shortlists.",
].join(" ");

export function claudeAgent(spawn: AgentSpawn): Agent {
  let sessionId: string | undefined;
  let closing = false;
  const pending = new Map<string, (answer: string) => void>();
  const inbox = createInbox<SDKUserMessage>();
  const abort = new AbortController();
  const opts = parseClaudeArgs(spawn.argv);

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
      systemPrompt: { type: "preset", preset: "claude_code", append: ASK_SYSTEM_PROMPT },
      permissionMode: opts.permissionMode,
      resume: opts.resume,
    },
  });

  void consume(
    q,
    spawn,
    (id) => (sessionId = id),
    () => closing,
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
        process.stderr.write(`[claude] no pending ask for toolUseId=${toolUseId}\n`);
        return;
      }
      pending.delete(toolUseId);
      resolve(content);
    },
    interrupt() {
      void q.interrupt().catch((err) => {
        process.stderr.write(`[claude] interrupt failed: ${errMsg(err)}\n`);
      });
    },
    async close() {
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

async function consume(q: Query, spawn: AgentSpawn, captureSession: (id: string) => void, isClosing: () => boolean) {
  try {
    for await (const msg of q) {
      handleSdkMessage(msg, spawn.emit, captureSession);
    }
    if (!isClosing()) spawn.emit({ type: "agent_exit", code: 0 });
  } catch (err) {
    if (isClosing()) return;
    spawn.emit({ type: "error", message: errMsg(err), fatal: true });
    spawn.emit({ type: "agent_exit", code: null });
  }
}

function handleSdkMessage(msg: SDKMessage, emit: EmitFn, captureSession: (id: string) => void) {
  if (msg.type === "system" && msg.subtype === "init") {
    captureSession(msg.session_id);
    emit({ type: "ready", agent: "claude", sessionId: msg.session_id });
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
