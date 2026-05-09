import { claudeAgent } from "./claude";
import { codexAgent } from "./codex";
import { opencodeAgent } from "./opencode";
import type { AgentFactory } from "./types";

export const agents = {
  claude: claudeAgent,
  opencode: opencodeAgent,
  codex: codexAgent,
} satisfies Record<string, AgentFactory>;

export type AgentName = keyof typeof agents;

export type {
  Agent,
  AgentSpawn,
  ClientMsg,
  EmitFn,
  ServerMsg,
  ServerMsgIn,
} from "./types";
