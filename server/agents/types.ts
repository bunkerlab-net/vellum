export type ClientMsg =
  | { type: "hello"; lastSeq?: number }
  | { type: "user_input"; text: string }
  | { type: "tool_reply"; toolUseId: string; content: string }
  | { type: "set_permission_mode"; mode: string }
  | { type: "set_model"; model: string }
  | { type: "set_effort"; effort: string }
  | { type: "interrupt" }
  | { type: "restart" };

export type ServerMsgIn =
  | {
      type: "ready";
      agent: string;
      sessionId?: string;
      permissionMode?: string;
      model?: string;
      effort?: string;
    }
  | { type: "user_echo"; text: string }
  | { type: "assistant_partial"; text: string }
  | { type: "assistant_text"; text: string }
  | { type: "tool_use"; name: string; toolUseId?: string; input?: unknown }
  | { type: "tool_result"; name: string; ok: boolean }
  | { type: "permission_mode"; mode: string }
  | { type: "model"; model: string }
  | { type: "effort"; effort: string }
  | { type: "restart"; agent: string }
  | { type: "error"; message: string; fatal?: boolean }
  | { type: "agent_exit"; code: number | null };

export type ServerMsg = ServerMsgIn & { seq: number };

export type EmitFn = (msg: ServerMsgIn) => void;

export interface Agent {
  send(text: string): Promise<void>;
  sendToolReply?(toolUseId: string, content: string): Promise<void>;
  setModel?(model: string): Promise<void>;
  setEffort?(effort: string): Promise<void>;
  setPermissionMode?(mode: string): Promise<void>;
  interrupt(): void;
  close(): Promise<void>;
  readonly sessionId: string | undefined;
}

export interface AgentSpawn {
  cwd: string;
  argv: string[];
  emit: EmitFn;
  permissionMode?: string;
  model?: string;
  effort?: string;
  resume?: string;
}

export type AgentFactory = (s: AgentSpawn) => Agent;
