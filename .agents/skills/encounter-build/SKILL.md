---
name: encounter-build
description: Build a balanced D&D 5e (2014) encounter using the DMG encounter-building rules — XP thresholds by character level, monster XP, and the encounter multiplier. Trigger when the DM needs to prep or improvise a combat / skill encounter. Loads the active character from campaigns/<slug>/state.md, asks for difficulty and theme, picks monsters, and writes the encounter to campaigns/<slug>/encounters/<slug>.md.
---

# Encounter Build

Build a mechanically balanced D&D 5e (2014) encounter against the active character. Use the DMG (p. 82) encounter-building rules. All official monster sources are in scope (Monster Manual, Volo's, Mordenkainen's Tome of Foes / Monsters of the Multiverse, Fizban's, Tasha's, Xanathar's). Cite the source and CR when listing each monster.

## 0. Prerequisites

- Confirm `mise` is available: `mise --version`.
- Confirm dice work: `mise run roll -- 1d20`.

## 1. Load Context

- Determine the campaign slug (from cwd or ask).
- Read `campaigns/<slug>/state.md` to find the active character.
- Read `campaigns/<slug>/characters/<active>.md` for level, AC, HP, key features.
- If solo play (one PC), apply the DMG "fewer than three characters" adjustment in §4.

## 2. Encounter Brief

Bundle the structured choices into a single `AskUserQuestion` call (per `AGENTS.md`): **Difficulty** (easy / medium / hard / deadly), **Purpose** (random / set-piece / boss / skill challenge), **Biome / theme** (dungeon / wilderness / urban / planar / etc.). Curate 2–4 representative options per question. Follow up with a plain prose question for **Constraints** (open-ended: monster types in/out, terrain features, time of day) since that doesn't reduce to a clean shortlist.

## 3. XP Threshold (Per Character)

Look up the active character's level in this table (DMG p. 82):

| Level | Easy | Medium | Hard | Deadly |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 25 | 50 | 75 | 100 |
| 2 | 50 | 100 | 150 | 200 |
| 3 | 75 | 150 | 225 | 400 |
| 4 | 125 | 250 | 375 | 500 |
| 5 | 250 | 500 | 750 | 1,100 |
| 6 | 300 | 600 | 900 | 1,400 |
| 7 | 350 | 750 | 1,100 | 1,700 |
| 8 | 450 | 900 | 1,400 | 2,100 |
| 9 | 550 | 1,100 | 1,600 | 2,400 |
| 10 | 600 | 1,200 | 1,900 | 2,800 |
| 11 | 800 | 1,600 | 2,400 | 3,600 |
| 12 | 1,000 | 2,000 | 3,000 | 4,500 |
| 13 | 1,100 | 2,200 | 3,400 | 5,100 |
| 14 | 1,250 | 2,500 | 3,800 | 5,700 |
| 15 | 1,400 | 2,800 | 4,300 | 6,400 |
| 16 | 1,600 | 3,200 | 4,800 | 7,200 |
| 17 | 2,000 | 3,900 | 5,900 | 8,800 |
| 18 | 2,100 | 4,200 | 6,300 | 9,500 |
| 19 | 2,400 | 4,900 | 7,300 | 10,900 |
| 20 | 2,800 | 5,700 | 8,500 | 12,700 |

Sum the threshold across the party. With one PC, the party threshold equals the character's threshold.

## 4. Encounter Multiplier

The encounter's adjusted XP = (sum of monster XP) × multiplier, where:

| Monsters | Multiplier |
| ---: | ---: |
| 1 | ×1 |
| 2 | ×1.5 |
| 3–6 | ×2 |
| 7–10 | ×2.5 |
| 11–14 | ×3 |
| 15+ | ×4 |

**Solo / small party adjustment (DMG, "fewer than three characters"):** if the party has fewer than 3 PCs, bump the multiplier up one row (e.g., 1 monster → ×1.5, 2 monsters → ×2). For solo play this is the default. **Do not** apply this adjustment if the party has 3+ PCs; instead, drop the multiplier one row only when the party is 6+.

## 5. Monster Selection

Pick monsters whose **adjusted total XP** lands at or just above the chosen difficulty threshold. Heuristics:
- A single monster of CR ≈ PC level often hits "hard" or "deadly" for a solo PC; tune accordingly.
- For solo play, avoid encounters that can stunlock or one-shot the PC (mass save-or-suck, rocket-tag damage). Lean toward monsters with attack-roll abilities the PC can react to.
- Mix roles: a brute, a skirmisher, a controller, a minion swarm. For solo, two complementary monsters often play better than one big brute.
- Note legendary actions, lair actions, and recharge abilities — they raise effective difficulty without raising CR.

If the player wants randomness, build a small d6 / d8 table of candidate monsters and roll: `mise run roll -- 1d6`.

## 6. Stat Block & Tactics

For each monster, record:
- Name, source (book + page), CR, XP.
- AC, HP (max or `mise run roll -- NdM+K` for variable HP), Speed.
- Key attacks (to hit, damage, special effects).
- Saves, immunities, resistances, vulnerabilities, senses, languages.
- Notable traits (Pack Tactics, Magic Resistance, Multiattack, etc.).
- Spells / legendary / lair actions if present.

**Tactics:** 1–3 sentences on how this monster fights. What it opens with, what it avoids, when it flees or surrenders.

## 7. Terrain & Setup

- Map sketch in text: rough dimensions, key features (cover, elevation, hazards, light level).
- Starting positions of monsters and PC.
- Environmental hazards (DMG ch. 5) — falling, suffocating, falling rocks, etc.
- Surprise / initiative modifiers (Stealth vs. passive Perception).

## 8. Treasure

Roll loot per the DMG individual / hoard tables for the encounter's CR tier (DMG ch. 7, p. 133–149). For a quick award, use `mise run roll -- <expr>` against the appropriate table (e.g., CR 0–4 individual: `1d100`).

## 9. Persist

Write to `campaigns/<slug>/encounters/<encounter-slug>.md` using the template. Choose a slug that's descriptive (e.g., `goblin-ambush-on-the-cart-road`).

Do **not** mark the encounter as "used" yet — that happens when a session log references it.

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8, no trailing whitespace).

## 10. Confirm

Read back: difficulty target, monsters chosen with CR/XP, adjusted XP vs. threshold, terrain summary. Ask the player if anything should change. Apply edits, save.

---

## Template

````markdown
# {{Encounter Title}}

- **Campaign:** {{slug}}
- **Difficulty target:** {{easy | medium | hard | deadly}}
- **Party threshold (XP):** {{N}}
- **Adjusted encounter XP:** {{N}}
- **Multiplier applied:** ×{{m}} (solo adjustment: {{yes | no}})
- **Created:** {{ISO date}}
- **Status:** prepared

## Brief

{{one-paragraph setup: where, when, why}}

## Monsters

| Monster | CR | XP | Source | HP | AC |
| --- | ---: | ---: | --- | ---: | ---: |
| {{name}} | {{cr}} | {{xp}} | {{book p. N}} | {{hp}} | {{ac}} |

### {{Monster Name}} — Stat Block

- **Speed:** ...
- **Saves / immunities / resistances:** ...
- **Senses:** ...
- **Traits:** ...
- **Actions:** ...
- **Tactics:** ...

## Terrain

- **Dimensions:** ...
- **Features:** ...
- **Light:** ...
- **Hazards:** ...

```
[ascii map sketch if helpful]
```

## Initiative & Surprise

- {{notes on stealth, surprise, lighting}}

## Treasure

- {{loot rolls / fixed treasure}}

## DM Notes

- {{anything the player shouldn't see in advance}}
````
