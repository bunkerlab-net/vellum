---
name: campaign-creation
description: Interview-driven D&D 5e (2014) campaign setup. Trigger when the player wants to start a new campaign, world, setting, or adventure. Establishes premise, setting, tone, length expectations, starting region, factions, and house rules; creates the campaigns/<slug>/ directory tree with campaign.md, state.md, and seed world files.
---

# Campaign Creation

Set up a new campaign. Conduct as a structured interview. Per `AGENTS.md`, **batch structured pick-from-N choices via `AskUserQuestion`** (up to 4 questions per call, 2–4 curated options each). Reasonable batches here: setting + tone + length-cap + pacing in one call, then sourcebook-scope + house-rules toggles in another. Reserve plain-prose questions for genuinely open-ended steps (premise text, primary antagonist, themes). Default to all official 5e (2014) sources but let the player constrain the world's scope (e.g., "PHB only", "no firearms", "low magic"). The player may say "surprise me" at any step — make a sensible choice and explain it briefly.

## 0. Prerequisites

- Confirm `mise` is available: `mise --version`.
- Confirm dice work: `mise run roll -- 1d20`.

## 1. Name & Slug

Ask the player for a campaign name. Derive a slug (lowercase, hyphenated, ASCII). Confirm the slug.

Reject if `campaigns/<slug>/` already exists — ask for a different name or whether to load the existing one.

## 2. Setting

Ask which setting:
- Forgotten Realms
- Eberron
- Ravenloft / domains of dread
- Wildemount / Exandria
- Theros, Strixhaven, Spelljammer, Planescape, Dragonlance (any official setting)
- Custom homebrew (interview-derived)

If homebrew, capture: world name, dominant races/cultures, magic prevalence, technology level, cosmology basics.

## 3. Tone & Length

- **Tone:** heroic / gritty / dark / horror / comedic / political-intrigue. The player can blend.
- **Length:** one-shot (1 session), short arc (levels 1–5), mid (1–10), full (1–20).
- **Pacing:** milestone leveling vs. XP. Default milestone for solo play unless the player picks XP.

## 4. Themes & Content Scope

- Core themes the player wants explored (e.g., redemption, lost civilizations, war, cosmic horror).
- Content lines: anything the player wants off the table (specific topics, body horror, etc.). Record these and respect them throughout play.
- Sourcebook scope: all official by default; restrict if the player asks.

## 5. Starting Region

Capture for `world/regions.md`:
- Region name and brief description (geography, climate, dominant culture).
- Starting location (settlement / dungeon / wilderness camp): name, size, ruling power, vibe.
- 3–5 named landmarks or points of interest in walking distance.

## 6. Premise & Opening Hook

- One-paragraph premise (the elevator pitch).
- The opening hook: how the player character is drawn in (job offer, personal stakes, urgent crisis, mystery).
- The long arc: what success at level 20 (or the campaign's cap) looks like. Vague is fine; this is a north star, not a contract.
- The primary antagonist or opposing force (can be unknown to the player at start; record openly in `campaign.md` since this is your DM notes).

## 7. Factions

Capture 2–4 factions for `world/factions.md`. For each:
- Name.
- Purpose / what they want.
- Methods (open / covert / mercantile / militant).
- Default attitude toward the PC: friendly, neutral, suspicious, hostile.
- 1–2 named NPCs the player might meet.

## 8. House Rules

Confirm or override defaults. Record on `campaign.md`:
- Critical hits: max die + roll (PHB default) vs. doubled dice vs. brutal critical.
- Resting: PHB (short = 1hr, long = 8hr) vs. gritty realism (short = 8hr, long = 7 days) vs. heroic (short = 5min, long = 1hr).
- Death saves: standard PHB.
- Inspiration: standard PHB or homebrew variant.
- Multiclassing & feats: allowed (default) or not.
- Optional rules from DMG/Tasha's: flanking, healing surges, etc. — opt in case-by-case.
- Origin rules: PHB defaults vs. Tasha's "Customizing Your Origin".

## 9. Persist

Create the directory tree and files:

```
campaigns/<slug>/
  campaign.md
  state.md
  characters/
  encounters/
  quests/
  sessions/
  world/
    regions.md
    factions.md
```

Use the templates below. Fill in everything captured during the interview.

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8, no trailing whitespace).

## 10. Confirm

Read back a tight summary: setting, tone, premise, starting region, factions, the headline house rules. Ask if the player wants to adjust anything. Apply edits, save, end the skill. Suggest `/character-creation` as the next step if no PC exists yet.

---

## Templates

### `campaign.md`

````markdown
# {{Campaign Name}}

- **Slug:** {{slug}}
- **Setting:** {{setting}}
- **Tone:** {{tone}}
- **Length / Cap:** {{length}}
- **Pacing:** {{milestone | xp}}
- **Created:** {{ISO date}}
- **Source rules:** D&D 5e (2014)
- **Sourcebook scope:** {{all official | restricted to ...}}

## Premise

{{one-paragraph premise}}

## Opening Hook

{{how the PC is drawn in}}

## Long Arc

{{what success at level cap looks like}}

## Primary Antagonist / Opposing Force

{{antagonist notes — DM-only context}}

## Themes

- {{theme}}
- ...

## Content Lines

- Off the table: {{topics}}

## House Rules

- **Critical hits:** ...
- **Resting:** ...
- **Death saves:** ...
- **Inspiration:** ...
- **Multiclassing / feats:** ...
- **Origin rules:** ...
- **Optional rules in play:** ...

## Open Threads

(populated during play)
````

### `state.md`

````markdown
# Campaign State — {{Campaign Name}}

- **Active character:** null
- **Location:** {{starting location}}
- **In-game date:** {{starting date or null}}
- **Active quests:** []
- **Last session:** null
- **Last session status:** closed
- **Last session real-world date:** null
- **Where we left off:** null
````

### `world/regions.md`

````markdown
# Regions

## {{Starting Region Name}}

{{description: geography, climate, culture}}

### {{Starting Location}}

- **Type:** {{settlement | dungeon | wilderness camp}}
- **Size / population:** ...
- **Ruling power:** ...
- **Vibe:** ...

### Landmarks

- **{{name}}** — {{one-line description}}
- ...
````

### `world/factions.md`

````markdown
# Factions

## {{Faction Name}}

- **Purpose:** ...
- **Methods:** ...
- **Attitude toward PC:** {{friendly | neutral | suspicious | hostile}}
- **Notable NPCs:**
  - **{{NPC name}}** — {{role, brief description}}

(repeat per faction)
````
