---
title: Injuries and healing
order: 3
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ComingLater from '../../../lib/ComingLater.svelte'
</script>

Health points are only half the story. A hard hit, a fire or a breach can also leave a lasting **injury** on a part of
the body: a cut arm, a broken leg, a concussion. Injuries change what a crew member can do until they heal, and some
never heal at all.

Robots and alien creatures take no injuries: robots are mended with parts, creatures just die.

## The body

Every crew member has ten body parts:

- **Head:** brain, left eye, right eye.
- **Torso:** heart, lungs, spine.
- **Limbs:** left arm, right arm, left leg, right leg.

Each part has a condition. Its injuries lower it, and it comes back as they heal. The parts feed six **capacities**,
and the capacities change the crew member's stats:

| Capacity | Parts | What it changes |
|---|---|---|
| Manipulation | Arms | Work speed, melee, construction, industry, cooking |
| Moving | Legs, and the spine on top | Walking speed, how much they carry |
| Sight | Eyes | Gunnery, melee, science. One eye lost costs part of it, both most of it. |
| Consciousness | Brain | Work speed and every skill. Very low knocks them out. |
| Breathing | Lungs | Suit air runs out sooner; a little slower at work and on foot |
| Blood pumping | Heart | Bleeding out comes sooner; every kind of healing is slower |

### The Health tab

The crew inspector's **Health** tab shows it all at a glance:

- A line across the top says what is wrong in a few words: "Bleeding. Needs first aid and a medic.", "Needs a medic.",
  "Down." or "Healthy.". Red means it needs care now.
- On the left, their health, how fast they bleed (while they do), and every capacity. A capacity under
  <Stat kind="tuning" id="CAPACITY_LOW_BELOW" percent /> shows red.
- On the right, all ten body parts with their state: "Fine", or the worst injury, such as "Fracture, treated" or
  "Destroyed" (with "+1" when the part has more). Red only when it needs care now: bleeding, or serious and untreated.
- Point at an injured part for its card: what is wrong, what care it needs, what it does to the crew member, and how
  and when it happened.

The Skills tab shows the stat changes as "Injuries" in each breakdown.

## Where injuries come from

Health stays the pool. On top of the damage, a hit can injure a part, more often the harder it is:

- **Bullets** mostly hit the torso.
- **Blades and blows** mostly hit the arms and head.
- **Blasts and shrapnel** from ship weapons spread over the whole body. Lightning arcs burn.
- **Fire** burns two parts at a time while someone stands in it.
- **Vacuum and thin air** hurt the lungs and eyes.
- **Going down** always adds one serious injury.

## How bad

1. **Minor:** bruises, cuts, burns, punctures, burst vessels. They heal on their own.
2. **Serious:** fractures, deep burns, concussions, organ damage. They heal only once a medic has treated them.
   Left untreated, one may heal badly into a **scar**: every <Stat kind="tuning" id="SCAR_AFTER_SEC" unit="s" /> there
   is a <Stat kind="tuning" id="SCAR_CHANCE" percent /> chance. A scar is a small loss on the part for good.
3. **Lost:** a part whose condition runs out is destroyed. A lost eye or limb stays lost. A lost brain, heart or lungs
   knocks the crew member down, and they bleed out even in a bed.

<ComingLater>Surgery to repair organs and fit cyberware (cyber arms, legs, eyes, lungs and hearts) that restores lost parts.</ComingLater>

## Bleeding and first aid

Fresh cuts and punctures **bleed**: the crew member slowly loses health while on their feet, and does not regenerate
until it stops. Bleeding stops on its own after a while, when they lie in a bed, or with **first aid**.

Any crew member with the **Medical** priority gives first aid where the patient stands. It takes about
<Stat kind="tuning" id="FIRST_AID_SEC" unit="s" /> of work and trains Medicine. A **medic drone** does it too.

## Treatment

A serious injury needs a **medical bed**. Crew with one walk to a free medical bed on their own. Downed crew are
carried to a recovery pod first when there is one, so their serious injury waits until they can walk to a medical bed. While a medic tends the bed, they treat the patient's serious injuries one at a time, about
<Stat kind="tuning" id="TREAT_SEC" unit="s" /> each. The medic's Medicine skill and any medicinal herbs in stock set how
well it is done: a better treatment heals faster. A patient stays in the bed until everything is treated. If no medic has started on them
<Stat kind="tuning" id="STRANDED_SEC" unit="s" /> after they lie down, they give up and get up, and do not come back for it for
<Stat kind="tuning" id="STRANDED_RETRY_SEC" unit="s" />.

A **recovery pod** does not treat injuries, but treated ones heal
<Stat kind="tuning" id="POD_INJURY_HEAL_MULT" />× as fast while the patient lies in a powered pod.
