# Claude Dungeon Master

A Claude Code-driven, text-based D&D 5e (2014) tabletop RPG. Claude is the Dungeon Master, you're the player. All campaign state — characters, sessions, encounters, quests, world — is markdown on disk, so play survives interruptions, auto-compaction, and weeks away from the table.

## How it works

Claude Code reads `AGENTS.md` (symlinked from `CLAUDE.md`) on every session, which establishes the DM role, the 5e ruleset scope (all official 2014 sourcebooks), the campaign state layout, the dice protocol, and the live-persistence rules. Skills under `.agents/skills/` drive the structured operations: starting a campaign, rolling up a character, opening or closing a session, building a balanced encounter, scaffolding a quest.

The conversation is volatile; the markdown files are authoritative. The DM writes every meaningful change to disk as it happens, so any session can resume cleanly — even after a context-window cut or in a brand-new conversation.

## Requirements

- [Claude Code](https://docs.claude.com/en/docs/claude-code) (or any agent that respects `AGENTS.md` + skills)
- [mise](https://mise.jdx.dev) — manages tool versions and the dice task

## Quick start

```bash
git clone git@github.com:rblaine95/claude-dungeon-master.git
cd claude-dungeon-master
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
- `/quest` — scaffold a quest hook for the active campaign

## Skills

| Skill | Purpose |
| --- | --- |
| `campaign-creation` | Interview-driven setup: name, setting, tone, themes, starting region, factions, house rules. Creates the `campaigns/<slug>/` tree. |
| `character-creation` | Level-1 PC creation. Baldur's Gate-style stat rolling (4d6 drop lowest, unlimited rerolls, free reallocation), then race / class / background / equipment / spells / personality. All official 2014 sourcebooks in scope. |
| `session-start` | Loads campaign + character + prior-session context. Detects fresh, interrupted-resume, or mid-combat-resume mode. Creates the next `sessions/NNN.md` with a recap. |
| `session-end` | Audits live state on disk, runs a close-out interview, appends an `## End-of-Session` block with cliffhanger / open threads / XP, marks the session closed. |
| `encounter-build` | Builds combat using the DMG XP-threshold table (levels 1–20), encounter multiplier, and the solo "fewer than three PCs" adjustment. Picks monsters from any official 5e source. |
| `quest` | Lightweight five-field spine (hook, objective, complication, stakes, reward) plus NPC / location / faction connections. |

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
│       └── quest/SKILL.md
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

Working: campaign / character / session / encounter / quest skills, dice, live persistence.

Not yet built: `/level-up`, `/long-rest` and `/short-rest`, `/inventory` helpers, automated combat resolver. Most of these can still be done conversationally — the existing skills cover the structured-state operations.
