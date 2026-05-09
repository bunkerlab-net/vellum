---
name: port-character
description: Import an existing D&D 5e character from one campaign into another. Trigger when the player wants to bring a PC across campaigns. Walks through what to retain (level, stats, class, gear, identity, backstory) and what to regenerate, then writes a fresh sheet to the destination campaign.
---

# Port Character

Import an existing character sheet from one campaign into another, deciding interactively which
aspects carry over and which are reset for the new world. The source character is **never modified**
— porting is a copy, not a move.

Conduct the import as a single batched interview per `AGENTS.md` — bundle the retain/reset choices
into one `AskUserQuestion` call rather than asking sequentially.

## 0. Prerequisites

- Confirm `mise` is available: `mise --version`. If not, stop and report.
- Confirm dice work: `mise run roll -- 1d20` (needed if rolls fall out of the import — re-rolling
  stats, fresh HP for a class change, etc.).

## 1. Source & Destination

Ask the player for:

- **Source campaign + character.** List campaigns: `ls campaigns/`. List characters in the chosen
  campaign: `ls campaigns/<source>/characters/`. Confirm
  `campaigns/<source>/characters/<source-char>.md` exists before proceeding.
- **Destination campaign.** List campaigns. If the destination doesn't exist, stop and recommend
  `/campaign-creation`.

Read the full source character sheet into working memory before asking what to port.

## 2. Slug Collision Check

If `campaigns/<destination>/characters/<source-char-slug>.md` already exists, ask the player to
pick a new slug for the imported character, or abort. Never silently overwrite.

## 3. Interview — What to Retain

Single `AskUserQuestion` call with four questions:

### Question 1 — Mechanical (multi-select)

"Which mechanical aspects should the character retain?"

- **Level** — default *no*; start fresh at level 1 in the new campaign.
- **Ability scores** — default *yes*; preserve the invested rolls.
- **Class & subclass** — default *yes*; usually kept; pick again only if pivoting class.
- **Background** — default *yes*; though the new world may suggest a different one.

### Question 2 — Possessions (multi-select)

"Which possessions should cross over?"

- **Mundane inventory** — default *no*; new campaign typically grants starting equipment.
- **Currency (gp / sp / cp)** — default *no*; new campaign sets starting wealth.
- **Magic items** — default *no*; DM-gated by campaign tier.

### Question 3 — Identity (multi-select)

"Which narrative aspects carry over verbatim?"

- **Character name** — default *yes*; usually kept across worlds.
- **Personality (traits, ideal, bond, flaw)** — default *yes*; defines who the PC is.
- **Alignment** — default *yes*; character's moral compass.

### Question 4 — Backstory (single-select)

"How should the backstory be handled?"

- **Summarize as memory (Recommended)** — old backstory becomes a remembered chapter; the new
  campaign writes the present.
- **Keep verbatim** — backstory survives word-for-word; new campaign reconciles.
- **Rewrite for new world** — discard old; write fresh hooks for the new setting.

## 4. Reconcile Choices

Apply these implicit rules to the player's selections:

- **Class change forces a level reset to 1.** You cannot keep level-5 paladin features as a fresh
  sorcerer. If Class & subclass is unchecked in Q1, level also resets — even if the player checked
  Level. Tell the player when this happens.
- **Level retained, ability scores reset.** Recompute HP using each level's prior roll plus the new
  CON modifier. Recompute spell save DC, spell attack bonus, save bonuses, AC, carrying capacity.
  Show the recomputed numbers before saving.
- **Level reset to 1.** Spells, hit dice, HP, class features, ASIs / feats all regenerate per
  level-1 character-creation rules.
- **Multiclass with level retained.** Multiclass survives unchanged.
- **Multiclass with level reset to 1.** Ask which single class to pick at level 1.
- **Background changed.** Discard old background skills, feature, and equipment; pick a new
  background per `/character-creation` §5.
- **Skill list collisions.** If a chosen skill from the old class/background no longer fits the new
  class/background combo, swap to another from the same list and tell the player which list you
  swapped from.

**Always automatic** (no question, never optional):

- Player name carries.
- Race / subrace carries, with the original origin-rules choice (PHB strict vs. Tasha's Customizing
  Your Origin).
- Languages tied to race carry. Languages tied to background carry only if Background is retained.
- Current HP resets to max.
- Hit dice spent resets to zero.
- Spell slots used reset to zero.
- Conditions, exhaustion, death-save state all reset.
- Resource pools (Channel Divinity uses, Action Surge, ki, rages, sorcery points, etc.) reset to
  full.
- Quest log, faction reputation, NPC relationships from the source campaign are **not** brought
  over.

## 5. Branch Into Sub-Rituals

For each block being regenerated, defer to the relevant section of `/character-creation`:

- **Stats reset** → §2 (4d6dl1 stat-roll loop, Baldur's-Gate style).
- **Class reset** → §4.
- **Background reset** → §5.
- **Equipment reset** (no gear carried) → §6 (starting equipment package or starting gold; populate `## Equipped` and `## Inventory` per the canonical schema).
- **Spell selection reset** → §7.
- **Personality reset** → §8 (only if Personality was unchecked in Q3).
- **Backstory rewrite** → §8 backstory beats (only if "Rewrite" chosen in Q4).
- **Backstory summarize** → write a 2–4 sentence summary of the old backstory as a "remembered
  chapter" preface, then write a fresh backstory per §8.

Skip sub-rituals for any block being retained verbatim.

## 6. Recompute Derived Stats

Run `/character-creation` §9 against the post-port character to recompute:

- Ability modifiers, proficiency bonus (per final level), saves, skills, AC, initiative, passive
  Perception, carrying capacity, spell save DC, spell attack bonus.

Verify all arithmetic. If a number doesn't reconcile, redo it openly.

## 7. Persist

Write the new character file to:

```
campaigns/<destination>/characters/<character-slug>.md
```

Use the character sheet template from `/character-creation` (§ Character Sheet Template).

The **Level History** block:

- **Level retained:** copy the source's level history verbatim, then append a new row noting the
  port: `| {{level}} | {{port date}} | {{XP}} | Imported from {{source-campaign-slug}}. |`.
- **Level reset to 1:** fresh single-row level history per `/character-creation`.

Update `campaigns/<destination>/state.md`:

- Ask: "Set this as the active character in {{destination}}?"
  - If yes: set `active_character: <new-slug>`.
  - If no: leave `active_character` unchanged. The new sheet exists; the existing active character
    is preserved.

The source character file is **not** modified. The source campaign's `state.md` is **not**
modified. Porting is a one-way copy.

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8,
no trailing whitespace).

## 8. Confirm

Read back a one-paragraph summary:

- Source → destination.
- What carried (level, stats, class, background, identity, gear).
- What regenerated.
- Active-character status in the destination campaign.

Ask if the player wants to adjust anything. Apply edits, save, then end the skill.
