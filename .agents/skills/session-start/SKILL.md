---
name: session-start
description: Begin or resume a D&D 5e play session. Trigger when the player says "let's play", "start a session", "continue", "resume", or sits down to game. Loads campaign + active character + last session context, creates (or reopens) sessions/NNN.md, and grounds the DM in current state before the player takes a turn.
---

# Session Start

Open a new play session or resume an interrupted one. Ground yourself in the campaign's current state **before** the player takes their first action. Live persistence (see `AGENTS.md`) starts the moment this skill exits.

## 0. Prerequisites

- Confirm `mise` is available: `mise --version`.
- Confirm dice work: `mise run roll -- 1d20`.

## 1. Locate Campaign

- Determine the campaign slug from cwd (`campaigns/<slug>/...`) or ask if ambiguous.
- Verify `campaigns/<slug>/state.md` exists. If not, recommend running `/campaign-creation` first.

## 2. Load Context

Read in this order, holding everything in working memory before play begins:

- `campaigns/<slug>/campaign.md` — premise, themes, antagonist, house rules, content lines.
- `campaigns/<slug>/state.md` — active character, location, in-game date, active quests, last session, status, where-we-left-off.
- `campaigns/<slug>/characters/<active>.md` — full sheet (HP, hit dice, spell slots, conditions, inventory, currency).
- `campaigns/<slug>/world/regions.md` — current region/location.
- `campaigns/<slug>/world/factions.md` — faction roster + attitudes toward the PC.
- `campaigns/<slug>/sessions/<latest>.md` (if any) — `End-of-Session` block, beats, recap.
- Each `campaigns/<slug>/quests/<slug>.md` listed in `state.md` active quests.
- If `state.md.last_session_status == "active"`, scan `campaigns/<slug>/encounters/*.md` for any with a `## Live State` block (paused combat).

## 3. Determine Session Mode

- **Fresh session** — `last_session_status == "closed"` or no sessions exist. Increment to `<NNN+1>` (zero-padded, e.g. `003`); create the new log file.
- **Interrupted resume (same in-fiction session)** — `last_session_status == "active"` and the player wants to pick up the same in-fiction moment. Reopen `sessions/<NNN>.md` (the existing active one); append a `## Resumed {{ISO date}}` separator under `## Beats` so the timeline of real-world play is visible.
- **Mid-combat resume** — an encounter has a `## Live State` block. Reload monster HP / initiative / conditions / positions verbatim. Brief the player on the tactical state exactly as it stood when interrupted.

If ambiguous, ask the player: continue the previous session, or start a fresh one?

## 4. Open the Session

Create or open the session log with the header block (template below). The `Recap` paragraph is derived from:
- the prior session's `End-of-Session` block (especially `Where we left off`),
- the active quest's current state,
- the PC's current condition (HP, resources, location).

Read the recap to the player aloud (in conversation). Keep it to one paragraph.

## 5. Establish Stakes

If active quests exist, name the most pressing one and remind the player of the open question, deadline, or next obvious step. If no active quests, ask: "What does {{character name}} want to do today?"

If mid-combat resume, skip stakes and go straight to the player's pending turn.

## 6. Persist & Hand Off

Update `state.md`:
- `last_session = NNN`
- `last_session_status = active`
- `last_session_real_date = {{ISO date}}`

Save the session log with header + recap. Hand control to the player.

From this point on, follow the **Live Persistence** rules in `AGENTS.md`: every meaningful change goes to disk as it happens, not at session end.

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8, no trailing whitespace).

---

## Session Log Template

````markdown
# Session {{NNN}}

- **Campaign:** {{slug}}
- **Real-world date opened:** {{ISO date}}
- **In-game date (start):** {{game date or "Day 1"}}
- **Location (start):** {{location}}
- **Active character:** {{character-slug}}
- **Status:** active

## Recap

{{one paragraph: where we left off, current quest, PC condition; or "the campaign begins"}}

## Beats

(append below as scenes resolve — one entry per scene, NPC encounter, travel leg, or combat)

## End-of-Session

(populated by `/session-end`)
````
