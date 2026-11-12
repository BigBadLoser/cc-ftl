---
title: Your first hour
order: 1
---

<script lang="ts">
  import GuideShot from '../../../lib/GuideShot.svelte'
  import GoalActs from '../../../lib/GoalActs.svelte'
  import Stat from '../../../lib/Stat.svelte'
</script>

You start with a small ship, a small crew, 500 credits and a trade station next door. This guide walks through
the first hour: choosing a ship, reading the screen, looking after your crew, building, trading, taking a contract and making your first
jump.

The game starts running straight away. Press **Space** whenever you want to stop and think: everything here can be
done while paused.

## Choosing a ship

Pick **New game** on the title screen. The first page offers three ships as cards; click one to see it behind the menu,
then press **Next**. The next page is your crew: each berth shows a portrait, background and top skills. Lock the ones
you like, **Reroll unlocked** for the rest, and press **Start**.

| Ship | Style | Crew | What it has |
|---|---|---|---|
| **Wayfarer** (Spine Hauler) | Balanced | 4: engineer, gunner, pilot, medic | A burst laser, a shield, a shuttle with its bay, a lounge, a med bed and a fabricator. |
| **Prospector** (Claw) | Hauler and miner | 3: pilot and two engineers | A big hold, an ore refinery, a mining pod and one light gun. No shuttle. |
| **Lancer** (Dart) | Fighter | 4: two gunners, a pilot, an engineer | A missile launcher in the point, a burst laser in each tail fin, a Mk II shield and 16 missiles. No shuttle. |

All three have a helm, two reactors with a battery bank beside them, engines, life support, a galley that keeps 12 rations
in stock, beds for the whole crew, building materials in storage, a few weapons, 16 jump fuel and a stock of energy
crystals (28 on the Wayfarer, 26 on the Prospector, 40 on the Lancer). The Lancer also has a third reactor.

Trading needs a shuttle to carry the goods, so only the Wayfarer can trade from the start. The others need a shuttle bay
and a shuttle first (see [Trading](#Trading)).

## The screen

<GuideShot name="first-hour/hud" alt="The game screen at the start of a new game, with the main HUD areas numbered" />

1. **Screens:** the starmap, ship overview, the Crew window (priorities and schedules), ship stock, jobs and, once you have a lab, research.
2. **Crew bar:** one card per crew member, with their role and status. Click a card to select them.
3. **Time:** the clock, pause and three speeds, sharing a frame with the **ship's log**. A game hour is <Stat kind="tuning" id="GAME_HOUR_SEC" unit="seconds" />, and the ship clock matters for crew schedules.
4. **Goals:** what to do next (see Goals below).
5. **Tools:** Select, Build, Deconstruct and Cancel jobs, plus wall and roof views, overlays and the bug reporter.

Ships and stations outside the view get a small arrow at the edge of the screen, like the one near the tools in the
picture: click it to pan to them and select them.

Move the camera with **W A S D** or the arrow keys, zoom with the mouse wheel, and drag with the middle mouse button to
pan. Click a module, station or ship to inspect it. When a fight starts, the combat view takes over the screen and these
tools step aside until it's over; the first time, a short lesson walks you through it.

## Your ship and crew

<GuideShot name="first-hour/ship" alt="The starting ship seen from above with its roof off" width="720px" />

<GuideShot name="first-hour/ship" alt="The Wayfarer seen from above with its roof off" width="720px" />

Every starting ship has what it needs to fly, and the rest of this guide uses the Wayfarer's layout. Where a ship
differs, the table above says so.

Crews are built from these roles (the Wayfarer has one of each):

| Role | Good at | Usually found |
|---|---|---|
| Engineer | Repairs, construction, shields | Fixing and building things |
| Gunner | Gunnery | At the weapons, with a gun from storage; the others grab one too when boarders come |
| Pilot | Piloting | At the helm |
| Medic | Medicine | Treating the wounded |

Crew pick their own jobs: put out fires, repair damage, haul, build, cook and so on. You set what each person
prefers in the **Crew** window (**Priorities** tab) and when they work, sleep and rest in its **Schedule** tab. You don't need to micromanage them, but you do need to keep them fed, rested and
breathing. Rations come from the galley, so keep an eye on your stock.

To take direct control (in a fight, say), **draft** crew: select them and press **R**, or use **Draft all** on the crew
bar. Drafted crew follow right-click orders and stop doing their normal jobs until you stand them down.

## Goals

The goals card in the top right is a short tutorial chain. Goals in each act can be done in any order, and each act
pays a small reward:

<GoalActs />

The card's header shows the act and how many of its goals are done. Click it to collapse the card, or use × to skip
the goals for this game (it asks first). Finishing an act shows its reward for a few seconds.

## Building

<GuideShot name="first-hour/build" alt="Build mode with the Power tab of the build menu open" />

Pick **Build** in the tools (bottom right) to open the build menu (1). Choose a tab, pick a module and move the mouse
over your ship to see where it will go; press **R** to rotate. Click to place it, and your crew bring the materials
from storage and build it. Walls, floors and doors are dragged out instead.

A card with a lock is a module you don't have the blueprint for yet. Stations sell blueprints, and research unlocks
better tiers. Use **Deconstruct** to take something down and get some of its materials back, and **Cancel jobs** to call off
construction you haven't finished.

## Trading

The goods travel by shuttle. The Wayfarer has one; the Prospector and Lancer have no bay, so build a shuttle bay and
fit a shuttle before you trade (the trade window says "No shuttle to carry it" until then).

<GuideShot name="first-hour/trade" alt="The trade station's panel on the Trade tab" width="440px" />

Click the trade station (in the strip of nearby ships and stations, or in the world), then **Hail station**. The comms
channel opens with the station's services as buttons: dock control, quartermaster, job broker, recruiter and more.
**Trade** (marked with an arrow) opens its own floating **Trade** window, which you can drag, resize and pin. It works the same for
stations and trader ships. The market list shows every item with a **−** and **+** beside it: **+** buys, and **−** walks down through
zero into selling. Click moves one, Shift five, Ctrl ten and Alt as many as you can. The deal slip shows what you pay or
get and how many shuttle trips it needs. Press **PROPOSE** and, when the station answers, **ACCEPT**. Your shuttle
ferries the goods over.

The deliveries under way are listed in the window too, and you can agree several deals with the same partner: they
queue and run one after another.

**REFUEL** on the slip tops your jump fuel up in one click and shows the price first. Do it whenever you pass a trader.

## Two kinds of fuel

The game has two, and a new captain should know both.

- **Fuel** pays for jumps. The number is in the top bar. Each jump costs some, and the starmap warns you if your route
  will run out. Buy more from traders.
- **Energy crystals** feed the reactors. Without them the reactors make no power and the ship goes dark. Crew load the
  reactors from storage on their own, so the job for you is to keep crystals in the crates. The top bar shows the crystals
  in the reactors, in red when they are low and none are left in storage. Buy more at mining and trading stations, or mine
  them from asteroids.

Your starting crystals last a good while. Switching off modules you aren't using saves them. See
[Power and reactors](../../mechanics/power/).

## Your first contract

<GuideShot name="first-hour/jobs" alt="The station's contracts, with delivery jobs" width="440px" />

The station's job broker (a service button in the comms channel) lists contracts: deliveries, bounties and surveys, each with its pay, destination, distance and
deadline, and how strong any opposition is next to your own ship. **Accept** one and it appears in the jobs tracker on
the right and in the **Jobs** screen. You can hold up to <Stat kind="tuning" id="MAX_JOBS" /> jobs at a time.

A delivery puts a sealed crate on your deck. At the destination your crew carry it to an airlock, the station's shuttle
collects it, and you're paid. Bounties and surveys are finished out in the field, then handed in: press **Hand in** at
a matching station from the Jobs screen.

## Your first jump

<GuideShot name="first-hour/starmap" alt="The starmap at the start, showing the home sector" />

Open the **starmap** with **M** (or the map button). Click a destination to see its route, fuel cost and charge time,
then press **Jump**. If the drive isn't charged yet, choose **Jump when charged**: your pilot sits at the helm and the
drive charges from the engines (about <Stat kind="tuning" id="FTL_CHARGE_SEC" unit="seconds" /> for a full charge).

To jump you need a working, powered helm, at least one powered engine, someone aboard to fly, and enough fuel for each
leg. On a long route the starmap warns you if the trip will stop where the fuel runs out. When you arrive, press **Drop
from hyperspace** and pick a spot to deploy; until then the starmap stays open.

Before you go, make sure nobody is still out on a shuttle or a spacewalk; the game asks you to confirm if they are.

Two things to watch as you grow:

- **Engine capacity.** Your engines can only move so much hull. Build bigger than they can carry and the jump is
  blocked; **Overcharge** forces it, at the risk of damaging an engine and starting fires. More engines carry more.
- **Running dry.** If you can't afford any jump, an **Out of fuel** banner appears (this is jump fuel; a ship out of crystals shows a **Low power** alert instead). It points you to a trader's
  **Refuel** if there is one, or lets you send a distress call for a tug.

## The menu and saving

<GuideShot name="first-hour/menu" alt="The game menu: Resume, Save game, Load game, New game, Controls, Settings" width="300px" />

**Esc** closes whatever is on top: a window, a tool, an aim, a selection. With nothing left to close it opens the game
menu, which pauses the game.

The game saves itself every 30 seconds and whenever you close or switch away from the tab. To save on purpose, choose
**Save game**: there are three named slots next to the autosave, and **Load game** brings any of them back. **New game**
starts over; your saved slots stay. **Controls** lets you change any key (see [Controls](../controls/)), and
**Settings** covers lessons, gameplay (such as pausing on urgent alerts), camera and input, and display.

## What next

- [Controls](../controls/): every key, and how to change them.
- [Power and reactors](../../mechanics/power/): why things go dark, and how to choose what keeps running.
- [Ship modules](../../reference/modules/): every module you can build.
