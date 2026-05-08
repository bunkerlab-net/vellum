import { claudeAgent } from "./claude";
import { codexAgent } from "./codex";
import { opencodeAgent } from "./opencode";
import type { AgentFactory } from "./types";

export const agents: Record<string, AgentFactory> = {
  claude: claudeAgent,
  opencode: opencodeAgent,
  codex: codexAgent,
};

export type AgentName = keyof typeof agents | string;

export type {
  Agent,
  AgentSpawn,
  ClientMsg,
  EmitFn,
  ServerMsg,
  ServerMsgIn,
} from "./types";
