---
name: quest
description: Scaffold a quest in the active D&D 5e campaign with hook, objective, complication, stakes, and reward. Trigger when the DM or player wants to seed a new quest into play. Reads campaign context from campaign.md and world/factions.md, then writes the quest to campaigns/<slug>/quests/<slug>.md.
---

# Quest Scaffold

Generate a quest spine. This is intentionally lightweight — most quest content emerges in-fiction during play. The goal is a structured starting point with enough hooks for the DM to riff off.

## 0. Prerequisites

- Confirm `mise` is available: `mise --version`.
- Confirm dice work: `mise run roll -- 1d20`.

## 1. Load Context

- Determine the campaign slug (from cwd or ask).
- Read `campaigns/<slug>/campaign.md` (premise, themes, antagonist, content lines).
- Read `campaigns/<slug>/world/factions.md` for faction options.
- Read `campaigns/<slug>/state.md` to know current location and active character.
- Skim recent `campaigns/<slug>/sessions/*.md` to avoid repeating beats.

## 2. Quest Brief

Ask (one at a time, only as needed — short interview):
- **Hook source:** NPC request, posted notice, overheard rumor, dream / vision, faction summons, in-fiction event the PC just witnessed, or "surprise me".
- **Tied faction:** which faction (if any) is sponsoring or opposing? Pull from `world/factions.md`.
- **Urgency:** clock-driven (deadline, escalating consequence) or open-ended.
- **Tone:** does this fit the campaign tone (heroic / gritty / etc.) or deliberately subvert it?

## 3. Generate the Spine

Build five fields. Each can be improvised, derived from campaign context, or randomized via `mise run roll -- 1dN` against a small candidate list you generate in conversation.

- **Hook** — how the PC hears about it. One paragraph.
- **Objective** — the clear, measurable goal ("retrieve X", "escort Y", "stop Z before the eclipse"). One sentence.
- **Complication** — the twist that makes it interesting. The thing the player won't know until partway in. One or two sentences.
- **Stakes** — what happens if they fail or refuse. Tie to factions, NPCs, or world state — failure should *change* something on disk.
- **Reward** — gold, items, faction reputation, info, favor, leveling beat. Be specific (item names, gold amounts).

## 4. Connections

- Linked NPCs (1–3): names, roles, attitude.
- Linked locations: existing or new (if new, add a stub to `world/regions.md`).
- Linked factions: which factions notice, approve, or oppose the quest's resolution?

## 5. Persist

Write to `campaigns/<slug>/quests/<quest-slug>.md`. Use a descriptive slug (e.g., `the-missing-tax-collector`).

If the quest is being accepted right now (not just seeded), update `campaigns/<slug>/state.md` to add the quest slug to `active_quests`.

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8, no trailing whitespace).

## 6. Confirm

Summarize the quest in one paragraph from the player's perspective (just the hook + objective, *not* the complication or DM notes). Ask if it lands. Adjust, save, end the skill.

---

## Template

````markdown
# {{Quest Title}}

- **Campaign:** {{slug}}
- **Slug:** {{quest-slug}}
- **Status:** seeded | active | completed | failed | abandoned
- **Created:** {{ISO date}}
- **Tied faction:** {{faction or none}}
- **Urgency:** {{clock | open}}
- **Deadline:** {{in-game date or none}}

## Hook (player-facing)

{{one paragraph: how the PC hears about it}}

## Objective

{{one sentence: the measurable goal}}

## Complication (DM-only)

{{the twist; what's really going on}}

## Stakes

- **On failure or refusal:** {{world-state change}}
- **On success:** {{world-state change}}

## Reward

- {{gold / items / reputation / info / favor}}

## Connections

### NPCs
- **{{name}}** — {{role, attitude, location}}

### Locations
- **{{name}}** — {{description or pointer to regions.md}}

### Factions
- **{{name}}** — {{stake in the outcome}}

## Beats / Scenes (optional)

- {{anticipated scene 1}}
- {{anticipated scene 2}}

## Resolution Log

(populated during/after play — what actually happened, who lived, what changed)
````
