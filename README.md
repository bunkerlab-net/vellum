# Claude Dungeon Master

A D&D 5e (2014) text-based RPG system running inside Claude Code.

## Overview

This toolset provides:

- **Dice rolling** — Run dice expressions via `mise run roll`
- **Character creation** — Guided PC creation using the `character-creation` skill
- **Campaign management** — State tracked in markdown files under `campaigns/`

## Quick Start

### Roll Dice

```bash
mise run roll -- 4d6dl1      # Roll 4d6, drop lowest
mise run roll -- 1d20+5       # d20 with +5 modifier
mise run roll -- 2d8+3        # 2d8 with +3 modifier
mise run roll -- 3d6kh2-1     # Roll 3d6, keep 2 highest, -1 modifier
```

Supported notation: `NdS` (N dice with S sides), modifiers (`+N`/`-N`), and drop/keep operators (`dl`, `dh`, `kh`, `kl`).

### Create a Character

Use the `character-creation` skill when you want to create a new character.

## Project Structure

```text
campaigns/           # Campaign data (one subdirectory per campaign)
  <slug>/
    campaign.md     # Premise, setting, house rules
    state.md        # Current state, location, date
    characters/     # PC character sheets
    sessions/       # Session logs
    world/          # NPCs, locations, factions
scripts/
  roll.ts          # Dice roller script
AGENTS.md          # DM rules and guidelines
mise.toml          # Project tasks
```

## Requirements

- [mise](https://mise.jdx.dev)
