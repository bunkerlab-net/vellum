import type { Agent, AgentSpawn } from "./types";

export function codexAgent(spawn: AgentSpawn): Agent {
  let sessionId: string | undefined;
  let activeProc: ReturnType<typeof Bun.spawn> | null = null;
  let queued: Promise<void> = Promise.resolve();

  spawn.emit({ type: "ready", agent: "codex" });

  return {
    get sessionId() {
      return sessionId;
    },
    async send(text: string) {
      const p = queued.then(() => runOnce(text));
      queued = p.catch(() => {});
      await p;
    },
    interrupt() {
      activeProc?.kill("SIGINT");
    },
    async close() {
      activeProc?.kill();
      await queued.catch(() => {});
    },
  };

  async function runOnce(text: string) {
    const args = sessionId
      ? ["codex", "exec", "resume", sessionId, "--json", ...spawn.argv, text]
      : ["codex", "exec", "--json", ...spawn.argv, text];

    const proc = Bun.spawn({
      cmd: args,
      cwd: spawn.cwd,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    activeProc = proc;

    try {
      await Promise.all([
        streamLines(proc.stdout, (line) => handleEvent(line, spawn, (id) => (sessionId = id))),
        streamLines(proc.stderr, (line) => process.stderr.write(`[codex] ${line}\n`)),
      ]);

      const code = await proc.exited;
      if (code !== 0) {
        spawn.emit({
          type: "error",
          message: `codex exited with code ${code}`,
        });
      }
    } catch (err) {
      spawn.emit({
        type: "error",
        message: `codex stream failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      activeProc = null;
    }
  }
}

async function streamLines(stream: ReadableStream<Uint8Array>, onLine: (l: string) => void) {
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(chunk, { stream: true });
    let idx = buf.indexOf("\n");
    while (idx >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line) onLine(line);
      idx = buf.indexOf("\n");
    }
  }
  buf += decoder.decode();
  if (buf.trim()) onLine(buf.trim());
}

interface CodexEvent {
  type?: string;
  delta?: string;
  message?: string;
  name?: string;
  session_id?: string;
}

function handleEvent(line: string, spawn: AgentSpawn, captureSession: (id: string) => void) {
  let evt: CodexEvent;
  try {
    evt = JSON.parse(line) as CodexEvent;
  } catch {
    return;
  }
  if (evt.session_id && typeof evt.session_id === "string") captureSession(evt.session_id);

  if (evt.type === "agent_message_delta" && typeof evt.delta === "string") {
    spawn.emit({ type: "assistant_partial", text: evt.delta });
    return;
  }
  if (evt.type === "agent_message" && typeof evt.message === "string") {
    spawn.emit({ type: "assistant_text", text: evt.message });
    return;
  }
  if (evt.type === "tool_call" && typeof evt.name === "string") {
    spawn.emit({ type: "tool_use", name: evt.name });
    return;
  }
}
