---
name: level-up
description: Level up the active D&D 5e character by one level. Trigger when the player or DM marks a level-up beat (milestone reached or XP threshold crossed). Updates HP, hit dice, class/subclass features, ASI/feats, spell slots, spells known/prepared, proficiency bonus, and derived stats; appends to the character's level history.
---

# Level Up

Advance the active character one level using the official 2014 ruleset and the active class's level table. Cap at level 20.

Per `AGENTS.md`, **batch the level's structured choices into a single `AskUserQuestion` call** once you've walked the class table and know what's pending. A typical Paladin/Fighter/Cleric level-up has 1–4 discrete picks: HP method (roll vs average), Fighting Style (when granted), ASI vs feat (L4/L8/L12/L16/L19), new cantrips, swapped/added known spells, prepared-spell additions for prepared casters. Bundle these — don't ask one per turn. For pick-N choices (two cantrips, two prepared spells), set `multiSelect: true`. The "Other" escape hatch lets the player pick from the full list if your curated 2–4 misses their target.

## 0. Prerequisites

- `mise --version`, `mise run roll -- 1d20`.
- Determine campaign slug + active character (`state.md`).

## 1. Validate

Read `campaigns/<slug>/characters/<active>.md`. Note the current level. Refuse if the character is already level 20.

If the campaign uses XP pacing (per `campaign.md`), confirm the character has crossed the next threshold. If milestone, trust the trigger.

## 2. Walk the Class Table

Set `new_level = current + 1`. Read the class's level table (and subclass, if relevant) for `new_level`. Identify:

- New class features at this level.
- Subclass feature at this level (if any).
- ASI / feat at L4, L8, L12, L16, L19 (most classes — Fighter also gets bonus ASIs at L6 and L14; Rogue at L10).
- Proficiency bonus changes at L5 (+3), L9 (+4), L13 (+5), L17 (+6).
- Spellcasters: new spell slots, cantrips known, spells known/prepared per the class table.

## 3. HP Increase

Two paths, per house rules:

- **Roll**: `mise run roll -- 1d<hit-die>`, add CON modifier (minimum +1 HP).
- **Average**: take the fixed average for the hit die (d6=4, d8=5, d10=6, d12=7), add CON modifier (minimum +1 HP).

Show the choice and result. Apply to max HP and current HP. If rolling, accept the result — no rerolls (PHB rule).

## 4. ASI / Feat (if applicable)

If this level grants an ASI:

- Two options: +2 to one ability (cap 20) or +1 to two abilities, OR a feat from any official source the campaign allows.
- If a feat changes ability scores, derived stats, proficiencies, or attacks, propagate through the sheet.

## 5. Spells (if applicable)

For spellcasters:

- Add cantrips per the class table (Wizards, Clerics, Bards, Druids, Sorcerers, Warlocks).
- Spells known: Sorcerer / Bard / Warlock / Ranger may swap one known spell of any level they could cast.
- Prepared casters (Cleric, Druid, Paladin, Wizard): preparation count recomputes at the next long rest; spell slots update now.
- Recompute spell save DC and attack bonus only if proficiency or spellcasting ability changed.

## 6. Apply & Recompute

Update the character sheet, section by section:

- Identity block: level → `new_level`.
- Combat: HP, hit dice (`<level>d<die>`), proficiency bonus.
- Saving throws / skills: recompute bonuses if proficiency bonus changed.
- Attacks & spellcasting: spell save DC, spell attack bonus, weapon attack bonuses.
- Features & Traits: append the new ones with their source (PHB / Tasha's / etc.).
- Level History: append a row.

## 7. Persist

Save the character sheet immediately (per `AGENTS.md` Live Persistence). If a session is open, append a beat to `sessions/<NNN>.md` recording the level-up.

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8, no trailing whitespace).

## 8. Confirm

Read back: new level, HP delta, new features, ASI / feat (if any), updated spell slots. Ask if the player wants to adjust any of the choices before saving the final state.
