---
name: combat
description: Run a full D&D 5e combat encounter end-to-end. Trigger when the player is about to engage in combat, or is already mid-encounter. Rolls initiative, manages turn order, resolves attacks / saves / damage / conditions for all combatants, updates the encounter file's Live State block after every meaningful event, and finalizes the encounter (XP, treasure, character-sheet updates) when combat ends.
---

# Combat Resolver

Orchestrate a full 5e combat encounter. The encounter file's `## Live State` block is the source of truth — update it after **every** meaningful event (HP change, condition applied, position shift, round tick) so the fight is fully recoverable from disk if interrupted.

## 0. Prerequisites

- `mise --version`, `mise run roll -- 1d20`.
- Determine campaign slug + active character.
- Identify the encounter file: `campaigns/<slug>/encounters/<encounter-slug>.md`. If the encounter doesn't exist (improvised combat), run `/encounter-build` first or create a minimal stub on the fly.

## 1. Read Stat Blocks

For each monster in the encounter, load: AC, max HP (or roll: `mise run roll -- NdM+K`), speed, saves, attack lines (to-hit + damage + range/effect), special abilities (recharge, multiattack, legendary actions, lair actions), tactics block.

For the PC, load the character sheet's Combat, Attacks & Spellcasting, and Features & Traits sections.

## 2. Surprise & Initiative

If the encounter brief specifies surprise, apply: surprised combatants can't move or take actions on their first turn, and they can't take reactions until their first turn ends (PHB p. 189).

Roll initiative for every combatant:

- `mise run roll -- 1d20+<init>` per combatant.
- Resolve ties: higher DEX score wins. If still tied, roll off (`1d20`).

Build the initiative order (descending). Record in Live State.

## 3. Live State Block

If absent, append to the encounter file (and persist immediately):

````markdown
## Live State

- **Round:** 1
- **Turn:** {{combatant on deck}}
- **Last updated:** {{ISO timestamp}}

### Initiative Order

| # | Combatant | Init | HP | AC | Conditions | Notes |
| ---: | --- | ---: | --- | ---: | --- | --- |
| 1 | {{name}} | {{n}} | {{cur}}/{{max}} | {{ac}} | — | — |

### Ongoing Effects

- {{concentration spells, durations, environmental hazards}}

### Spell Slots Used

- {{PC class}}: {{slot levels used this combat}}

### Death Saves

- {{PC name}}: {{successes}}/{{failures}} (only if at 0 HP)
````

## 4. Round Loop

Walk the initiative order. At each combatant:

### PC turn

- Prompt the player for: action, bonus action, movement (track remaining), reaction (if applicable later in the round), free interaction.
- Resolve attacks: `mise run roll -- 1d20+<atk>` for each attack roll. On hit, roll damage. Apply to target HP.
- Resolve saves: target rolls `mise run roll -- 1d20+<save>` vs. spell save DC.
- Spell effects: track concentration if relevant; note duration in Ongoing Effects.
- At end of turn: tick "until the start of your next turn" effects on this combatant.

### Monster turn

- Follow the tactics block. Pick targets per stated logic (focus the threat, target the spellcaster, retreat if bloodied, etc.).
- For recharge abilities (e.g., Breath Weapon recharge 5–6 on `1d6`), roll the recharge die at the start of the monster's turn.
- Roll attacks, resolve saves, apply damage and conditions.
- Multiattack: resolve each attack in sequence, each against a (possibly different) target.
- At end of turn: tick on-this-combatant effects.

### Persist

After every HP change, condition application, position shift, slot use, or concentration check, update the Live State block on disk. **Do not batch.**

### Death / unconsciousness

- Monster at 0 HP: dead by default (DM may rule "knocked out" if the PC chose nonlethal melee, PHB p. 198).
- PC at 0 HP: unconscious; start death saves on subsequent turns (`mise run roll -- 1d20`; ≥10 success, <10 failure; nat-20 regain 1 HP; nat-1 = 2 failures). Three failures → dead. Three successes → stable.

### End of round

- Tick durations measured in rounds (e.g., "for 1 minute" = 10 rounds).
- Lair actions on initiative count 20 (losing ties), if the encounter has a lair.
- Increment the round counter; persist.

## 5. End Conditions

Combat ends when any of:

- All hostile combatants at 0 HP, fled, or surrendered.
- The PC is dead and can't be revived in time (TPK; switch to consequences narrative).
- A side surrenders or yields.
- The PC successfully disengages and there's no pursuit.

When combat ends:

- Award XP: full encounter XP to a solo PC; split among the party if multi-PC. Use the unmodified monster XP totals (the encounter multiplier is a *difficulty* heuristic, not the actual XP awarded — DMG p. 82).
- Roll loot per the encounter's treasure block (or the relevant DMG hoard table).
- Update the character sheet: current HP, spell slots used, ability uses (Action Surge, ki, Channel Divinity, etc.), hit dice unchanged from combat itself, conditions cleared if the source is gone.
- Mark the encounter file: change `Status: prepared` to `Status: resolved`; append a brief outcome paragraph (who survived, what was taken, how it ended).
- If the session is open, append a beat to `sessions/<NNN>.md`.

## 6. Interruption Recovery

If the conversation is interrupted mid-combat:

- The encounter file's Live State block is the source of truth.
- `/session-start` will reload it via mid-combat-resume mode.
- Round number, current turn, all HP, all conditions persist.

## 7. Persist Everything

Combat is the most volatile state in the campaign. Bias hard toward over-writing. The cost of one extra Edit is negligible; the cost of losing the round-3 HP totals after auto-compaction is permanent.

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8, no trailing whitespace).

## 8. Confirm

After combat ends: read back outcome, casualties, loot, XP, character sheet deltas. Ask if anything's missing.
