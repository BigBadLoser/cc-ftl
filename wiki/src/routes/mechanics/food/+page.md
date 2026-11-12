---
title: Food and farming
order: 4
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ModuleTable from '../../../lib/ModuleTable.svelte'
</script>

Hungry crew go and eat, and crew who can't find food slowly starve. You can keep a ship fed on printed rations alone,
but a hydroponics bed and a galley give you better food, happier crew and something to sell.

## What crew eat

Hunger runs from 100 (full) down to 0. At some point a hungry crew member drops what they are doing and goes to eat.
They take food from any storage on the ship and eat it where they are served:

- **At a powered galley.** The meal counts as a hot meal and lifts mood for a while (see [Mood](../mood/)).
- **Beside a storage crate** if there is no working galley. It feeds them, but gives no mood.

A meal takes <Stat kind="tuning" id="EAT_SEC" unit="seconds" /> once the crew member is in place. If you draft them
mid-meal, the food they took is lost.

### Eating order

Crew eat the most filling food the ship holds first, so your best meals go first and rations are the last resort.

| Food | Fills | Mood (at a galley) | Where it comes from |
|---|---|---|---|
| Fine meal | <Stat kind="items" id="item.meal_fine" field="food.nutrition" /> | <Stat kind="items" id="item.meal_fine" field="food.mood.points" signed /> | Galley, cook with Cooking 6 or more |
| Good meal | <Stat kind="items" id="item.meal_good" field="food.nutrition" /> | <Stat kind="items" id="item.meal_good" field="food.mood.points" signed /> | Galley, cook with Cooking 2 or more |
| Bland meal | <Stat kind="items" id="item.meal_bland" field="food.nutrition" /> | <Stat kind="items" id="item.meal_bland" field="food.mood.points" signed /> | Galley, any cook |
| Ration | <Stat kind="items" id="item.ration" field="food.nutrition" /> | <Stat kind="items" id="item.ration" field="food.mood.points" signed /> | Galley (printed from water), or bought |

These numbers are the food items' own values. Raw crops can't be eaten: they have to be cooked.

## Starvation

At zero hunger a crew member loses <Stat kind="tuning" id="STARVE_HARM_PER_SEC" unit="hp per second" />. That is slow
(a healthy crew member lasts about half an hour), but nothing else heals them while they starve.

- The crew bar marks anyone under 10 hunger as **Starving**.
- The first time someone hits zero you get an urgent **starving** alert. It stays quiet until the condition clears.
- Crew asleep get hungry at half speed.

If the alert fires, check that the ship has food in storage and that a path to it is open. A crew member can't eat food
locked in an unreachable room.

## Rations and the galley

The **Galley** is the ship's kitchen. It needs power (<Stat id="module.galley" field="power" /> units) and a crew member
working the **Cook** column.

Its **Print rations** order turns <Stat kind="tuning" id="recipes.recipe.ration.in.item.water" /> water into <Stat kind="tuning" id="recipes.recipe.ration.out.item.ration" /> rations. All three starting ships keep <Stat kind="tuning" id="starters.wayfarer.stock.item.ration" /> rations in stock this way, so a fresh
game never goes hungry as long as there is water. Rations are the emergency fallback: they fill the least and give the
least mood.

Select the galley to manage its orders. Use **+ Add order**, pick a recipe, and choose **Make** (a fixed number of batches)
or **Keep** (stay topped up to a number).

## Hydroponics

A hydroponics bed grows one crop at a time. Crew sow it, it grows on its own while the bed has power, and crew harvest it.

<ModuleTable ids="module.hydroponics, module.hydroponics_large" columns="power:Power:signed, maxHp:Hull points" />

The **large bed** gives <Stat kind="tuning" id="furniture.module.hydroponics_large.plot.scale" /> times the yield of the small one for <Stat kind="tuning" id="furniture.module.hydroponics_large.plot.waterScale" /> times the water and draws <Stat kind="tuning" id="furniture.module.hydroponics_large.power" scale={-1} /> power instead of <Stat kind="tuning" id="furniture.module.hydroponics.power" scale={-1} />. Both beds are in
the module menu once built.

### Crops

Select a bed and pick a crop in its panel. The pick is sown again after every harvest. Choose **Leave empty** to stop
farming that bed. A crop already in the soil isn't disturbed when you change the pick.

| Crop | Yield (small bed) | Grow time | Water to sow | Used for |
|---|---|---|---|---|
| Greens | <Stat kind="tuning" id="crops.crop.greens.yield" /> | <Stat kind="tuning" id="crops.crop.greens.growSec" scale={1/60} unit="min" /> | <Stat kind="tuning" id="crops.crop.greens.water" /> | Cooked into meals |
| Protein beans | <Stat kind="tuning" id="crops.crop.beans.yield" /> | <Stat kind="tuning" id="crops.crop.beans.growSec" scale={1/60} unit="min" /> | <Stat kind="tuning" id="crops.crop.beans.water" /> | Cooked into meals |
| Medicinal herbs | <Stat kind="tuning" id="crops.crop.herbs.yield" /> | <Stat kind="tuning" id="crops.crop.herbs.growSec" scale={1/60} unit="min" /> | <Stat kind="tuning" id="crops.crop.herbs.water" /> | Used up in a medical bed to heal faster |
| Grain | <Stat kind="tuning" id="crops.crop.grain.yield" /> | <Stat kind="tuning" id="crops.crop.grain.growSec" scale={1/60} unit="min" /> | <Stat kind="tuning" id="crops.crop.grain.water" /> | Sold at stations; not food |

Greens grow fast for a small yield. Beans are slow but give the most food. In round numbers, one bed of greens or beans
feeds three to five crew. Herbs: a patient in a medical bed uses one herb on arrival and heals <Stat kind="items" id="item.herbs" field="medicine.healMult" /> times as fast for that
stay.

### Sowing and harvesting

Both jobs sit on the **Farm** column of the crew work table, next to Cook. Set it for the crew you want on the beds.
Setting a crew member's Farm cell to off keeps them away from the beds.

1. **Sowing.** A crew member brings the water to the bed first, then sows. Sowing takes a short time.
2. **Growing.** The crop grows only while the bed is switched on, undamaged and powered. No power means no growth.
3. **Harvesting.** When ripe, the bed shows ready. A crew member cuts it, the produce drops at the bed's access tile,
   and hauling carries it to storage.

Crew won't sow a crop when the ship already holds plenty of it. The bed's panel then says "Plenty of ... in stock: not
sowing" and sowing resumes when stock runs down. This stops one bed filling the hold.

### Power and empty beds

A bed only draws power while a crop is in it. An **empty bed draws nothing**, and an empty bed with no crop picked
never asks for power. A planted bed takes its power at the bottom of the default order (5), so a power shortage stalls
farms before anything else. See [Power](../power/).

### Water

Water is the only input. It comes from ice split at a refinery, or from stations (see below). Each sowing uses water
(table above, doubled for a large bed), and each cooked batch uses 2 more. Watch the water stock if you run several beds.

## Cooking

Cooking turns crops into meals at the galley. Add an order for **Cook greens** or **Cook protein beans**: <Stat kind="tuning" id="recipes.recipe.meal_greens.in.item.greens" /> produce and
<Stat kind="tuning" id="recipes.recipe.meal_greens.in.item.water" /> water make <Stat kind="tuning" id="recipes.recipe.meal_greens.out.item.meal_good" /> meals.

The **Cooking** skill of the crew member doing the job picks the quality of the whole batch:

| Cooking skill | Meal |
|---|---|
| 0 to 1 | Bland meal |
| 2 to 5 | Good meal |
| 6 or more | Fine meal |

Cooking practice trains the skill. A good cook is worth more than a bigger farm: a fine meal fills more and cheers the
crew more than a ration. Medics start with some Cooking. See [Crew](../crew/) for how skills grow.

If you set a Cook order and the galley sits idle, check that it has produce, water and power, and that someone has Cook
set above off.

## Buying food

Stations and freighters sell rations. Hail the ship or station, then use the **+** buttons in the trade window. Agri
stations hold the most food (rations, grain and water). Stations also stock rations for their own crew and restock
them regularly, so a station's crew don't go hungry.

Grain isn't food, but it is a trade good, so a spare bed is worth planting. See [Trading](../trading/).
