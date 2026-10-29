---
title: Your first hour
order: 1
---

<script lang="ts">
  import GuideShot from '../../../lib/GuideShot.svelte'
  import GoalActs from '../../../lib/GoalActs.svelte'
  import Stat from '../../../lib/Stat.svelte'
</script>

You start with a small ship, four crew, a few hundred credits and a trade station next door. This guide walks through
the first hour: reading the screen, looking after your crew, building, trading, taking a contract and making your first
jump.

The game starts running straight away. Press **Space** whenever you want to stop and think: everything here can be
done while paused.

## The screen

<GuideShot name="first-hour/hud" alt="The game screen at the start of a new game, with the main HUD areas numbered" />

1. **Screens:** the starmap, ship overview, crew priorities, ship stock, jobs, research and combat.
2. **Crew bar:** one card per crew member, with their role and status. Click a card to select them.
3. **Time:** the clock, pause and three speeds. Above it sits the **ship's log**.
4. **Goals:** what to do next (see Goals below).
5. **Tools:** Select, Build, Deconstruct and Cancel jobs, plus wall and roof views, overlays and the bug reporter.

Move the camera with **W A S D** or the arrow keys, zoom with the mouse wheel, and drag with the middle mouse button to
pan. Click a module, station or ship to inspect it.

## Your ship and crew

<GuideShot name="first-hour/ship" alt="The starting ship seen from above with its roof off" width="720px" />

The starter ship has everything it needs to fly and fight: reactors, life support, shields, two burst lasers and a
missile launcher, point defence, a helm, a fabricator, a galley, beds for four, three storage crates and a shuttle bay
with a shuttle. The crates hold building materials, ammunition, a few weapons, rations and **16 fuel**.

Your four crew each have a role:

| Role | Good at | Usually found |
|---|---|---|
| Engineer | Repairs, construction, shields | Fixing and building things |
| Gunner | Gunnery | At the weapons; arms themselves when boarders come |
| Pilot | Piloting | At the helm |
| Medic | Medicine | Treating the wounded |

Crew pick their own jobs: put out fires, repair damage, haul, build, cook and so on. You set what each person
prefers in **Crew priorities**. You don't need to micromanage them, but you do need to keep them fed, rested and
breathing. Rations come from the galley, so keep an eye on your stock.

To take direct control (in a fight, say), **draft** crew: select them and press **R**, or use **Draft all** on the crew
bar. Drafted crew follow right-click orders and stop doing their normal jobs until you stand them down.

## Goals

The goals card in the top right is a short tutorial chain. Goals in each act can be done in any order, and each act
pays a small reward:

<GoalActs />

You can collapse the card by clicking its title, or skip the whole chain with its × button.

## Building

<GuideShot name="first-hour/build" alt="Build mode with the Power tab of the build menu open" />

Pick **Build** in the tools (bottom right) to open the build menu (1). Choose a tab, pick a module and move the mouse
over your ship to see where it will go; press **R** to rotate. Click to place it, and your crew bring the materials
from storage and build it. Walls, floors and doors are dragged out instead.

A card with a lock is a module you don't have the blueprint for yet. Stations sell blueprints, and research unlocks
better tiers. Use **Deconstruct** to take something down and get some of its materials back, and **Cancel jobs** to call off
construction you haven't finished.

## Trading

<GuideShot name="first-hour/trade" alt="The trade station's panel on the Trade tab" width="440px" />

Click the trade station (in the strip of nearby ships and stations, or in the world), then **Hail station**. Once the
station answers, the **Trade** tab lists what you can sell and what they stock. Add items with the + and − buttons,
then **Propose** the deal. Your shuttle carries the goods across.

The trade tab also has a one-click **Refuel** button. Fuel is what limits how far you can go, so top up whenever you
pass a trader.

## Your first contract

<GuideShot name="first-hour/jobs" alt="The station's Jobs tab with delivery contracts" width="440px" />

The **Jobs** tab lists contracts: deliveries, bounties and surveys, each with its pay, destination, distance and
deadline. **Accept** one and it appears in the jobs tracker on the right. A delivery puts a sealed crate on your deck;
take it to the destination to get paid. You can hold up to <Stat kind="tuning" id="MAX_JOBS" /> jobs at a time.

## Your first jump

<GuideShot name="first-hour/starmap" alt="The starmap at the start, showing the home sector" />

Open the **starmap** with **M** (or the map button). Click a destination to see its route, fuel cost and charge time,
then press **Jump**. If the drive isn't charged yet, choose **Jump when charged**: your pilot sits at the helm and the
drive charges from the engines (about <Stat kind="tuning" id="FTL_CHARGE_SEC" unit="seconds" /> for a full charge).

To jump you need a working, powered helm, at least one powered engine, someone aboard to fly, and enough fuel. When you
arrive, press **Drop from hyperspace** and pick a spot to deploy.

Before you go, make sure nobody is still out on a shuttle or a spacewalk; the game asks you to confirm if they are.

## Saving

The game saves itself every 30 seconds, when you close or switch away from the tab, and after every jump. There's one
save slot and no manual save.

## Keyboard shortcuts

| Key | Does |
|---|---|
| Space | Pause or resume |
| 1, 2, 3 | Speed 1×, 2×, 3× |
| M | Starmap |
| W A S D, arrows | Move the camera |
| Mouse wheel, + / − | Zoom |
| R | Rotate while building (Shift+R back), or draft and undraft selected crew |
| Esc | Close menus, leave a tool, deselect |

## What next

- [Power and reactors](../../mechanics/power/): why things go dark, and how to choose what keeps running.
- [Ship modules](../../reference/modules/): every module you can build.
