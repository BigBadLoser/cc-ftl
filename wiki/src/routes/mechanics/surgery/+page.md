---
title: Surgery and implants
order: 4
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ComingLater from '../../../lib/ComingLater.svelte'
</script>

Some harm a medical bed cannot mend: a lost eye, a ruined arm, a scarred heart. **Surgery** can. A surgeon repairs
organs, takes off lost limbs, and fits **implants**: cyberware that replaces a lost part or improves a healthy one.
See [Injuries and healing](/mechanics/injuries/) for the body parts and capacities surgery works on.

## The surgical rig

The patient always lies in a **medical bed**. A surgeon can operate there at higher risk, except on the brain and the
spine. To operate safely, build a **surgical rig** (Life) beside the bed: it stands at the foot end, on either long
side, facing the bed (not at the head, where the monitor stands). It needs power. A medical bed with a powered rig
lowers the risk and allows brain and spine work. One rig serves the one bed it faces; if the bed goes, the rig serves
nothing.

## Queueing an operation

Open the crew member's **Health** tab and press **Queue operation**. Pick a part, then the operation:

- **Fit implant:** puts an implant from the ship's storage on the part. The list shows every implant that fits and how
  many are in stock.
- **Repair:** heals the serious injuries and scars of an organ (brain, eyes, heart, lungs, spine). A lost organ can
  only be replaced. Limbs heal by treatment at a medical bed.
- **Amputate:** takes off a lost arm or leg, so a cyber limb can go on.
- **Remove implant:** takes an implant out and puts it back in storage. A replacement taken out leaves the part lost,
  so a cyber heart or lungs can never be removed.

A greyed operation says why it does not apply. The picker also names the best free surgeon and their odds with a rig
and without one.

Operations are done in order. When the next one can start (its implant is in stock), the patient walks to a free
medical bed with a rig (or a plain medical bed, when the operation allows one) and lies down. Crew with the **Medical** priority take
the job, the best Medicine skill first. If no surgeon starts within <Stat kind="tuning" id="STRANDED_SEC" unit="s" />,
the patient gets up and tries again later. Press ✕ on a queued operation to drop it.

## How it goes

The surgeon works for a while (about <Stat kind="tuning" id="SURGERY_FIT_SEC" unit="s" /> to fit a Mk I implant,
longer for higher tiers), training Medicine. Then it succeeds or fails:

- The chance starts at <Stat kind="tuning" id="SURGERY_BASE_CHANCE" percent /> and each level of the surgeon's
  Medicine adds <Stat kind="tuning" id="SURGERY_CHANCE_PER_LEVEL" percent />.
- A medical bed without a rig takes <Stat kind="tuning" id="SURGERY_BED_PENALTY" percent /> off. Each implant tier above Mk I takes
  <Stat kind="tuning" id="SURGERY_TIER_DIFFICULTY" percent /> off.
- A **failure** leaves a bleeding surgical wound on the part; the implant stays in storage.
- A **botched** operation destroys the part (the brain is only badly hurt), and an implant being fitted is ruined.
  Botches are more common without a rig.

Surgery never kills outright, but losing a heart or lungs on the operating bed downs the patient.

## Saving a life

A crew member whose heart or lungs are destroyed goes down and bleeds out, even in a bed. If a **cyber heart** or
**cyber lungs** is in stock, an urgent replacement is queued at once: the patient is carried to a medical bed (one with a
rig first), and a surgeon drops everything else to fit it. It is a race against the bleeding.

## Implants

An implant is an item. **Replacements** take the place of the flesh part (and bring back a lost one); fitting one on a
healthy part removes the flesh, so it is a choice. **Augments** sit beside the flesh part. A part takes one of each.
Replacements take no injuries.

| Implant | Part | Mk I | Mk II | Mk III |
|---|---|---|---|---|
| Cyber arm | Arm | 80% of an arm | as good as flesh, melee +1 | 120%, melee +2, carries more |
| Cyber leg | Leg | 80% of a leg | as good as flesh | 115% |
| Cyber eye | Eye | 80% of an eye | as good as flesh, gunnery +1 | 110%, gunnery +1 |
| Cyber lungs | Lungs | 80% breathing | full breathing, suit air ×1.25 | full breathing, suit air ×1.6 |
| Cyber heart | Heart | 80% circulation | full circulation, bleeds out ×1.5 slower | full, bleeds out ×2 slower, heals ×1.5 faster |
| Spinal frame | Spine | 80% moving | full moving, carries more | 115% moving, carries even more |
| Neural chip | Brain (augment) | +1 to one skill | +2 to one skill | +3 to one skill |
| Reflex booster | Spine (augment) | move ×1.05 | move ×1.1, melee +1 | move ×1.15, melee +2 |
| Dermal armour | Skin (augment) | 5% less weapon damage | 10% | 15% |

Reflex boosters and dermal armour Mk II and III are military hardware: contraband in the hold.

**Named cyberware** is a kind of its own: no Mk tier, and it is only ever found, never made. Its name shows in a muted gold.
Surgery treats it like a Mk III piece, and an urgent replacement never takes it, so the patient's surgeon fits it by choice.

| Named cyberware | Part | Effect |
|---|---|---|
| Halcyon Heart | Heart | full circulation, bleeds out ×4 slower, heals ×2 faster |
| Neural co-processor | Brain (augment) | +1 to every skill, work ×1.05 |
| Hawkeye Lens | Eye | 120% of an eye, gunnery +3 |
| Titan Arm | Arm | 130% of an arm, melee +3, carries much more |
| Strider Leg | Leg | 130% of a leg, moves ×1.1 faster |
| Abyss Lungs | Lungs | 110% breathing, suit air ×2.5 |
| Atlas Frame | Spine | 110% moving, carries much more |
| Quicksilver | Spine (augment) | move ×1.25, melee +3 (military: contraband) |
| Carapace Weave | Skin (augment) | 25% less weapon damage (military: contraband) |

Every implant has a **load** (Mk I 1, Mk II 2, Mk III 3; a spinal frame one more; named pieces 3). A crew member at load
<Stat kind="tuning" id="HEAVY_LOAD" /> or more counts as **heavily augmented**, which the zealots respect.

<ComingLater>Where implants come from (research, fabricators, station and black-market stock), ion shutdowns of implants, repairing cyber parts, and crew who love or hate cyberware.</ComingLater>
