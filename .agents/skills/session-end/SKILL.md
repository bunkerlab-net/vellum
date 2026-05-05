---
name: session-end
description: Cleanly close a D&D 5e play session. Trigger when the player says "wrap up", "end session", "stop here", "let's pause", or similar. Verifies live state is on disk, snapshots end-of-session details to the session log, updates state.md with where-we-left-off, and marks the session closed so future resumes are clean.
---

# Session End

Close out the active session. Capture everything that changed so a future session — even one started weeks later in a brand-new conversation — can resume cleanly.

## 0. Prerequisites

- Confirm `mise` is available: `mise --version`.
- Determine the campaign slug from cwd or ask.
- Identify the active session log: `campaigns/<slug>/sessions/<NNN>.md` with `Status: active`.

## 1. Verify Live State Is Persisted

Live persistence should have kept these in sync during play, but audit before closing. For each, confirm the file matches the fiction:

- **Character sheet** (`campaigns/<slug>/characters/<active>.md`) — current HP, hit dice, spell slots, ability uses, exhaustion, conditions, inventory deltas, currency, XP / milestone progress.
- **Active encounter** (if combat is paused mid-fight) — encounter file's `## Live State` block reflects monster HP, initiative order, positions, condition durations, ongoing concentration.
- **Quest files** — any quest progressed, completed, failed, or abandoned this session has updated `Status` and `Resolution Log`.
- **World files** — new NPCs added to `world/factions.md`; new locations added to `world/regions.md`.
- **state.md** — `active_quests` reflects the current active set.

If anything is out of sync, write the fix now before continuing.

## 2. Close-Out Interview

Short, optional. The player can skip any of these:

- Any open threads or unresolved questions to flag for next session?
- XP / milestones to award? If milestone pacing and a beat triggers a level, note it (run `/level-up` next session — skill not yet built; for now just record `Level-up pending` in the character sheet).
- Anything the player wants you to remember that didn't surface in the beats?

## 3. Append End-of-Session Block

Append the following to `sessions/<NNN>.md` (replacing the `(populated by /session-end)` placeholder under `## End-of-Session`):

````markdown
## End-of-Session

- **Real-world date closed:** {{ISO date}}
- **In-game date:** {{game date}}
- **Location:** {{location}}
- **Active character HP / resources:** {{HP, hit dice, spell slots, notable depletions}}
- **Active quests:** {{slugs or "none"}}
- **Open threads:** {{bulleted list of dangling beats / mysteries / NPCs to follow up}}
- **Where we left off:** {{one sentence — the cliffhanger or pause point}}
- **XP / milestones earned:** {{summary or "none"}}
- **Combat status:** {{"none" | "paused: <encounter-slug>"}}
- **Notes for future DM-self:** {{anything you want next-session-you to know}}
````

Update the session log header `Status:` field from `active` to `closed`.

## 4. Update state.md

- `last_session = NNN`
- `last_session_status = closed`
- `last_session_real_date = {{ISO date}}`
- `where_we_left_off = "{{cliffhanger sentence}}"`
- `location = {{current}}`
- `in_game_date = {{current}}`
- `active_quests = [{{current set}}]`

## 5. Confirm

Read back a tight summary: where the session ended (location + cliffhanger), open threads, what's queued for next time. Ask the player if anything's missing. Apply edits, save, end the skill.

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8, no trailing whitespace).
