---
name: character-creation
description: Interview-driven D&D 5e (2014) character creation. Trigger when the player asks to create, build, or roll up a new character. Walks through campaign selection, Baldur's Gate-style stat rolling, race, class, background, equipment, spells, and personality, then writes the sheet to campaigns/<slug>/characters/<slug>.md.
---

# Character Creation

Walk the player through creating a level-1 D&D 5e character using the official 2014 ruleset. All official sourcebooks are in scope (PHB, Xanathar's, Tasha's, Mordenkainen's, Volo's, SCAG, etc.). Cap level at 20.

Conduct this as an interview: ask one focused question at a time. Do not dump exhaustive option lists — group by source and let the player drill in. The player can say "surprise me" or "pick for me" at any step; if so, make a sensible choice and explain it briefly.

## 0. Prerequisites

- Confirm `mise` is available: `mise --version`. If not, stop and report.
- Confirm the dice task works: `mise run roll -- 1d20`. If it errors, stop and report.

## 1. Campaign Context

Ask: "Which campaign is this character for?"

- List existing campaigns: `ls campaigns/` (ignore `.gitkeep`).
- If the player picks an existing slug, use it.
- If new, ask for a campaign name and derive a slug (lowercase, hyphenated). Create:
  - `campaigns/<slug>/campaign.md` — title, premise (TBD), house rules (none yet).
  - `campaigns/<slug>/characters/`
  - `campaigns/<slug>/sessions/`
  - `campaigns/<slug>/world/`
  - `campaigns/<slug>/state.md` — front-matter with `active_character: null`, `location: null`, `in_game_date: null`.

## 2. Ability Scores (Baldur's Gate-Style)

Roll 4d6 drop lowest, six times, by running:

```
mise run roll -- 4d6dl1
```

Repeat six times. Present the six results in a table with the total. Ask: "Keep these or reroll all six?"

Loop until the player accepts. There is no reroll cap.

Once accepted, present the six values as an unordered pool and ask the player to assign them to STR, DEX, CON, INT, WIS, CHA. **Allow free reallocation** — the player can move points between abilities arbitrarily as long as each final value stays between 3 and 18 (pre-racial). Sum is preserved.

Confirm the final base array before moving on.

## 3. Race & Subrace

Ask which sourcebook scope the player wants to browse (default: all). Group major options by source. After selection:

- Apply ability score increases per PHB rules, OR offer Tasha's "Customizing Your Origin" rules if the player opts in (note the choice on the sheet).
- Record speed, size, age range, languages, vision (darkvision distance if any), proficiencies, and racial traits.
- Resolve subrace if applicable.

## 4. Class & Subclass

Pick from PHB + expansion classes. Note: Artificer is from Tasha's. For classes that pick subclass at level 1 (Cleric domain, Sorcerer origin, Warlock patron, Wizard arcane tradition is at L2 — verify per class), pick now. Otherwise note when subclass unlocks.

Record:
- Hit die and max HP at level 1 (max die value + CON modifier; minimum 1).
- Saving-throw proficiencies.
- Armor, weapon, and tool proficiencies.
- Skill proficiency choices (X from the class list).
- Starting class features (1st-level only).

## 5. Background

Pick from official backgrounds. Apply:
- Two skill proficiencies, plus tool/language proficiencies as listed.
- Background feature.
- Starting equipment from the background.

Resolve overlaps: if the background grants a skill the class already gave, swap to another from the same list and tell the player which list you swapped from.

## 6. Equipment

Per PHB, offer two paths:
- Take the starting equipment package from class + background, OR
- Roll/take starting gold and buy from the PHB equipment tables.

Build the inventory as a table with item, quantity, and weight. Compute total weight and carrying capacity (STR × 15 lbs).

## 7. Spells (if applicable)

For spellcasters:
- Cantrips known: pick the class's allotment from its spell list.
- 1st-level spells: known/prepared per class rules (e.g., Wizard: 6 in spellbook + prepared INT-mod + level; Cleric: prepared WIS-mod + level; Sorcerer: 2 known).
- Spell save DC = 8 + proficiency bonus + spellcasting ability modifier.
- Spell attack bonus = proficiency bonus + spellcasting ability modifier.

## 8. Personality

Interview-driven, no required length:
- Alignment.
- Personality traits, ideal, bond, flaw (background tables provide examples; player may write their own).
- Appearance: age, height, build, distinguishing features.
- Backstory beats: where they're from, why they adventure, key relationships.

## 9. Derived Stats (Final Pass)

Compute and record:
- Ability modifiers: `floor((score - 10) / 2)`.
- Proficiency bonus: +2 (level 1).
- AC: per armor + DEX (capped by armor type), with class/race modifiers (e.g., Barbarian or Monk Unarmored Defense, shield).
- Initiative: DEX modifier (+ feats/features if applicable).
- Saving throw bonuses: ability mod + proficiency where proficient.
- Skill bonuses: ability mod + proficiency (or expertise = ×2 prof).
- Passive Perception: 10 + Perception bonus.
- Carrying capacity: STR × 15 lbs.

Verify all arithmetic. If a number doesn't reconcile, redo it openly.

## 10. Persist

Write the character sheet to:

```
campaigns/<campaign-slug>/characters/<character-slug>.md
```

Use the template in the section below. Each major block is its own H2 so future skills can edit a single section without rewriting the file.

Update `campaigns/<campaign-slug>/state.md` to set `active_character: <character-slug>`.

## 11. Confirm

Read back a one-paragraph summary of the character. Ask if the player wants to adjust anything. Apply edits, save, then end the skill.

---

## Character Sheet Template

````markdown
# {{Character Name}}

- **Player:** Tech Priest
- **Race / Subrace:** {{race}} ({{subrace}})
- **Class / Subclass:** {{class}} ({{subclass}}) — Level 1
- **Background:** {{background}}
- **Alignment:** {{alignment}}
- **Source rules:** D&D 5e (2014)
- **Origin rules:** PHB | Tasha's "Customizing Your Origin"
- **Created:** {{ISO date}}

## Ability Scores

| Ability | Base | Racial | Score | Modifier |
| --- | --- | --- | --- | --- |
| Strength | 10 | +0 | 10 | +0 |
| Dexterity | 10 | +0 | 10 | +0 |
| Constitution | 10 | +0 | 10 | +0 |
| Intelligence | 10 | +0 | 10 | +0 |
| Wisdom | 10 | +0 | 10 | +0 |
| Charisma | 10 | +0 | 10 | +0 |

## Saving Throws

| Save | Bonus | Proficient |
| --- | --- | --- |
| Strength | +0 | — |
| Dexterity | +0 | — |
| Constitution | +0 | — |
| Intelligence | +0 | — |
| Wisdom | +0 | — |
| Charisma | +0 | — |

## Skills

| Skill | Ability | Bonus | Proficient |
| --- | --- | --- | --- |
| Acrobatics | DEX | +0 | — |
| Animal Handling | WIS | +0 | — |
| Arcana | INT | +0 | — |
| Athletics | STR | +0 | — |
| Deception | CHA | +0 | — |
| History | INT | +0 | — |
| Insight | WIS | +0 | — |
| Intimidation | CHA | +0 | — |
| Investigation | INT | +0 | — |
| Medicine | WIS | +0 | — |
| Nature | INT | +0 | — |
| Perception | WIS | +0 | — |
| Performance | CHA | +0 | — |
| Persuasion | CHA | +0 | — |
| Religion | INT | +0 | — |
| Sleight of Hand | DEX | +0 | — |
| Stealth | DEX | +0 | — |
| Survival | WIS | +0 | — |

## Combat

- **AC:** 10
- **HP:** 10 / 10
- **Hit Dice:** 1 / 1d{{X}}
- **Speed:** 30 ft
- **Initiative:** +0
- **Proficiency Bonus:** +2
- **Passive Perception:** 10

## Attacks & Spellcasting

| Weapon | Bonus | Damage | Range / Notes |
| --- | --- | --- | --- |
| {{weapon}} | +0 | 1d6 | melee |

- **Spellcasting Ability:** {{ability}}
- **Spell Save DC:** {{dc}}
- **Spell Attack:** +{{atk}}

### Cantrips (at will)
- ...

### 1st Level — {{X}} slots
- ...

## Features & Traits

- **Racial:** ...
- **Class (Level 1):** ...
- **Background Feature:** ...

## Proficiencies & Languages

- **Armor:** ...
- **Weapons:** ...
- **Tools:** ...
- **Languages:** Common, ...

## Equipment

| Item | Qty | Weight (lb) |
| --- | --- | --- |
| ... | 1 | 0 |

- **Total weight:** 0 lb / {{capacity}} lb
- **Currency:** 0 gp / 0 sp / 0 cp

## Personality

- **Traits:** ...
- **Ideal:** ...
- **Bond:** ...
- **Flaw:** ...
- **Appearance:** ...

## Backstory

...

## Level History

| Level | Date achieved | XP at level | Notes |
| --- | --- | --- | --- |
| 1 | {{ISO date}} | 0 | Character created. |
````
