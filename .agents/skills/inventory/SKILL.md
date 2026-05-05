---
name: inventory
description: Manage the active D&D 5e character's inventory and currency. Trigger when the player wants to add, remove, equip, unequip, buy, sell, list, or transfer items. Updates the character sheet's Equipment table and currency, recomputing total weight and carrying capacity.
---

# Inventory

Manage the active character's equipment and currency. Operates on the `## Equipment` block of the character sheet.

## 0. Prerequisites

- Determine campaign slug + active character.

## 1. Determine Action

Identify the operation from the player's request:

- **add** — gain an item (loot, gift, crafting result).
- **remove** — drop, lose, give away, or destroy an item.
- **buy** — purchase from a vendor; costs currency.
- **sell** — sell to a vendor; gains currency.
- **equip / unequip** — toggle whether an item is being worn or wielded (relevant for armor, shields, attuned magic items).
- **list** — print the current inventory and currency.
- **transfer** — move an item to another character or container (bag of holding, mount, party stash).

If the request is ambiguous (e.g., "I take the dagger from the goblin"), pick the most natural action and proceed.

## 2. Resolve

### add / remove

- Gather: item name, quantity, weight (per PHB ch. 5 if standard equipment; otherwise ask or look up).
- Update the Equipment table.

### buy / sell

- Confirm price. PHB equipment uses standard list price (PHB p. 143–151). For magic items, refer to DMG p. 135 rarity table or the campaign's house pricing.
- **Sell defaults to 50% of list** (PHB; some campaigns differ — check `campaign.md`).
- Adjust currency: `gp / sp / cp` (and `pp / ep` if used). Convert as needed (1 pp = 10 gp; 1 gp = 10 sp = 100 cp; 1 ep = 5 sp).

### equip / unequip

- **Armor**: recompute AC. Note Strength requirements (Heavy armor) and Stealth disadvantage (Medium / Heavy where applicable).
- **Shield**: AC +2 if not already shielded. Cannot be wielded while a hand is full.
- **Attuned magic items**: track attunement slots (max 3, PHB p. 138). Reject if the player tries to attune a fourth.

### list

- Print the Equipment table, total weight, carrying capacity, currency, and attunement slots in use.

### transfer

- Subtract from the source's table, add to the destination's. If the destination is a container with a weight reduction (Bag of Holding, Handy Haversack), reflect that in the source character's carry weight.

## 3. Recompute

After any change to items:

- **Total weight** = sum(weight × quantity).
- **Carrying capacity** = STR × 15 lbs. Push/drag/lift = STR × 30 lbs.
- If the campaign uses the encumbrance variant (PHB p. 176), check thresholds: encumbered at STR × 5 lbs, heavily encumbered at STR × 10 lbs.
- Flag if the character is now over capacity or encumbered.

## 4. Persist

Save the character sheet immediately (per Live Persistence). If a session is open and the change is non-trivial (notable item, significant currency), append a one-line beat to `sessions/<NNN>.md`. Mundane currency churn doesn't need a beat unless meaningful to the fiction.

Every file written must follow the **File Conventions** in `AGENTS.md` (final newline, LF, UTF-8, no trailing whitespace).

## 5. Confirm

Tight summary: what changed, new total weight + capacity, new currency totals, any attunement / encumbrance flags.
