---
name: short-rest
description: Apply a D&D 5e short rest to the active character — optionally spend hit dice to heal, recharge short-rest abilities (Warlock spell slots, Fighter Action Surge / Second Wind, Monk ki, Channel Divinity, etc.). Trigger when the player rests for 1 hour (PHB) or whatever the campaign's resting house rule specifies.
---

# Short Rest

Apply a short rest per the campaign's resting house rule (default PHB: 1 hour).

## 0. Prerequisites

- `mise --version`, `mise run roll -- 1d20`.
- Determine campaign slug + active character.

## 1. Validate

Read `campaign.md` for the resting house rule. Confirm the fiction supports it (relative safety, time available, no immediate threats).

Default rule durations:
- **PHB**: 1 hour.
- **Gritty realism**: 8 hours.
- **Heroic**: 5 minutes.

## 2. Spend Hit Dice (Optional)

Ask the player how many hit dice to spend (0 to current pool size).

For each die:
- `mise run roll -- 1d<hit-die>` — show the result.
- HP regained for that die = roll + CON modifier.

Sum the regained HP and apply, capped at max HP. Decrement the hit-dice pool by the number spent. Hit dice spent on a short rest are **not** refunded — they only refill on long rest.

## 3. Recharge Short-Rest Abilities

Reset features that recharge on a short rest:

- **Warlock spell slots** → all (Pact Magic).
- **Fighter Action Surge** (1 use at L2; 2 at L17). **Second Wind** (1 use).
- **Monk ki points** → all.
- **Channel Divinity** (Cleric: 1/SR at L2, 2 at L6, 3 at L18; Paladin: 1/SR at L3).
- Any class/feature explicitly marked "1/short rest" or "regains on a short or long rest".

Skip features the active character doesn't have at their current level.

Note: **Wizard Arcane Recovery** is once per long rest, not short — but the player may invoke it during a short rest if unused this day.

## 4. Advance In-Game Time

Update `state.md.in_game_date` by the rest duration.

## 5. Persist

Save the character sheet and `state.md`. If a session is open, append a beat to `sessions/<NNN>.md`.

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8, no trailing whitespace).

## 6. Confirm

Tight summary: hit dice spent and HP healed, short-rest abilities reset, time advanced.
