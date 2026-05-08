import { existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import type { ServerWebSocket } from "bun";
import type { Agent, ClientMsg, ServerMsg, ServerMsgIn } from "./agents/index";
import { agents } from "./agents/index";
import { listCampaigns, loadCharacter } from "./character";

export type PermissionMode = "default" | "acceptEdits";
const PERMISSION_MODES: PermissionMode[] = ["default", "acceptEdits"];

function permissionFlags(mode: PermissionMode, raw: string[]): string[] {
	// Strip any caller-supplied --permission-mode and append our own
	const out: string[] = [];
	for (let i = 0; i < raw.length; i++) {
		if (raw[i] === "--permission-mode") {
			i++;
			continue;
		}
		out.push(raw[i]);
	}
	out.push("--permission-mode", mode);
	return out;
}

function resumeFlags(raw: string[], sessionId: string): string[] {
	const out: string[] = [];
	for (let i = 0; i < raw.length; i++) {
		if (raw[i] === "--resume" || raw[i] === "-r") {
			if (i + 1 < raw.length && !raw[i + 1].startsWith("-")) i++;
			continue;
		}
		out.push(raw[i]);
	}
	out.push("--resume", sessionId);
	return out;
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

	const emit = (msg: ServerMsgIn) => {
		seq++;
		const out: ServerMsg = { ...msg, seq };
		ring.push(out);
		if (ring.length > 200) ring.splice(0, ring.length - 200);
		broadcast(out);
	};

	const onAgentEvent = (msg: ServerMsgIn) => {
		if (msg.type === "ready") {
			if (msg.sessionId) lastSessionId = msg.sessionId;
			respawnAttempts = 0;
		}
		if (msg.type === "agent_exit") {
			const wasInterrupted = interruptArmed;
			interruptArmed = false;
			if (
				wasInterrupted &&
				lastSessionId &&
				respawnAttempts < MAX_RAPID_RESPAWNS
			) {
				respawnAttempts++;
				// Suppress visible agent_exit, transparently respawn with resume
				setTimeout(() => spawnAgent(lastSessionId), 50);
				return;
			}
		}
		emit(msg);
	};

	const spawnAgent = (resumeId?: string) => {
		const factory = agents[opts.agentName] ?? agents.claude;
		let argv = opts.agentArgv;
		if (opts.agentName === "claude") {
			argv = permissionFlags(permissionMode, argv);
			if (resumeId) argv = resumeFlags(argv, resumeId);
		}
		try {
			agent = factory({ cwd: opts.cwd, argv, emit: onAgentEvent });
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

			if (url.pathname.startsWith("/assets/portrait/")) {
				const slug = url.pathname.slice("/assets/portrait/".length);
				const campaignFilter = url.searchParams.get("campaign") ?? undefined;
				const portrait = await findPortrait(
					opts.campaignsDir,
					slug,
					opts.distDir,
					campaignFilter,
				);
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
						emit({
							type: "ready",
							agent: opts.agentName,
							permissionMode,
						});
					}
					if (!ring.some((m) => m.type === "permission_mode")) {
						emit({ type: "permission_mode", mode: permissionMode });
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
						emit({
							type: "error",
							message: `unknown permission mode: ${msg.mode}`,
						});
						return;
					}
					if (msg.mode === permissionMode) return;
					permissionMode = msg.mode as PermissionMode;
					emit({ type: "permission_mode", mode: permissionMode });
					(async () => {
						await agent?.close();
						agent = null;
						spawnAgent();
					})().catch((err) => {
						emit({
							type: "error",
							message: `permission-mode change failed: ${errorMessage(err)}`,
						});
					});
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
	throw new Error(
		`No free port available in range ${start}-${start + span - 1}`,
	);
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
			const candidate = join(
				campaignsDir,
				safeCampaign,
				"assets",
				`${safeSlug}-portrait.png`,
			);
			if (existsSync(candidate)) return candidate;
		} else {
			const fs = await import("node:fs/promises");
			const dirs = await fs.readdir(campaignsDir, { withFileTypes: true });
			for (const d of dirs) {
				if (!d.isDirectory()) continue;
				const candidate = join(
					campaignsDir,
					d.name,
					"assets",
					`${safeSlug}-portrait.png`,
				);
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
				"Content-Type":
					MIME[extname(target).toLowerCase()] ?? "application/octet-stream",
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
