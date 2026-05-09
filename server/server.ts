import { existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import type { ServerWebSocket } from "bun";
import type { Agent, ClientMsg, ServerMsg, ServerMsgIn } from "./agents/index";
import { agents } from "./agents/index";
import { listCampaigns, loadCharacter } from "./character";

export type PermissionMode = "default" | "acceptEdits";
const PERMISSION_MODES: PermissionMode[] = ["default", "acceptEdits"];
const EFFORT_LEVELS = ["low", "medium", "high", "xhigh"] as const;
type Effort = (typeof EFFORT_LEVELS)[number];

function isEffort(v: string): v is Effort {
  return (EFFORT_LEVELS as readonly string[]).includes(v);
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

interface StartOptions {
  agentName: string;
  agentArgv: string[];
  port: number;
  cwd: string;
  distDir: string;
  campaignsDir: string;
}

interface SocketData {
  id: number;
}

export async function startServer(opts: StartOptions) {
  const ring: ServerMsg[] = [];
  let seq = 0;
  let agent: Agent | null = null;
  let permissionMode: PermissionMode = "default";
  let model = "";
  let effort: Effort | "" = "";
  let lastSessionId: string | undefined;
  let interruptArmed = false;
  let respawnAttempts = 0;
  const MAX_RAPID_RESPAWNS = 3;
  const clients = new Set<ServerWebSocket<SocketData>>();
  let nextSocketId = 1;

  const broadcast = (msg: ServerMsg) => {
    const json = JSON.stringify(msg);
    for (const ws of clients) ws.send(json);
  };

  const stamp = (msg: ServerMsgIn): ServerMsg => {
    seq++;
    const out: ServerMsg = { ...msg, seq };
    ring.push(out);
    if (ring.length > 200) ring.splice(0, ring.length - 200);
    return out;
  };

  const emit = (msg: ServerMsgIn) => {
    broadcast(stamp(msg));
  };

  const sendOnly = (ws: ServerWebSocket<SocketData>, msg: ServerMsgIn) => {
    ws.send(JSON.stringify(stamp(msg)));
  };

  const onAgentEvent = (msg: ServerMsgIn) => {
    if (msg.type === "ready") {
      if (msg.sessionId) lastSessionId = msg.sessionId;
      // Sync server-tracked state from whatever the SDK actually loaded so the
      // frontend's Settings panel reflects the running session, not just what
      // the user has explicitly overridden.
      if (typeof msg.model === "string") model = msg.model;
      if (typeof msg.permissionMode === "string" && PERMISSION_MODES.includes(msg.permissionMode as PermissionMode)) {
        permissionMode = msg.permissionMode as PermissionMode;
      }
      if (typeof msg.effort === "string" && (msg.effort === "" || isEffort(msg.effort))) {
        effort = msg.effort as Effort | "";
      }
      respawnAttempts = 0;
    }
    if (msg.type === "agent_exit") {
      const wasInterrupted = interruptArmed;
      interruptArmed = false;
      if (wasInterrupted && lastSessionId && respawnAttempts < MAX_RAPID_RESPAWNS) {
        respawnAttempts++;
        // Suppress visible agent_exit, transparently respawn with resume
        setTimeout(() => spawnAgent(lastSessionId), 50);
        return;
      }
    }
    emit(msg);
  };

  const spawnAgent = (resumeId?: string) => {
    const factory = opts.agentName in agents ? agents[opts.agentName as keyof typeof agents] : agents.claude;
    try {
      agent = factory({
        cwd: opts.cwd,
        argv: opts.agentArgv,
        emit: onAgentEvent,
        permissionMode,
        model: model || undefined,
        effort: effort || undefined,
        resume: resumeId,
      });
    } catch (err) {
      emit({
        type: "error",
        message: `Failed to spawn ${opts.agentName}: ${errorMessage(err)}`,
        fatal: true,
      });
    }
  };
  spawnAgent();

  const port = await findFreePort(opts.port);

  const server = Bun.serve<SocketData>({
    port,
    development: false,
    async fetch(req, srv) {
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        const id = nextSocketId++;
        const ok = srv.upgrade(req, { data: { id } });
        if (ok) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      if (url.pathname === "/api/campaigns") {
        try {
          const list = await listCampaigns(opts.cwd);
          return Response.json(list);
        } catch (err) {
          return new Response(`error: ${errorMessage(err)}`, { status: 500 });
        }
      }

      if (url.pathname === "/api/character") {
        const campaign = url.searchParams.get("campaign");
        const character = url.searchParams.get("character");
        if (!campaign || !character) {
          return new Response("missing campaign or character", { status: 400 });
        }
        try {
          const ch = await loadCharacter(opts.cwd, campaign, character);
          if (!ch) return new Response("not found", { status: 404 });
          return Response.json(ch);
        } catch (err) {
          return new Response(`error: ${errorMessage(err)}`, { status: 500 });
        }
      }

      if (url.pathname === "/api/permission-mode") {
        return Response.json({ mode: permissionMode });
      }

      if (url.pathname === "/api/models") {
        if (!agent?.listModels) return Response.json({ models: [] });
        try {
          const models = await agent.listModels();
          return Response.json({ models });
        } catch (err) {
          return new Response(`error: ${errorMessage(err)}`, { status: 500 });
        }
      }

      if (url.pathname.startsWith("/assets/portrait/")) {
        const slug = url.pathname.slice("/assets/portrait/".length);
        const campaignFilter = url.searchParams.get("campaign") ?? undefined;
        const portrait = await findPortrait(opts.campaignsDir, slug, opts.distDir, campaignFilter);
        if (portrait) return new Response(Bun.file(portrait));
        return new Response("not found", { status: 404 });
      }

      return serveStatic(opts.distDir, url.pathname);
    },

    websocket: {
      open(ws) {
        clients.add(ws);
      },
      close(ws) {
        clients.delete(ws);
      },
      message(ws, raw) {
        let msg: ClientMsg;
        try {
          msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
        } catch {
          return;
        }

        if (msg.type === "hello") {
          const after = msg.lastSeq ?? 0;
          for (const m of ring) if (m.seq > after) ws.send(JSON.stringify(m));
          if (!ring.some((m) => m.type === "ready")) {
            sendOnly(ws, {
              type: "ready",
              agent: opts.agentName,
              permissionMode,
              model,
              effort,
            });
          }
          if (!ring.some((m) => m.type === "permission_mode")) {
            sendOnly(ws, { type: "permission_mode", mode: permissionMode });
          }
          if (!ring.some((m) => m.type === "model")) {
            sendOnly(ws, { type: "model", model });
          }
          if (!ring.some((m) => m.type === "effort")) {
            sendOnly(ws, { type: "effort", effort });
          }
          return;
        }

        if (msg.type === "user_input") {
          emit({ type: "user_echo", text: msg.text });
          agent?.send(msg.text).catch((err) => {
            emit({
              type: "error",
              message: `send failed: ${errorMessage(err)}`,
            });
          });
          return;
        }

        if (msg.type === "tool_reply") {
          if (!agent?.sendToolReply) {
            emit({
              type: "error",
              message: "current agent does not support tool replies",
            });
            return;
          }
          agent.sendToolReply(msg.toolUseId, msg.content).catch((err) => {
            emit({
              type: "error",
              message: `tool reply failed: ${errorMessage(err)}`,
            });
          });
          return;
        }

        if (msg.type === "set_permission_mode") {
          if (!PERMISSION_MODES.includes(msg.mode as PermissionMode)) {
            emit({ type: "error", message: `unknown permission mode: ${msg.mode}` });
            return;
          }
          if (msg.mode === permissionMode) return;
          permissionMode = msg.mode as PermissionMode;
          emit({ type: "permission_mode", mode: permissionMode });
          if (agent?.setPermissionMode) {
            agent.setPermissionMode(permissionMode).catch((err) => {
              emit({
                type: "error",
                message: `permission-mode change failed: ${errorMessage(err)}`,
              });
            });
          }
          return;
        }

        if (msg.type === "set_model") {
          const next = typeof msg.model === "string" ? msg.model : "";
          if (next === model) return;
          model = next;
          emit({ type: "model", model });
          if (agent?.setModel) {
            agent.setModel(model).catch((err) => {
              emit({ type: "error", message: `model change failed: ${errorMessage(err)}` });
            });
          }
          return;
        }

        if (msg.type === "set_effort") {
          const next = typeof msg.effort === "string" ? msg.effort : "";
          if (next.length > 0 && !isEffort(next)) {
            emit({ type: "error", message: `unknown effort: ${next}` });
            return;
          }
          if (next === effort) return;
          effort = next as Effort | "";
          emit({ type: "effort", effort });
          if (agent?.setEffort && next.length > 0) {
            agent.setEffort(next).catch((err) => {
              emit({ type: "error", message: `effort change failed: ${errorMessage(err)}` });
            });
          }
          return;
        }

        if (msg.type === "interrupt") {
          interruptArmed = true;
          agent?.interrupt();
          // Disarm if no exit happens shortly (process kept running)
          setTimeout(() => {
            interruptArmed = false;
          }, 5000);
          return;
        }

        if (msg.type === "restart") {
          (async () => {
            emit({ type: "restart", agent: opts.agentName });
            await agent?.close();
            agent = null;
            ring.length = 0;
            respawnAttempts = 0;
            lastSessionId = undefined;
            spawnAgent();
          })().catch((err) => {
            emit({
              type: "error",
              message: `restart failed: ${errorMessage(err)}`,
            });
          });
          return;
        }
      },
    },
  });

  process.on("SIGINT", async () => {
    await agent?.close().catch(() => {});
    server.stop();
    process.exit(0);
  });

  const url = `http://localhost:${port}`;
  console.log(`Vellum is listening at ${url}  (agent: ${opts.agentName})`);
  openInBrowser(url);

  return server;
}

async function findFreePort(start: number, span = 20): Promise<number> {
  for (let p = start; p < start + span; p++) {
    if (await canBind(p)) return p;
  }
  throw new Error(`No free port available in range ${start}-${start + span - 1}`);
}

async function canBind(port: number): Promise<boolean> {
  try {
    const s = Bun.serve({ port, fetch: () => new Response("probe") });
    s.stop();
    return true;
  } catch {
    return false;
  }
}

async function findPortrait(
  campaignsDir: string,
  slug: string,
  distDir: string,
  campaignFilter?: string,
): Promise<string | null> {
  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "");
  if (!safeSlug) return null;
  const safeCampaign = campaignFilter?.replace(/[^a-z0-9_-]/gi, "") || null;

  if (existsSync(campaignsDir)) {
    if (safeCampaign) {
      const candidate = join(campaignsDir, safeCampaign, "assets", `${safeSlug}-portrait.png`);
      if (existsSync(candidate)) return candidate;
    } else {
      const fs = await import("node:fs/promises");
      const dirs = await fs.readdir(campaignsDir, { withFileTypes: true });
      for (const d of dirs) {
        if (!d.isDirectory()) continue;
        const candidate = join(campaignsDir, d.name, "assets", `${safeSlug}-portrait.png`);
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  const fallback = join(distDir, "assets", "portrait-default.png");
  if (existsSync(fallback)) return fallback;
  return null;
}

function serveStatic(distDir: string, pathname: string): Response {
  const cleaned = pathname === "/" ? "/index.html" : pathname;
  const safe = normalize(cleaned).replace(/^([/\\])+/, "");
  const target = resolve(distDir, safe);
  if (!target.startsWith(resolve(distDir))) {
    return new Response("forbidden", { status: 403 });
  }
  if (existsSync(target) && statSync(target).isFile()) {
    return new Response(Bun.file(target), {
      headers: {
        "Content-Type": MIME[extname(target).toLowerCase()] ?? "application/octet-stream",
      },
    });
  }
  // SPA fallback to index.html for unknown routes (no ext)
  if (!extname(cleaned)) {
    const fallback = join(distDir, "index.html");
    if (existsSync(fallback)) {
      return new Response(Bun.file(fallback), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }
  return new Response("not found", { status: 404 });
}

function openInBrowser(url: string) {
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    Bun.spawn({ cmd, stdout: "ignore", stderr: "ignore" });
  } catch {
    // ignore
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
