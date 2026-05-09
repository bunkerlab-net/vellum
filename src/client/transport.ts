import { useEffect, useRef, useState } from "react";

export type ServerMsg =
  | {
      type: "ready";
      seq: number;
      agent: string;
      sessionId?: string;
      permissionMode?: string;
      model?: string;
      effort?: string;
    }
  | { type: "user_echo"; seq: number; text: string }
  | { type: "assistant_partial"; seq: number; text: string }
  | { type: "assistant_text"; seq: number; text: string }
  | {
      type: "tool_use";
      seq: number;
      name: string;
      toolUseId?: string;
      input?: unknown;
    }
  | { type: "tool_result"; seq: number; name: string; ok: boolean }
  | { type: "permission_mode"; seq: number; mode: string }
  | { type: "model"; seq: number; model: string }
  | { type: "effort"; seq: number; effort: string }
  | { type: "restart"; seq: number; agent: string }
  | { type: "error"; seq: number; message: string; fatal?: boolean }
  | { type: "agent_exit"; seq: number; code: number | null };

export type ClientMsg =
  | { type: "hello"; lastSeq?: number }
  | { type: "user_input"; text: string }
  | { type: "tool_reply"; toolUseId: string; content: string }
  | { type: "set_permission_mode"; mode: string }
  | { type: "set_model"; model: string }
  | { type: "set_effort"; effort: string }
  | { type: "interrupt" }
  | { type: "restart" };

export type ConnectionState = "connecting" | "open" | "closed";

interface TransportOptions {
  onMessage: (msg: ServerMsg) => void;
  onState: (state: ConnectionState) => void;
}

class Transport {
  private ws: WebSocket | null = null;
  private lastSeq = 0;
  private retry = 0;
  private opts: TransportOptions;
  private closed = false;

  constructor(opts: TransportOptions) {
    this.opts = opts;
  }

  start() {
    this.connect();
  }

  stop() {
    this.closed = true;
    this.ws?.close();
  }

  private connect() {
    if (this.closed) return;
    this.opts.onState("connecting");
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.retry = 0;
      this.opts.onState("open");
      const hello: ClientMsg = { type: "hello", lastSeq: this.lastSeq };
      ws.send(JSON.stringify(hello));
    });

    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerMsg;
        if (typeof msg.seq === "number") {
          if (msg.seq <= this.lastSeq) return;
          this.lastSeq = msg.seq;
        }
        this.opts.onMessage(msg);
      } catch {
        // ignore malformed frames
      }
    });

    ws.addEventListener("close", () => {
      this.opts.onState("closed");
      if (this.closed) return;
      const delay = Math.min(30_000, 1_000 * 2 ** this.retry);
      this.retry++;
      setTimeout(() => this.connect(), delay);
    });

    ws.addEventListener("error", () => {
      ws.close();
    });
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn("[transport] dropping message; socket not open", msg.type);
    }
  }
}

export function useTransport(onMessage: (msg: ServerMsg) => void) {
  const [state, setState] = useState<ConnectionState>("connecting");
  const transportRef = useRef<Transport | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const t = new Transport({
      onMessage: (m) => handlerRef.current(m),
      onState: setState,
    });
    transportRef.current = t;
    t.start();
    return () => t.stop();
  }, []);

  const send = (text: string) => transportRef.current?.send({ type: "user_input", text });
  const sendToolReply = (toolUseId: string, content: string) =>
    transportRef.current?.send({ type: "tool_reply", toolUseId, content });
  const setPermissionMode = (mode: string) => transportRef.current?.send({ type: "set_permission_mode", mode });
  const setModel = (model: string) => transportRef.current?.send({ type: "set_model", model });
  const setEffort = (effort: string) => transportRef.current?.send({ type: "set_effort", effort });
  const interrupt = () => transportRef.current?.send({ type: "interrupt" });
  const restart = () => transportRef.current?.send({ type: "restart" });

  return {
    state,
    send,
    sendToolReply,
    setPermissionMode,
    setModel,
    setEffort,
    interrupt,
    restart,
  } as const;
}
