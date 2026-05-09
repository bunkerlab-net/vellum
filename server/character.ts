import { type Dirent, existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export interface Ability {
  score: number;
  modifier: number;
  save: number;
  saveProficient: boolean;
}

export interface Character {
  slug: string;
  name: string;
  player?: string;
  race?: string;
  className: string;
  subclass?: string;
  level: number;
  background?: string;
  abilities: {
    STR: Ability;
    DEX: Ability;
    CON: Ability;
    INT: Ability;
    WIS: Ability;
    CHA: Ability;
  };
  skills: Record<string, number>;
  hp: { current: number; max: number };
  ac: number;
  speed: string;
  initiative: number;
  proficiencyBonus: number;
  hitDice?: { current: number; max: number; die: string };
  spellSlots: { level: number; current: number; max: number }[];
  preparedSpells: string[];
  cantrips: string[];
  equipped: { slot: string; name: string; stats: string; weight: number }[];
  inventory: { name: string; qty: number; weight: number; notes: string }[];
  currency: { gp: number; sp: number; cp: number; ep: number; pp: number };
  totalWeight: number;
  carryCap: number;
  primaryAttackBonus: number;
  portrait: string;
  bigPortrait: string;
  hasSmallPortrait: boolean;
  hasBigPortrait: boolean;
  campaign: string;
  location: string;
  inGameDate: string;
  sessionLabel: string | null;
}

export async function loadCharacter(
  projectRoot: string,
  campaignSlug: string,
  characterSlug: string,
): Promise<Character | null> {
  const safeCampaign = sanitizeSlug(campaignSlug);
  const safeCharacter = sanitizeSlug(characterSlug);
  if (!safeCampaign || !safeCharacter) return null;
  const campaignsDir = join(projectRoot, "campaigns");
  const sheetFile = join(campaignsDir, safeCampaign, "characters", `${safeCharacter}.md`);
  if (!existsSync(sheetFile)) return null;

  try {
    const sheetText = await Bun.file(sheetFile).text();
    const stateFile = join(campaignsDir, safeCampaign, "state.md");
    const meta = existsSync(stateFile) ? parseState(await Bun.file(stateFile).text()) : {};
    const assetsDir = join(campaignsDir, safeCampaign, "assets");
    const smallFile = join(assetsDir, `${safeCharacter}-portrait.png`);
    const bigFile = join(assetsDir, `${safeCharacter}-big-portrait.png`);
    const smallVersion = existsSync(smallFile) ? Math.floor(statSync(smallFile).mtimeMs) : 0;
    const bigVersion = existsSync(bigFile) ? Math.floor(statSync(bigFile).mtimeMs) : 0;
    return parseCharacter(safeCharacter, sheetText, safeCampaign, meta, smallVersion, bigVersion);
  } catch (err) {
    console.error(`[character] failed to load ${safeCampaign}/${safeCharacter}:`, err);
    return null;
  }
}

export async function listCampaigns(projectRoot: string): Promise<
  {
    slug: string;
    characters: string[];
  }[]
> {
  const campaignsDir = join(projectRoot, "campaigns");
  if (!existsSync(campaignsDir)) return [];
  let entries: Dirent[];
  try {
    entries = (await readdir(campaignsDir, {
      withFileTypes: true,
    })) as Dirent[];
  } catch (err) {
    console.error(`[character] failed to read ${campaignsDir}:`, err);
    return [];
  }
  const out: { slug: string; characters: string[] }[] = [];
  for (const dirent of entries) {
    if (!dirent.isDirectory()) continue;
    const slug = dirent.name;
    const charsDir = join(campaignsDir, slug, "characters");
    if (!existsSync(charsDir)) continue;
    try {
      const charFiles = (await readdir(charsDir, { withFileTypes: true })).filter(
        (f) => f.isFile() && f.name.endsWith(".md"),
      );
      const characters = charFiles.map((f) => f.name.slice(0, -3)).sort((a, b) => a.localeCompare(b));
      out.push({ slug, characters });
    } catch (err) {
      console.warn(`[character] skipping unreadable campaign ${slug}:`, err);
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

function sanitizeSlug(s: string): string {
  return s.replace(/[^a-z0-9_-]/gi, "");
}

interface StateMeta {
  activeCharacter?: string;
  location?: string;
  inGameDate?: string;
  sessionCounter?: number;
  sessionActive?: boolean;
}

function parseState(md: string): StateMeta {
  const meta: StateMeta = {};
  for (const line of md.split("\n")) {
    let m = line.match(/^-\s*\*\*Active character:\*\*\s*(.+)$/i);
    if (m) meta.activeCharacter = m[1].trim();
    m = line.match(/^-\s*\*\*Location:\*\*\s*(.+)$/i);
    if (m) meta.location = m[1].trim();
    m = line.match(/^-\s*\*\*In-game date:\*\*\s*(.+)$/i);
    if (m) meta.inGameDate = m[1].trim();
    m = line.match(/^-\s*\*\*Session counter:\*\*\s*(\d+)/i);
    if (m) meta.sessionCounter = Number(m[1]);
    m = line.match(/^-\s*\*\*Last session status:\*\*\s*(\w+)/i);
    if (m) meta.sessionActive = m[1].trim().toLowerCase() === "active";
  }
  return meta;
}

function parseCharacter(
  slug: string,
  md: string,
  campaign: string,
  state: StateMeta,
  smallVersion: number,
  bigVersion: number,
): Character {
  const heading = md.match(/^#\s+(.+)$/m);
  const name = heading ? heading[1].trim() : slug;

  const player = bullet(md, "Player");
  const race = bullet(md, "Race / Subrace") ?? bullet(md, "Race");
  const classLine = bullet(md, "Class / Subclass") ?? bullet(md, "Class") ?? "";
  const { className, subclass, level } = parseClass(classLine);
  const background = bullet(md, "Background");

  const abilities = parseAbilities(md);
  const saveProficient = parseSaves(md);
  for (const k of Object.keys(abilities) as (keyof typeof abilities)[]) {
    abilities[k].saveProficient = saveProficient[k] ?? false;
  }

  const skills = parseSkills(md);

  const hp = parseHP(md);
  const ac = parseAC(md);
  const speed = bulletInSection(md, "Combat", "Speed") ?? "30 ft";
  const initiative = parseSignedBullet(md, "Initiative") ?? 0;
  const proficiencyBonus = parseSignedBullet(md, "Proficiency Bonus") ?? 2;
  const hitDice = parseHitDice(md);

  const spellSlots = parseSpellSlots(md);
  const cantrips = parseListUnderHeading(md, /###\s*Cantrips/i);
  const preparedSpells = parsePreparedSpells(md);

  const { equipped, inventory } = parseGear(md);
  const currency = parseCurrency(md);
  const totalWeight = parseSignedBullet(md, "Total weight") ?? 0;
  const carryCap = parseCarryCap(md);

  const primaryAttackBonus = parseFirstAttackBonus(md, abilities);

  const sessionLabel = state.sessionActive && state.sessionCounter ? `Session ${roman(state.sessionCounter)}` : null;

  return {
    slug,
    name,
    player: player ?? undefined,
    race: race ?? undefined,
    className,
    subclass,
    level,
    background: background ?? undefined,
    abilities,
    skills,
    hp,
    ac,
    speed,
    initiative,
    proficiencyBonus,
    hitDice,
    spellSlots,
    preparedSpells,
    cantrips,
    equipped,
    inventory,
    currency,
    totalWeight,
    carryCap,
    primaryAttackBonus,
    portrait: `/assets/portrait/${slug}?campaign=${campaign}${smallVersion ? `&v=${smallVersion}` : ""}`,
    bigPortrait: `/assets/portrait/${slug}?campaign=${campaign}&variant=big${bigVersion ? `&v=${bigVersion}` : ""}`,
    hasSmallPortrait: smallVersion > 0,
    hasBigPortrait: bigVersion > 0,
    campaign,
    location: state.location ?? "",
    inGameDate: state.inGameDate ?? "",
    sessionLabel,
  };
}

function bullet(md: string, key: string): string | undefined {
  const re = new RegExp(`^-\\s*\\*\\*${escapeRegex(key)}:?\\*\\*\\s*(.+)$`, "im");
  const m = md.match(re);
  return m ? m[1].trim() : undefined;
}

function bulletInSection(md: string, section: string, key: string): string | undefined {
  const block = sliceSection(md, section);
  if (!block) return undefined;
  return bullet(block, key);
}

function sliceSection(md: string, heading: string): string | undefined {
  const re = new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, "im");
  const m = md.match(re);
  return m ? m[1] : undefined;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseClass(line: string): {
  className: string;
  subclass?: string;
  level: number;
} {
  const m = line.match(/^([^—()]+?)(?:\s*\(([^)]+)\))?\s*[—-]\s*Level\s+(\d+)/i);
  if (!m) return { className: line || "Adventurer", level: 1 };
  return {
    className: m[1].trim(),
    subclass: m[2]?.trim(),
    level: Number(m[3]),
  };
}

function parseAbilities(md: string): Character["abilities"] {
  const block = sliceSection(md, "Ability Scores") ?? "";
  const rows = block.match(/^\|\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma).+$/gim) ?? [];
  const map: Record<string, keyof Character["abilities"]> = {
    Strength: "STR",
    Dexterity: "DEX",
    Constitution: "CON",
    Intelligence: "INT",
    Wisdom: "WIS",
    Charisma: "CHA",
  };
  const result = blankAbilities();
  for (const row of rows) {
    const cells = row
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    const [label, , , scoreStr, modStr] = cells;
    const key = map[label];
    if (!key) continue;
    const score = Number(scoreStr) || 10;
    const modifier = Number(modStr.replace(/^\+/, "")) || Math.floor((score - 10) / 2);
    result[key] = {
      score,
      modifier,
      save: modifier,
      saveProficient: false,
    };
  }
  return result;
}

function parseSaves(md: string): Partial<Record<keyof Character["abilities"], boolean>> {
  const block = sliceSection(md, "Saving Throws") ?? "";
  const map: Record<string, keyof Character["abilities"]> = {
    Strength: "STR",
    Dexterity: "DEX",
    Constitution: "CON",
    Intelligence: "INT",
    Wisdom: "WIS",
    Charisma: "CHA",
  };
  const out: Partial<Record<keyof Character["abilities"], boolean>> = {};
  const rows = block.match(/^\|\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma).+$/gim) ?? [];
  for (const row of rows) {
    const cells = row
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    const [label, , profCell] = cells;
    const key = map[label];
    if (!key) continue;
    const proficient = profCell !== "—" && /\+/.test(profCell);
    out[key] = proficient;
  }
  return out;
}

function parseSkills(md: string): Record<string, number> {
  const block = sliceSection(md, "Skills") ?? "";
  const out: Record<string, number> = {};
  const rows = block.match(/^\|\s*([A-Z][\w ]+?)\s*\|/gim) ?? [];
  for (const line of block.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 5) continue;
    const name = cells[1];
    const bonus = cells[3];
    if (!name || !bonus || /^Skill$/i.test(name) || /^---/.test(bonus)) continue;
    const n = Number(bonus.replace(/^\+/, ""));
    if (!Number.isNaN(n)) out[name.toLowerCase()] = n;
  }
  void rows;
  return out;
}

function parseHP(md: string): { current: number; max: number } {
  const v = bulletInSection(md, "Combat", "HP") ?? "0 / 0";
  const m = v.match(/(\d+)\s*\/\s*(\d+)/);
  return { current: m ? Number(m[1]) : 0, max: m ? Number(m[2]) : 0 };
}

function parseAC(md: string): number {
  const v = bulletInSection(md, "Combat", "AC") ?? "10";
  const m = v.match(/(\d+)/);
  return m ? Number(m[1]) : 10;
}

function parseSignedBullet(md: string, key: string): number | undefined {
  const v = bulletInSection(md, "Combat", key) ?? bullet(md, key);
  if (!v) return undefined;
  const m = v.match(/([+-]?\d+)/);
  return m ? Number(m[1]) : undefined;
}

function parseHitDice(md: string): Character["hitDice"] {
  const v = bulletInSection(md, "Combat", "Hit Dice");
  if (!v) return undefined;
  const m = v.match(/(\d+)\s*\/\s*(\d+)(d\d+)/i);
  if (!m) return undefined;
  return { current: Number(m[1]), max: Number(m[2]), die: m[3] };
}

function parseSpellSlots(md: string): Character["spellSlots"] {
  const slots: Character["spellSlots"] = [];
  const re = /\*\*Spell slots\s*\((\d)(?:st|nd|rd|th)\):\*\*\s*(\d+)\s*\/\s*(\d+)/gi;
  for (const m of md.matchAll(re)) {
    slots.push({
      level: Number(m[1]),
      current: Number(m[2]),
      max: Number(m[3]),
    });
  }
  return slots;
}

function parseListUnderHeading(md: string, headingRe: RegExp): string[] {
  const headings = md.split(/^#/m);
  for (const block of headings) {
    if (!headingRe.test(`#${block.split("\n")[0]}`)) continue;
    const items: string[] = [];
    for (const line of block.split("\n").slice(1)) {
      if (/^#/.test(line)) break;
      const m = line.match(/^-\s+(.+)$/);
      if (m) items.push(m[1].trim());
    }
    if (items.length) return items;
  }
  return [];
}

function parsePreparedSpells(md: string): string[] {
  const spellSection = md.match(/Prepared\s*\([^)]+\):\s*([\s\S]*?)(?:\n##|\n###|$)/i);
  if (!spellSection) return [];
  const items: string[] = [];
  for (const line of spellSection[1].split("\n")) {
    const m = line.match(/^-\s+(.+)$/);
    if (m) items.push(m[1].trim());
  }
  return items;
}

function parseGear(md: string): {
  equipped: Character["equipped"];
  inventory: Character["inventory"];
} {
  const equipped: Character["equipped"] = [];
  const inventory: Character["inventory"] = [];

  const equippedBlock = sliceSection(md, "Equipped");
  if (equippedBlock) {
    for (const line of equippedBlock.split("\n")) {
      const cells = line.split("|").map((c) => c.trim());
      if (cells.length < 5) continue;
      const [, slot, name, stats, weight] = cells;
      if (!slot || /^Slot$/i.test(slot) || /^---/.test(slot)) continue;
      equipped.push({
        slot,
        name,
        stats,
        weight: Number(weight.replace(/[^\d.]/g, "")) || 0,
      });
    }
  }

  const inventoryBlock =
    sliceSection(md, "Inventory") ??
    // Backwards compat: legacy sheets used a single `## Equipment` block
    sliceSection(md, "Equipment") ??
    "";
  for (const line of inventoryBlock.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 4) continue;
    const [, name, qty, weight, notes = ""] = cells;
    if (!name || /^Item$/i.test(name) || /^---/.test(qty)) continue;
    inventory.push({
      name,
      qty: Number(qty.replace(/[^\d]/g, "")) || 1,
      weight: Number(weight.replace(/[^\d.]/g, "")) || 0,
      notes: notes.trim(),
    });
  }

  return { equipped, inventory };
}

function parseCurrency(md: string): Character["currency"] {
  const block = sliceSection(md, "Inventory") ?? sliceSection(md, "Equipment") ?? md;
  const c: Character["currency"] = { gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 };
  const line = block.match(/\*\*Currency:?\*\*\s*(.+)/i);
  if (!line) return c;
  for (const m of line[1].matchAll(/(\d+)\s*(gp|sp|cp|ep|pp)/gi)) {
    const denom = m[2].toLowerCase() as keyof Character["currency"];
    c[denom] = Number(m[1]);
  }
  return c;
}

function parseCarryCap(md: string): number {
  const block = sliceSection(md, "Inventory") ?? sliceSection(md, "Equipment") ?? md;
  const m = block.match(/\/\s*(\d+)\s*lb\s*\(STR/i);
  return m ? Number(m[1]) : 150;
}

function parseFirstAttackBonus(md: string, abilities: Character["abilities"]): number {
  const block = sliceSection(md, "Attacks & Spellcasting") ?? "";
  for (const line of block.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 4) continue;
    const bonus = cells[2];
    const m = bonus?.match(/^([+-]?\d+)/);
    if (m) return Number(m[1]);
  }
  return abilities.STR.modifier;
}

function blankAbilities(): Character["abilities"] {
  const a: Ability = { score: 10, modifier: 0, save: 0, saveProficient: false };
  return {
    STR: { ...a },
    DEX: { ...a },
    CON: { ...a },
    INT: { ...a },
    WIS: { ...a },
    CHA: { ...a },
  };
}

function roman(n: number): string {
  const map: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [v, s] of map) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}
