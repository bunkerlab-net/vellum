import type { Agent, AgentSpawn } from "./types";

export function opencodeAgent(spawn: AgentSpawn): Agent {
  let sessionId: string | undefined;
  let activeProc: ReturnType<typeof Bun.spawn> | null = null;
  let queued: Promise<void> = Promise.resolve();

  spawn.emit({ type: "ready", agent: "opencode" });

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
    const args = [
      "opencode",
      "run",
      "--format",
      "json",
      ...(sessionId ? ["--session", sessionId] : []),
      ...spawn.argv,
      "--",
      text,
    ];
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
        streamLines(proc.stderr, (line) => process.stderr.write(`[opencode] ${line}\n`)),
      ]);

      const code = await proc.exited;
      if (code !== 0) {
        spawn.emit({
          type: "error",
          message: `opencode exited with code ${code}`,
        });
      }
    } catch (err) {
      spawn.emit({
        type: "error",
        message: `opencode stream failed: ${err instanceof Error ? err.message : String(err)}`,
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

interface OpenCodeEvent {
  type?: string;
  text?: string;
  name?: string;
  session_id?: string;
  sessionID?: string;
}

function handleEvent(line: string, spawn: AgentSpawn, captureSession: (id: string) => void) {
  let evt: OpenCodeEvent;
  try {
    evt = JSON.parse(line) as OpenCodeEvent;
  } catch {
    return;
  }
  if (evt.session_id && typeof evt.session_id === "string") captureSession(evt.session_id);
  if (evt.sessionID && typeof evt.sessionID === "string") captureSession(evt.sessionID);

  if (evt.type === "delta" && typeof evt.text === "string") {
    spawn.emit({ type: "assistant_partial", text: evt.text });
    return;
  }
  if (evt.type === "message" && typeof evt.text === "string") {
    spawn.emit({ type: "assistant_text", text: evt.text });
    return;
  }
  if (evt.type === "tool" && typeof evt.name === "string") {
    spawn.emit({ type: "tool_use", name: evt.name });
    return;
  }
  if (typeof evt.text === "string") {
    spawn.emit({ type: "assistant_text", text: evt.text });
  }
}
