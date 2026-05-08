import type { Agent, AgentSpawn } from "./types";

export function claudeAgent(spawn: AgentSpawn): Agent {
	const cmd = [
		"claude",
		"--print",
		"--output-format",
		"stream-json",
		"--input-format",
		"stream-json",
		"--include-partial-messages",
		"--replay-user-messages",
		"--verbose",
		...spawn.argv,
	];

	let sessionId: string | undefined;

	const proc = Bun.spawn({
		cmd,
		cwd: spawn.cwd,
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
	});

	void readEvents(proc.stdout, (raw) =>
		handleEvent(raw, spawn, (id) => (sessionId = id)),
	);
	void drainStderr(proc.stderr, spawn);
	void watchExit(proc, spawn);

	return {
		get sessionId() {
			return sessionId;
		},
		async send(text: string) {
			const frame = {
				type: "user",
				message: { role: "user", content: [{ type: "text", text }] },
			};
			const writer = proc.stdin;
			writer.write(`${JSON.stringify(frame)}\n`);
			writer.flush();
		},
		async sendToolReply(toolUseId: string, content: string) {
			const frame = {
				type: "user",
				message: {
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: toolUseId,
							content,
						},
					],
				},
			};
			const writer = proc.stdin;
			writer.write(`${JSON.stringify(frame)}\n`);
			writer.flush();
		},
		interrupt() {
			proc.kill("SIGINT");
		},
		async close() {
			try {
				proc.stdin.end();
			} catch {}
			proc.kill();
			await proc.exited;
		},
	};
}

async function readEvents(
	stream: ReadableStream<Uint8Array>,
	onLine: (line: string) => void,
) {
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
	if (buf.trim()) onLine(buf.trim());
}

async function drainStderr(
	stream: ReadableStream<Uint8Array>,
	spawn: AgentSpawn,
) {
	const decoder = new TextDecoder();
	for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
		const text = decoder.decode(chunk, { stream: true });
		if (text.trim()) process.stderr.write(`[claude] ${text}`);
		void spawn;
	}
}

async function watchExit(
	proc: ReturnType<typeof Bun.spawn>,
	spawn: AgentSpawn,
) {
	const code = await proc.exited;
	spawn.emit({ type: "agent_exit", code });
}

interface ClaudeEvent {
	type?: string;
	subtype?: string;
	session_id?: string;
	event?: {
		type?: string;
		delta?: { type?: string; text?: string };
	};
	message?: {
		content?: Array<{
			type?: string;
			text?: string;
			id?: string;
			name?: string;
			input?: unknown;
			tool_use_id?: string;
			tool_use_name?: string;
			is_error?: boolean;
		}>;
	};
	is_error?: boolean;
	result?: unknown;
}

function handleEvent(
	line: string,
	spawn: AgentSpawn,
	captureSession: (id: string) => void,
) {
	let evt: ClaudeEvent;
	try {
		evt = JSON.parse(line) as ClaudeEvent;
	} catch {
		return;
	}

	if (evt.type === "system" && evt.subtype === "init") {
		if (evt.session_id) captureSession(evt.session_id);
		spawn.emit({
			type: "ready",
			agent: "claude",
			sessionId: evt.session_id,
		});
		return;
	}

	if (evt.type === "stream_event" && evt.event) {
		const e = evt.event;
		if (
			e.type === "content_block_delta" &&
			e.delta?.type === "text_delta" &&
			e.delta.text
		) {
			spawn.emit({ type: "assistant_partial", text: e.delta.text });
		}
		return;
	}

	if (evt.type === "assistant" && evt.message?.content) {
		for (const block of evt.message.content) {
			if (block.type === "text" && typeof block.text === "string") {
				spawn.emit({ type: "assistant_text", text: block.text });
			} else if (block.type === "tool_use" && block.name) {
				spawn.emit({
					type: "tool_use",
					name: block.name,
					toolUseId: block.id,
					input: block.input,
				});
			}
		}
		return;
	}

	if (evt.type === "user" && evt.message?.content) {
		for (const block of evt.message.content) {
			if (block.type === "tool_result") {
				spawn.emit({
					type: "tool_result",
					name: block.tool_use_name ?? "tool",
					ok: !block.is_error,
				});
			}
		}
		return;
	}

	if (evt.type === "result" && evt.is_error) {
		spawn.emit({ type: "error", message: String(evt.result ?? "agent error") });
	}
}
