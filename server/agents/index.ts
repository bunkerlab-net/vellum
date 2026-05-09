import { claudeAgent } from "./claude";
import { opencodeAgent } from "./opencode";
import type { AgentFactory } from "./types";

export const agents: Record<string, AgentFactory> = {
  claude: claudeAgent,
  opencode: opencodeAgent,
};

export type AgentName = keyof typeof agents;

export type {
  Agent,
  AgentSpawn,
  ClientMsg,
  EmitFn,
  ServerMsg,
  ServerMsgIn,
} from "./types";
