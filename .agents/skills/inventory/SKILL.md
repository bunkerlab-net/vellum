---
name: inventory
description: Manage the active D&D 5e character's equipped gear, inventory, and currency. Trigger when the player wants to add, remove, equip, unequip, buy, sell, list, or transfer items. Updates the character sheet's `## Equipped` and `## Inventory` blocks and recomputes total weight and carrying capacity.
---

# Inventory

Manage the active character's gear and currency. The character sheet keeps two separate blocks:

- `## Equipped` — armor, shield, currently-wielded weapons, holy symbol / spellcasting focus, and
  any attuned magic items currently worn. Each row carries a **Slot** (Armor, Shield, Main Hand,
  Off Hand, Thrown, Holy, Other) and a **Stats** column with the gameplay numbers (AC value, AC
  bonus, attack-to-hit, damage, range, special notes). The Stats column is what the frontend shows
  on hover, so be specific.
- `## Inventory` — pack items, consumables, quest items, treasure, scrolls not currently equipped,
  and currency. Each row has **Item / Qty / Weight (lb) / Notes**.

Total weight is the sum across both tables. Carrying capacity (`STR × 15 lbs`) and currency live
under `## Inventory`.

## 0. Prerequisites

- Determine campaign slug + active character.

## 1. Determine Action

Identify the operation from the player's request:

- **add** — gain an item (loot, gift, crafting result). New gear lands in `## Inventory` by default;
  if the player explicitly equips it on acquisition (e.g., "I draw the new sword and ready it"),
  move it straight into `## Equipped`.
- **remove** — drop, lose, give away, or destroy an item.
- **buy** — purchase from a vendor; costs currency. Lands in `## Inventory`.
- **sell** — sell to a vendor; gains currency. Source from either block.
- **equip** — move an item from `## Inventory` to `## Equipped`. Compute and record its Stats column
  (attack/damage for weapons, AC for armor, AC bonus for shields, etc.).
- **unequip** — move an item from `## Equipped` back to `## Inventory`.
- **list** — print the current Equipped and Inventory tables and currency.
- **transfer** — move an item to another character or container.

If the request is ambiguous (e.g., "I take the dagger from the goblin"), pick the most natural
action and proceed. Equipping requires a free hand / appropriate slot — call out conflicts.

## 2. Resolve

### add / remove

- Gather: item name, quantity, weight (per PHB ch. 5 if standard; otherwise ask or look up).
- For `add`, default destination is `## Inventory`. For loot that is obviously worn (a foe's
  helmet pried off mid-combat), `## Equipped` is fine if the player intends to wear it now.
- Update the table.

### buy / sell

- Confirm price. PHB equipment uses standard list price (PHB p. 143–151). For magic items, refer
  to DMG p. 135 rarity table or the campaign's house pricing.
- **Sell defaults to 50% of list** (PHB; some campaigns differ — check `campaign.md`).
- Adjust currency: `gp / sp / cp` (and `pp / ep` if used). Convert as needed (1 pp = 10 gp;
  1 gp = 10 sp = 100 cp; 1 ep = 5 sp).

### equip / unequip

- **Armor**: recompute AC. Note Strength requirements (Heavy armor) and Stealth disadvantage
  (Medium / Heavy where applicable). Stats column: `AC <n>` plus any caveats (e.g., `disadvantage
  on Stealth`).
- **Shield**: AC +2 if not already shielded. Cannot be wielded while a hand is full. Stats column:
  `AC +2`.
- **Weapon**: derive attack bonus (proficiency + ability mod) and damage. Stats column: `+N to
  hit · <damage>` plus relevant tags (versatile, finesse, thrown range, special properties).
- **Attuned magic items**: track attunement slots (max 3, PHB p. 138). Reject if the player tries
  to attune a fourth.

When equipping, the Attacks & Spellcasting table is the master source for combat math; copy the
relevant attack/damage line into the Equipped row's Stats column so the player can read it without
cross-referencing.

### list

- Print the Equipped table, the Inventory table, total weight, carrying capacity, currency, and
  attunement slots in use.

### transfer

- Subtract from the source's table, add to the destination's. If the destination is a container
  with a weight reduction (Bag of Holding, Handy Haversack), reflect that in the source character's
  carry weight.

## 3. Recompute

After any change to items:

- **Total weight** = sum(weight × quantity) across `## Equipped` and `## Inventory`.
- **Carrying capacity** = STR × 15 lbs. Push/drag/lift = STR × 30 lbs.
- If the campaign uses the encumbrance variant (PHB p. 176), check thresholds: encumbered at
  STR × 5 lbs, heavily encumbered at STR × 10 lbs.
- Flag if the character is now over capacity or encumbered.

## 4. Persist

Save the character sheet immediately (per Live Persistence). If a session is open and the change
is non-trivial (notable item, significant currency), append a one-line beat to `sessions/<NNN>.md`.
Mundane currency churn doesn't need a beat unless meaningful to the fiction.

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8,
no trailing whitespace).

## 5. Confirm

Tight summary: what changed, which block it moved between (if equip/unequip), new total weight +
capacity, new currency totals, any attunement / encumbrance flags.
