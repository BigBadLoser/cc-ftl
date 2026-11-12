---
title: Ship combat
order: 6
---

<script lang="ts">
  import Stat from '../../../lib/Stat.svelte'
  import ComingLater from '../../../lib/ComingLater.svelte'
</script>

Ship fights run in real time. Your guns charge, fire, and overheat your ship; the enemy's do the same. You win by wearing
down its hull, shields or crew, by taking the ship, or by getting away. This page covers the ship-to-ship fight. For
fighting on foot, see [Boarding and crew fights](../boarding/).

Weapon numbers (damage, charge time, shield effects) are on the [weapons reference](../../reference/weapons/).

## Battle stations and the combat view

When a hostile ship attacks, the game switches to the **combat view** by itself and raises an **Under attack** alert. The
colony panels are replaced by:

- the **enemy card**, top left;
- your **ship strip**, along the bottom;
- the enemy ship in the main view, with your own ship in a small inset. **Tab** swaps the two. The frame button on the
  enemy card shows both ships together.

You can open the same view at any time with **Battle stations** (**C**, or the tile beside *Draft all* in the crew bar). It
puts every weapon on hold, so nothing fires until you say so, and your crew man their consoles even with no fight on. Press
**C** again to stand down.

### Stations

The strip has a **Stations** card with four tags: **WPN** (weapons console), **SHD** (shield console), **HELM** and the
engines. A console shows **MANNED**, **EN ROUTE** while someone walks over, or **NO CREW**. Hover a tag for what an empty
console costs you:

| Station | Without crew or power |
|---|---|
| Weapons console | Weapons don't charge. |
| Shield console | Shields come back more slowly. |
| Helm | No evasion, and the jump drive doesn't charge. |
| Engines | No evasion. They also need a pilot at the helm to count. |

Crew man the consoles on their own. Skilled operators help: gunnery speeds up charging, shielding speeds up shield
recovery and piloting improves evasion. A console without power, or a destroyed one, can't be crewed. See
[Power and reactors](../power/).

## The enemy card

The card shows the ship's name and call sign, and a tag for how it stands with you:

| Tag | Meaning |
|---|---|
| **Hostile** (red frame) | At war with you. It fights back. |
| **Neutral** | Not at war with you. |
| **Friendly** | An ally. |

Below that are the ship's **Hull**, **Shields** (one pip per layer) and **Heat**. Hover the hull bar for its evasion, the
chance your shots miss. Under the bars is a row for each of its weapons. A weapon shows its status while charging, then
a **countdown in seconds** and a red ring on the target once it has aimed at you, so you can see which hit is coming
next. A small icon beside a weapon's name means it carries an upgrade.

Click an enemy weapon module to read its health and upgrade. It is read-only.

## Aiming and firing

Your weapons are cards along the strip, one per weapon, each with a hotkey (**Q**, **W**, **E**, **R** by default) and a
charge bar.

1. Click a weapon card (or press its key) to arm it.
2. Click a module on the enemy ship to aim at it. **Esc** cancels.
3. The weapon fires when charged.

A weapon with no aim shoots at the ship in general (**Ship** on the card), and the game aims at a new hostile ship for
you. Targeting a weapon at the enemy's weapons, shield generator or reactor is how you take its teeth.

**Auto and Hold.** Each weapon is on **AUTO** (fires when charged) or **HOLD** (charges, then waits). Click the bottom
line of the card, right-click the card or press **Shift** plus its key to flip it. A charged held weapon reads
**HOLD · READY**. Aiming a held weapon at an enemy fires it once, then it goes back to waiting.

| Button | Key | Does |
|---|---|---|
| **Volley** | **V** | Fires every charged weapon now. |
| **Hold all** | **H** | Puts every weapon on hold. Press again to restore each to its old mode. |
| **Vent** | **G** | Dumps heat; see [Heat](#Heat). |
| **Flee** | **F** | Jump away; see [Fleeing](#Fleeing-and-the-jump-drive). |
| **Board** | **B** | Send boarders; see [Boarding](../boarding/). |

### Firing on a ship that isn't hostile

Aiming at a neutral or friendly ship does nothing by itself. That is what makes battle stations safe to use around
traders and patrols. **The first shot you fire, or your first boarding, turns that ship hostile, and the ships that came
with it.** From then on they fight back, and nothing turns them back. Pirate dens and outposts that sleep wake up when you
fire on them. At a black-market node under a truce, any attack breaks the truce for everyone there.

## Weapon types

The charge time is for a gunner at skill 0. Every number below is from the game's data and follows rebalances.

- **Burst laser** (charges in <Stat kind="weapons" id="weapon.burstLaser" field="chargeSec" unit="s" />): three quick
  shots. Each strips one shield layer; with the shields down it chips hull and modules.
- **Mass driver** (<Stat kind="weapons" id="weapon.massDriver" field="chargeSec" unit="s" />): one heavy slug that
  passes a single shield layer and punches through the wall. Wrecks hulls and breaches rooms.
- **Ion cannon** (<Stat kind="weapons" id="weapon.ion" field="chargeSec" unit="s" />): drains one shield layer. If the
  shields are already down it knocks out the module it hits for a while instead (no power drawn or supplied). Almost no
  damage otherwise.
- **Incendiary launcher** (<Stat kind="weapons" id="weapon.incendiary" field="chargeSec" unit="s" />): little damage,
  but sets the impact tile and its neighbours on fire.
- **Missile launcher** (<Stat kind="weapons" id="weapon.missile" field="chargeSec" unit="s" />): ignores shields
  entirely and hits hard in a small blast. Spends a missile per shot. Slow, so point defence can shoot it down. Missiles
  also hurt drones and shuttles.
- **Flak cannon** (<Stat kind="weapons" id="weapon.flak" field="chargeSec" unit="s" />): a spread of weak pellets, one
  hull scrap per volley. Every pellet that meets a shield strips a layer, so flak opens shields for your other guns. It
  scatters more at range.

### Ammo weapons and "on hold"

Missiles and flak use up items from your storage (missiles, and hull scrap). The weapon card shows how many are left as
`×N`. With none, the weapon can't fire. Because ammo is precious, **ammo weapons start on HOLD**; set one to AUTO when
you want it firing on its own.

### Point defence

A **Point defence** module takes a shot at each incoming missile. It doesn't stop everything, and each module rolls on its
own, so fit more than one against missile ships. Defence drones help too; see [Drones](../drones/).

## Shields

Shields are layers. Each **shield generator** you run adds layers (bigger Mk II and Mk III generators add more), and the
strip shows them as pips. A hit that meets a shield removes layers instead of hurting the hull.

- A layer returns every few seconds. A crewed shield console speeds that up.
- Lasers and flak strip a layer each shot. Ion drains one without damage. A mass driver is **piercing**: it passes through
  when there is one layer or fewer. Missiles ignore shields completely.
- Layers above what your generators can support vanish at once, and an unpowered or destroyed generator drops its layers.
- Shield layers are drawn as a hex bubble round each ship: lit rings count the layers, an ion drain turns the rim violet,
  and a broken layer visibly cracks.

Absorbing hits heats your ship; see below.

## Heat

Your ship has a heat meter, shown as a percentage with its change per second.

- Every volley adds heat, and so does every shield layer a hit removes.
- **Heat only falls while your shields are down**, plus whatever **radiators** shed. Holding the shields up runs the ship
  hot, so you choose when to drop them.
- At 100% the ship **overheats**: for <Stat kind="tuning" id="LOCKOUT_SEC" /> seconds weapons can't charge or fire and the shields stay down (**Thermal
  overload**). Heat then drops to <Stat kind="tuning" id="LOCKOUT_EXIT_HEAT" />%.
- **Vent** (**G**) dumps heat fast for <Stat kind="tuning" id="VENT_SEC" /> seconds, but the shields drop and the weapons hold fire. You need at least <Stat kind="tuning" id="VENT_MIN_HEAT" />%
  heat to vent. Time it between enemy volleys.

**Overcharge** pushes one system for <Stat kind="tuning" id="OVERCHARGE_SEC" /> seconds for extra heat, then needs <Stat kind="tuning" id="OVERCHARGE_COOLDOWN_SEC" /> seconds before the next one:

| System | While overcharged |
|---|---|
| Weapons | Charge speed rises to <Stat kind="tuning" id="OVERCHARGE_WEAPON_CHARGE" percent />. |
| Shields | Layers return <Stat kind="tuning" id="OVERCHARGE_SHIELD_REGEN" /> times as fast. |
| Engines | +<Stat kind="tuning" id="OVERCHARGE_ENGINE_EVASION" percent /> evasion (needs a pilot). |

The enemy plays the same game. It vents and overcharges, and a hot enemy can lock itself out. Watch its heat row.

## Evasion and engines

**Evasion** is the chance an incoming shot misses outright. It comes from your **powered engines**, boosted by the
**pilot's skill**, and is capped at <Stat kind="tuning" id="EVASION_CAP" percent />. With no pilot at a powered helm, or no engine power, evasion is zero. Ion hits on
an engine take its share away for a while. Evasion appears on your Status card; the enemy's is in the hull tooltip.

## Damage

- **Hull.** Walls take damage from every hit. A wall that fails opens a **hull breach**: the room vents to space, and you
  get a **Hull breach** alert. Crew in the room need suits or air. Mass drivers and thermite shots breach walls on
  purpose. Your crew **seal breaches and fight fires** on their own, and in a fight repairs go to guns, shields and
  reactors first.
- **Modules.** A hit near a module damages it. A damaged module may still work; a destroyed one is dead until rebuilt, and a
  destroyed container loses what was inside. Destroying a reactor cuts power at once.
- **Fire.** Incendiary rounds start fires. A fire burns oxygen, spreads, damages modules and hurts crew. Rooms with
  fires show the **Fire** alert.
- **Crew.** Blasts hurt anyone near the impact, so keep crew away from the side under fire. Downed crew are covered in
  [Boarding and crew fights](../boarding/).

A ship's **integrity** is its hull and its modules together. Below <Stat kind="tuning" id="WRECK_BELOW" percent /> it becomes a wreck.

## Upgrades

Each weapon module has one **upgrade slot**. An upgrade is an item that you fit into a weapon, and it changes how that gun
behaves.

**Fitting.** Select the weapon module and use the **Upgrade slot** section of its inspector. It lists the fitted upgrade
(with **Remove**) and the fitting upgrades in your cargo (with a button to fit them). An **engineer** does the work, and
**the weapon is offline until they finish**. A job waiting for an engineer can be cancelled. Fitting a second upgrade swaps
the first back to cargo. The fitted upgrade shows as a small icon next to the weapon's name on your bar, and on the enemy card.

### General upgrades

These fit any weapon.

| Upgrade | Effect |
|---|---|
| **Quick capacitor** | Charge time drops to <Stat kind="items" id="item.upg_capacitor" field="upgrade.mods.chargeMul" percent />of normal. |
| **Coolant jacket** | Heat per volley drops to <Stat kind="items" id="item.upg_coolant" field="upgrade.mods.heatMul" percent />. |
| **Hardened housing** | The weapon takes <Stat kind="items" id="item.upg_housing" field="upgrade.mods.damageTakenMul" percent /> of the damage from hits and ion. |

### Behaviour upgrades

Each fits one weapon type and turns it into a new weapon, with its own shot colours.

| Upgrade | Fits | Turns it into |
|---|---|---|
| **Prism splitter** | Burst laser | **Prism laser**: <Stat kind="items" id="item.upg_prism" field="upgrade.mods.weapon.shots" /> shots instead of three, each 40% weaker, and runs at <Stat kind="items" id="item.upg_prism" field="upgrade.mods.heatMul" percent /> heat. |
| **Heavy focus** | Burst laser | **Lance laser**: two heavier shots, each passing one shield layer; charges slower (charge time <Stat kind="items" id="item.upg_focus" field="upgrade.mods.chargeMul" percent />). |
| **Frag slug** | Mass driver | **Frag driver**: a bigger blast, harder on crew and modules, but no longer passes a shield layer. |
| **Rail coil** | Mass driver | **Railgun**: passes two shield layers and flies much faster, but runs very hot. |
| **Nuclear warhead** | Missile launcher | **Nuke launcher**: a huge blast with fire across it, for <Stat kind="items" id="item.upg_nuke" field="upgrade.mods.weapon.ammoPerShot" /> missiles a shot. |
| **Chain coil** | Ion cannon | **Arc cannon**: the ion bolt arcs from the module it hits into nearby crew; runs at <Stat kind="items" id="item.upg_chain" field="upgrade.mods.heatMul" percent /> heat. |
| **Thermite** | Incendiary launcher | **Thermite cannon**: real hull damage on top of the fire, so it breaches as well as burns. |

### Where to get upgrades

- **Build them.** Research the upgrade (under defence), then build it at the **fabricator** from metal, electronics and
  polymer. You can also buy the blueprint at a station.
- **Buy them** at stations that sell them.
- **Take them from enemy ships.** Enemies carry their own upgrades, and you will see them fitted on the enemy card.
- **The Nuclear warhead is contraband**: no blueprint, sold only on the black market, and a black-market inspection seizes
  it. You can read every upgrade's cost on the [items reference](../../reference/items/).

## Fleeing and the jump drive

The **Flee** tab (right of the strip, **F**) jumps your ship out of the fight. It needs the **drive charged** and a
**crewed helm**. The drive charges for <Stat kind="tuning" id="FTL_CHARGE_SEC" unit="s" /> of piloted, powered-engine
time, and the tab fills as it goes. A tab greyed out says **Helm unmanned: the drive is not charging** if nobody is at the
helm.

When it's ready, press Flee and pick a destination on the starmap. Fleeing leaves you **adrift in hyperspace**; use
**Drop from hyperspace** on the starmap to return to the node you fled. If crew or shuttles would be left behind, the game
asks first. Enemies that outrun the fight jump too, and the fight report says **Enemy fled**.

You can also charge the drive outside combat with a pilot at the helm, ready for the next fight.

## How fights end

- **Enemy disabled.** A ship is **disabled** while no crew member can act, or no power flows (no reactor running).
  It can't shoot, and it recovers if the cause clears.
- **Wreck.** A ship is a **wreck** once its integrity falls below <Stat kind="tuning" id="WRECK_BELOW" percent />, or when every power source is destroyed. Everyone aboard dies, weapons and shields go dead, and the hull stays
  as a derelict you can salvage. See [Salvage](../salvage/).
- **Surrender.** A hostile ship whose hull is below <Stat kind="tuning" id="HOPELESS_HULL" percent />, with its
  weapons dead, its drive uncharged and its crew cut off or outnumbered by your boarders, gives up. When every enemy crew
  member is down, surrendered or dead, the ship is given up as a derelict, unless your people can still reach it. Keep
  boarders aboard or a shuttle docked to take it as a prize; see [Boarding and crew fights](../boarding/).
- **Enemy flees.** Below <Stat kind="tuning" id="FLEE_BELOW" percent /> hull, a ship with a charged drive jumps away.
- **You lose.** Your own ship can be disabled or wrecked the same way.

When a fight ends, the **Fight report** card shows the outcome (**Destroyed**, **Disabled**, **Captured**, **Enemy fled**,
**You fled** or **Ship lost**), how long it lasted, your hull change, modules lost and crew down or dead.
