#!/usr/bin/env bun

const usage = `Usage: bun run scripts/roll.ts <expression>
  Examples: 4d6dl1, 1d20+5, 2d8+3, 3d6kh2-1, 1d20+3+1d4
  Operators: dlN drop-lowest, dhN drop-highest, khN keep-highest, klN keep-lowest
  Compound:  chain dice and constants with + or - (e.g. 1d20+3+1d4-2)`;

const input = Bun.argv[2];
if (!input) {
	console.info(usage);
	process.exit(0);
}

type DiceOp = "dl" | "dh" | "kh" | "kl";

type DiceTerm = {
	kind: "dice";
	sign: 1 | -1;
	n: number;
	sides: number;
	op?: DiceOp;
	k?: number;
	label: string;
};

type ConstTerm = {
	kind: "const";
	sign: 1 | -1;
	value: number;
};

type Term = DiceTerm | ConstTerm;

function parseExpression(raw: string): Term[] {
	const stripped = raw.replace(/\s+/g, "");
	if (!stripped) throw new Error("empty expression");

	const tokenRe = /^([+-]?)(\d+d\d+(?:(?:dl|dh|kh|kl)\d+)?|\d+)/i;
	const terms: Term[] = [];
	let cursor = 0;

	while (cursor < stripped.length) {
		const match = stripped.slice(cursor).match(tokenRe);
		if (!match) {
			throw new Error(
				`unexpected character "${stripped[cursor]}" at position ${cursor}`,
			);
		}
		const [whole, signStr, body] = match;

		if (terms.length > 0 && !signStr) {
			throw new Error(
				`missing operator before "${body}" at position ${cursor}`,
			);
		}

		const sign: 1 | -1 = signStr === "-" ? -1 : 1;

		if (/^\d+$/.test(body)) {
			terms.push({ kind: "const", sign, value: parseInt(body, 10) });
			cursor += whole.length;
			continue;
		}

		const dm = body.match(/^(\d+)d(\d+)(?:(dl|dh|kh|kl)(\d+))?$/i);
		if (!dm) throw new Error(`cannot parse dice "${body}"`);
		const n = parseInt(dm[1], 10);
		const sides = parseInt(dm[2], 10);
		const op = dm[3]?.toLowerCase() as DiceOp | undefined;
		const k = dm[4] ? parseInt(dm[4], 10) : undefined;

		if (n <= 0 || sides <= 1) throw new Error(`invalid dice "${body}"`);
		if (op && (k === undefined || k <= 0 || k >= n)) {
			throw new Error(
				`drop/keep count must be > 0 and < dice count (${n}) in "${body}"`,
			);
		}

		terms.push({
			kind: "dice",
			sign,
			n,
			sides,
			op,
			k,
			label: body.toLowerCase(),
		});
		cursor += whole.length;
	}

	if (terms.length === 0) throw new Error("no terms parsed");
	return terms;
}

function rollDie(sides: number): number {
	const ceiling = Math.floor(2 ** 32 / sides) * sides;
	const buf = new Uint32Array(1);
	while (true) {
		crypto.getRandomValues(buf);
		if (buf[0] < ceiling) return (buf[0] % sides) + 1;
	}
}

type DiceResult = {
	rolls: number[];
	kept: number[];
	dropped: number[];
	subtotal: number;
};

function rollDiceTerm(term: DiceTerm): DiceResult {
	const rolls: number[] = [];
	for (let i = 0; i < term.n; i++) rolls.push(rollDie(term.sides));

	if (!term.op) {
		return {
			rolls,
			kept: [...rolls],
			dropped: [],
			subtotal: rolls.reduce((a, b) => a + b, 0),
		};
	}

	const ascending = rolls.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
	const k = term.k ?? 0;
	const n = term.n;
	let dropIdx: Set<number>;

	switch (term.op) {
		case "dl":
			dropIdx = new Set(ascending.slice(0, k).map((d) => d.i));
			break;
		case "kh":
			dropIdx = new Set(ascending.slice(0, n - k).map((d) => d.i));
			break;
		case "dh":
			dropIdx = new Set(ascending.slice(n - k).map((d) => d.i));
			break;
		case "kl":
			dropIdx = new Set(ascending.slice(k).map((d) => d.i));
			break;
	}

	const kept = rolls.filter((_, i) => !dropIdx.has(i));
	const dropped = rolls.filter((_, i) => dropIdx.has(i));
	return { rolls, kept, dropped, subtotal: kept.reduce((a, b) => a + b, 0) };
}

let terms: Term[];
try {
	terms = parseExpression(input);
} catch (e) {
	console.error(`Invalid dice expression: ${input}`);
	if (e instanceof Error) console.error(`  ${e.message}`);
	console.info(usage);
	process.exit(1);
}

console.log(`Expression: ${input}`);
let total = 0;

for (let i = 0; i < terms.length; i++) {
	const t = terms[i];
	const opStr = t.sign === -1 ? "-" : i === 0 ? "" : "+";

	if (t.kind === "const") {
		total += t.sign * t.value;
		console.log(`  ${opStr}${t.value}`);
		continue;
	}

	const r = rollDiceTerm(t);
	total += t.sign * r.subtotal;
	const display = r.dropped.length
		? `rolls [${r.rolls.join(", ")}], kept [${r.kept.join(", ")}], dropped [${r.dropped.join(", ")}]`
		: `[${r.rolls.join(", ")}]`;
	console.log(`  ${opStr}${t.label}: ${display} = ${r.subtotal}`);
}

console.log(`Total: ${total}`);
