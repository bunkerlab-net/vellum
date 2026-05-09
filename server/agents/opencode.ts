import { createOpencodeClient, createOpencodeServer, type Event, type Part } from "@opencode-ai/sdk";
import type { Agent, AgentSpawn } from "./types";

type OpencodeServer = Awaited<ReturnType<typeof createOpencodeServer>>;
type OpencodeClient = ReturnType<typeof createOpencodeClient>;

export function opencodeAgent(spawn: AgentSpawn): Agent {
  let sessionId: string | undefined;
  let server: OpencodeServer | undefined;
  let client: OpencodeClient | undefined;
  let closing = false;
  const eventAbort = new AbortController();
  const seenTool = new Map<string, "started" | "done">();
  const seenTextEnd = new Set<string>();
  let queued: Promise<void> = Promise.resolve();

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
    interrupt() {
      if (!client || !sessionId) return;
      void client.session
        .abort({ path: { id: sessionId } })
        .catch((err) => process.stderr.write(`[opencode] abort failed: ${errMsg(err)}\n`));
    },
    async close() {
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
      server = await createOpencodeServer({ hostname: "127.0.0.1", port: 0 });
      client = createOpencodeClient({ baseUrl: server.url });
      spawn.emit({ type: "ready", agent: "opencode" });
      void streamEvents();
    } catch (err) {
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
        body: { parts: [{ type: "text", text }] },
      });
    } catch (err) {
      if (closing) return;
      spawn.emit({ type: "error", message: `opencode prompt failed: ${errMsg(err)}` });
    }
  }

  async function streamEvents() {
    if (!client) return;
    while (!closing) {
      try {
        const result = await client.event.subscribe({
          signal: eventAbort.signal,
          query: { directory: spawn.cwd },
        });
        for await (const event of result.stream) {
          if (closing) return;
          handleEvent(event as Event, spawn, seenTool, seenTextEnd);
        }
      } catch (err) {
        if (closing) return;
        process.stderr.write(`[opencode] event stream error: ${errMsg(err)}\n`);
        await sleep(1000);
      }
    }
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
