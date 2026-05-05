#!/usr/bin/env bun

const usage = `Usage: bun run scripts/roll.ts <expression>
  Examples: 4d6dl1, 1d20+5, 2d8+3, 3d6kh2-1
  Operators: dlN drop-lowest, dhN drop-highest, khN keep-highest, klN keep-lowest`;

const expr = Bun.argv[2];
if (!expr) {
  console.info(usage);
  process.exit(0);
}

const match = expr.match(/^(\d+)d(\d+)(?:(dl|dh|kh|kl)(\d+))?([+-]\d+)?$/);
if (!match) {
  console.error(`Invalid dice expression: ${expr}`);
  console.info(usage);
  process.exit(1);
}

const [, nStr, sidesStr, op, kStr, modStr] = match;
const n = parseInt(nStr, 10);
const sides = parseInt(sidesStr, 10);
const k = kStr ? parseInt(kStr, 10) : 0;
const mod = modStr ? parseInt(modStr, 10) : 0;

if (n <= 0 || sides <= 1) {
  console.error("Dice count must be > 0 and sides must be > 1");
  process.exit(1);
}
if (op && (k <= 0 || k >= n)) {
  console.error(`Drop/keep count must be > 0 and < dice count (${n})`);
  process.exit(1);
}

function rollDie(sides: number): number {
  const ceiling = Math.floor(2 ** 32 / sides) * sides;
  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < ceiling) {
      return (buf[0] % sides) + 1;
    }
  }
}

const rolls: number[] = [];
for (let i = 0; i < n; i++) rolls.push(rollDie(sides));

let kept = [...rolls];
let dropped: number[] = [];

if (op) {
  const indexed = rolls.map((v, i) => ({ v, i }));
  const ascending = [...indexed].sort((a, b) => a.v - b.v);
  let dropCount: number;
  let dropIdx: Set<number>;

  if (op === "dl") {
    dropCount = k;
    dropIdx = new Set(ascending.slice(0, dropCount).map((d) => d.i));
  } else if (op === "kh") {
    dropCount = n - k;
    dropIdx = new Set(ascending.slice(0, dropCount).map((d) => d.i));
  } else if (op === "dh") {
    dropCount = k;
    dropIdx = new Set(ascending.slice(n - dropCount).map((d) => d.i));
  } else {
    dropCount = n - k;
    dropIdx = new Set(ascending.slice(n - dropCount).map((d) => d.i));
  }

  kept = rolls.filter((_, i) => !dropIdx.has(i));
  dropped = rolls.filter((_, i) => dropIdx.has(i));
}

const subtotal = kept.reduce((a, b) => a + b, 0);
const total = subtotal + mod;

console.log(`Expression: ${expr}`);
console.log(`Rolls: [${rolls.join(", ")}]`);
if (dropped.length > 0) {
  console.log(`Kept: [${kept.join(", ")}]  Dropped: [${dropped.join(", ")}]`);
}
if (mod !== 0) {
  console.log(`Subtotal: ${subtotal}  Modifier: ${mod >= 0 ? "+" : ""}${mod}`);
}
console.log(`Total: ${total}`);
