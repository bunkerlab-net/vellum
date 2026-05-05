# Vellum

An agent-driven, text-based D&D 5e (2014) tabletop RPG. The DM is an AI (Claude Code by default); the campaign is markdown on disk — characters, sessions, encounters, quests, world — so play survives interruptions, auto-compaction, and weeks away from the table.

## How it works

Claude Code reads `AGENTS.md` (symlinked from `CLAUDE.md`) on every session, which establishes the DM role, the 5e ruleset scope (all official 2014 sourcebooks), the campaign state layout, the dice protocol, and the live-persistence rules. Skills under `.agents/skills/` drive the structured operations: starting a campaign, rolling up a character, opening or closing a session, building a balanced encounter, scaffolding a quest.

The conversation is volatile; the markdown files are authoritative. The DM writes every meaningful change to disk as it happens, so any session can resume cleanly — even after a context-window cut or in a brand-new conversation.

## Requirements

- [Claude Code](https://docs.claude.com/en/docs/claude-code) (or any agent that respects `AGENTS.md` + skills)
- [mise](https://mise.jdx.dev) — manages tool versions and the dice task

## Quick start

```bash
git clone git@github.com:bunkerlab-net/vellum.git
cd vellum
mise trust                # trust mise.toml in this repo
mise install              # installs bun 1.x
mise run roll -- 1d20     # smoke test the dice
claude                    # launch Claude Code in this directory
```

Then, inside Claude Code, invoke a skill:

- `/campaign-creation` — start a new campaign (setting, premise, factions, house rules)
- `/character-creation` — roll up a level-1 PC, Baldur's Gate-style
- `/session-start` — open or resume a play session
- `/session-end` — close the session, snapshot state for next time
- `/encounter-build` — DMG-balanced combat or skill encounter
- `/combat` — run an encounter end-to-end with live initiative/HP tracking
- `/quest` — scaffold a quest hook for the active campaign
- `/level-up` — advance the active character one level
- `/long-rest`, `/short-rest` — apply 5e rest mechanics
- `/inventory` — manage equipment, currency, attunement

## Skills

| Skill | Purpose |
| --- | --- |
| `campaign-creation` | Interview-driven setup: name, setting, tone, themes, starting region, factions, house rules. Creates the `campaigns/<slug>/` tree. |
| `character-creation` | Level-1 PC creation. Baldur's Gate-style stat rolling (4d6 drop lowest, unlimited rerolls, free reallocation), then race / class / background / equipment / spells / personality. All official 2014 sourcebooks in scope. |
| `session-start` | Loads campaign + character + prior-session context. Detects fresh, interrupted-resume, or mid-combat-resume mode. Creates the next `sessions/NNN.md` with a recap. |
| `session-end` | Audits live state on disk, runs a close-out interview, appends an `## End-of-Session` block with cliffhanger / open threads / XP, marks the session closed. |
| `encounter-build` | Builds combat using the DMG XP-threshold table (levels 1–20), encounter multiplier, and the solo "fewer than three PCs" adjustment. Picks monsters from any official 5e source. |
| `combat` | Runs a combat encounter end-to-end: initiative, turns, attacks, saves, damage, conditions, recharges, death saves, XP, loot. Updates the encounter's `## Live State` block after every event for full mid-combat resume. |
| `quest` | Lightweight five-field spine (hook, objective, complication, stakes, reward) plus NPC / location / faction connections. |
| `level-up` | Advances the active character one level: HP roll/average, hit dice, class & subclass features, ASI / feat, spell slots, proficiency bonus, derived stats. Appends to the level history. |
| `long-rest` | Restores HP, all spell slots, half hit dice (rounded down, min 1), reduces exhaustion by 1, resets long-rest abilities. Honors PHB / gritty / heroic resting variants. |
| `short-rest` | Optional hit-dice spending (rolled live), recharges short-rest abilities (Warlock slots, Action Surge, Second Wind, ki, Channel Divinity, etc.). |
| `inventory` | Add / remove / buy / sell / equip / list / transfer items. Recomputes total weight, carrying capacity, encumbrance, currency, and attunement slots. |

## Dice

All randomness flows through `mise run roll` — the DM never invents results.

```bash
mise run roll -- 4d6dl1      # 4d6 drop lowest (stat rolling)
mise run roll -- 1d20+5      # d20 with +5 modifier
mise run roll -- 2d8+3       # 2d8 with +3 modifier
mise run roll -- 4d6kh3      # 4d6 keep highest 3
mise run roll -- 3d6kh2-1    # 3d6 keep highest 2, then -1
```

Operators: `dlN` drop-lowest, `dhN` drop-highest, `khN` keep-highest, `klN` keep-lowest, `+N` / `-N` flat modifier.

The script (`scripts/roll.ts`) uses `crypto.getRandomValues` with rejection sampling, so the distribution is unbiased.

## Project layout

```text
.
├── AGENTS.md             # DM onboarding doc (the canonical file)
├── CLAUDE.md             # symlink → AGENTS.md
├── .agents/              # canonical skill home
│   └── skills/
│       ├── campaign-creation/SKILL.md
│       ├── character-creation/SKILL.md
│       ├── session-start/SKILL.md
│       ├── session-end/SKILL.md
│       ├── encounter-build/SKILL.md
│       ├── combat/SKILL.md
│       ├── quest/SKILL.md
│       ├── level-up/SKILL.md
│       ├── long-rest/SKILL.md
│       ├── short-rest/SKILL.md
│       └── inventory/SKILL.md
├── .claude               # symlink → .agents
├── scripts/
│   └── roll.ts           # Bun dice script
├── mise.toml             # tool versions + task definitions
├── campaigns/            # gitignored — your playthroughs live here
│   └── <slug>/
│       ├── campaign.md           # premise, setting, factions, house rules
│       ├── state.md              # active character, location, where-we-left-off
│       ├── characters/<slug>.md  # PC sheets
│       ├── sessions/NNN.md       # session logs (live, append-only during play)
│       ├── encounters/<slug>.md  # prepared / paused encounters
│       ├── quests/<slug>.md      # quest entries
│       └── world/
│           ├── regions.md        # locations
│           └── factions.md       # faction roster
├── .editorconfig
├── .zed/settings.json
└── .gitignore
```

## Campaign data

Your campaigns are personal user content, not part of the harness. `campaigns/` is `.gitignore`d, so characters, sessions, and DM-only plot notes never get pushed. If you want backup or history of your campaigns, keep them in a separate private repo or your usual backup setup.

## Conventions

All generated files conform to `.editorconfig` and `.zed/settings.json`:

- UTF-8, LF line endings
- Trailing newline at end of file
- No trailing whitespace
- 2-space indentation
- Markdown wraps around 100–120 columns (code blocks and tables exempt)

The repo follows the `AGENTS.md` convention with `CLAUDE.md` as a symlink, applied both at the file level (`AGENTS.md` / `CLAUDE.md`) and directory level (`.agents/` / `.claude`). Edit the `AGENTS.md` / `.agents/` side; the symlinks just keep Claude Code's native conventions working.

## Status

Working: campaign, character, session, encounter, combat, quest, level-up, rest, and inventory skills, plus dice and live persistence.

The structured-state operations are fully covered. Anything outside that scope (free-form roleplay, exploration, social encounters, downtime activities) is handled conversationally by the DM with the same live-persistence discipline.
