---
name: long-rest
description: Apply a D&D 5e long rest to the active character — restores HP, regains all spell slots, regains hit dice up to half max, ticks down exhaustion by 1, resets long-rest abilities. Trigger when the player rests for 8 hours (PHB) or whatever the campaign's resting house rule specifies (gritty / heroic).
---

# Long Rest

Apply a long rest to the active character per the campaign's resting house rule.

## 0. Prerequisites

- `mise --version`.
- Determine campaign slug + active character.

## 1. Validate

Read `campaign.md` for the resting house rule (default PHB: 8 hours, of which 6+ are sleeping). Confirm:

- The fiction supports a long rest (safe location, time available).
- It's been at least 24 hours since the character's last long rest (PHB rule). If not, flag this and ask the player whether to allow it (some house rules differ).

Default rule durations:
- **PHB**: 8 hours.
- **Gritty realism** (DMG p. 267): 7 days.
- **Heroic** (DMG p. 267): 1 hour.

## 2. Apply Mechanical Effects

Update the character sheet:

- **HP** → max.
- **Hit dice** → `min(max_hit_dice, current + floor(max / 2))`. Always at least 1 die back at level 1 (PHB rule).
- **Spell slots** → all restored. **Warlock excepted**: their slots restore on short rest, not long.
- **Long-rest abilities** reset: any feature marked "regains on a long rest" or "1/long rest".
- **Exhaustion** → max(0, current − 1).
- **Conditions** → clear those that auto-clear on rest (consult the condition; e.g., the "fatigued" custom condition vs. exhaustion).

Temporary HP from features does **not** persist past a long rest unless the source explicitly says so.

## 3. Advance In-Game Time

Update `state.md.in_game_date` by the rest duration. If the rest spans midnight or a meaningful clock event (deadline, lunar phase, weather change), note it in the session log.

## 4. Persist

Save the character sheet and `state.md`. If a session is open, append a one-line beat to `sessions/<NNN>.md` (e.g., "Long rest at the inn — full HP, 4 hit dice back").

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8, no trailing whitespace).

## 5. Confirm

Tight summary: HP restored, hit dice regained, spell slots restored, exhaustion change. Ask if anything else needs adjusting.
