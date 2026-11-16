# Catalog: environment and ship systems

The physical simulation of a ship: air, power, fire, heat, light, rooms, hull and roof. These are grid-field systems that run first in the pipeline
(`src/sim/pipeline.ts`, in order: rooms, power, modules, doors, airlock, vents, atmosphere, fire, itemFire, temperature, smoke, lighting, alerts, suits, airStores, vitals).
Each owns its question (see "One answer per question" in `docs/ARCHITECTURE.md`). Overlay views for the field-based ones are in `src/render/overlayDefs.ts`.

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Rooms | `roomsSystem` | Flood-fill rooms from walls and doors; room ids for air and rooms UI | In game | sim/systems/rooms.ts, roomIndex.ts, regions.ts |
| Power | `powerSystem` | Supply from reactors, batteries; draw by priority; brownouts | In game | sim/systems/power.ts, modules/draw.ts, network.ts; ui/PowerPanel.svelte, PriorityTable.svelte |
| Reactor fuel | `refuelSystem` | Crystals burned for power; crew refuel jobs | In game | sim/modules/refuel.ts, energy.ts |
| Atmosphere | `atmosphereSystem` | O2 and CO2 gas diffusion through doors and breaches; vented space | In game | sim/systems/atmosphere.ts, diffusion.ts; life support module |
| Life support | `modulesSystem` | Makes air per room; bottled oxygen doubles output | In game | sim/systems/modules.ts; module.lifeSupport |
| Doors | `doorsSystem` | Crew-opened doors; forced doors; airlock doors | In game | sim/systems/doors.ts, crew/forceDoor.ts |
| Airlocks and air stores | `airlockSystem, airStoresSystem` | Chamber cycling, shuttle and airlock air refills | In game | sim/systems/airlock.ts, airStores.ts, modules/airlock.ts, eva/air*.ts |
| Suits and EVA | `suitsSystem` | Suit air drains; don and doff; space walking | In game | sim/systems/suits.ts, eva/*; content/suit.ts |
| Fire | `fireSystem` | Fire burns O2 and spreads; heat, smoke; crew and drones fight it | In game | sim/systems/fire.ts, itemFire.ts; scenario damage |
| Smoke | `smokeSystem` | Smoke field spreads and hurts breathing | In game | sim/systems/smoke.ts |
| Temperature | `temperatureSystem` | Heat field from reactors and fires; radiators; cold in vented rooms | In game | sim/systems/temperature.ts |
| Lighting | `lightingSystem` | Lamps light radius; doorways borrow light; dark penalty to mood | In game | sim/systems/lighting.ts; module.light |
| Hull, breaches and damage | `shipStateSystem` | Hull tiles take damage, breach, vent; module hp; repair jobs | In game | sim/systems/shipState.ts, combat/hull.ts; render/damageView.ts; `decay.*` art |
| Vitals | `vitalsSystem` | Breathing, harm, downing, bleeding, death | In game | sim/systems/vitals.ts |
| Alerts | `alertsSystem` | Derived alerts for low air, fire, power, hull; urgent clickable list | In game | sim/systems/alerts.ts; app/alerts.ts; ui/AlertList.svelte |
| Roof and deployable roof parts | `deploySystem` | Roof tiles, roofed ships; roof parts fold out on combat state and power; roof darkens with the hull | In game | sim/systems/deploy.ts, modules/deploy.ts; render/roofView.ts; 1507 roof.* assets |
| Floor finishes (heavy plate, clean tile, carpet) | `-` | `floor` grid field (`Finish`, structure.ts) read from template `floors` rows (`h` `c` `k`); looks only. Nothing places it yet (the station generator does not use it). Art `tile.floor.heavy`, `tile.floor.clean` (+ `.1` `.2` `.3` siblings, one tile in 20 each), `tile.floor.carpet` (sheet `deck_finishes`); the carpet is grey art painted with the hull paint step in the livery's muted main colour (render/carpetPaint.ts, `carpetPaintFor`). Shown in render lab panel `floor-finishes` | Partial | sim/structure.ts, ship.ts; render/tiles.ts floorChain, gridView.ts, carpetPaint.ts, hullArt.ts; tools/blender/sprites/deck_finishes.py |
| Deck markings (walkway line, hazard band, keep-clear box, door apron) | `-` | Per-tile edge masks in grid fields `markWalkway` `markApron` `markKeepClear` `markHazard` (bits N 1 E 2 S 4 W 8, keep-clear also `MARK_FILL` 16; constants in sim/marks.ts for the generator's markings.ts to import); saved; the renderer draws each quarter of a tile from its own edge bits and its neighbours' (render/deckMarks.ts, sheet `deck_marks`, 72 quarter pieces) over the floor plate. The walkway line is grey art painted cream (or `HullPaint.walkway`). The apron is stored, not drawn. Nothing stamps the masks yet. Render lab panel `deck-marks` | Partial | sim/marks.ts, structure.ts; render/deckMarks.ts, gridView.ts; tools/blender/sprites/deck_marks.py |
| Structure types (floor, wall, door, truss, rock) | `-` | Grid structure kinds; costs in structCosts (floor, wall, door) | In game | sim/structure.ts; content/costs.ts |
| Building and hull plan | `-` | Build modules and hull from the catalog; hull plan brushes; shipyard planning | In game | sim/modules/handlers.ts; app/hullBrush.ts, hullPlanTool.ts; ui/BuildCatalog.svelte, HullPlanBar.svelte |
| Rock digging | `-` | Dig and carve asteroid rock for outposts | In game | sim/rock/dig.ts |
| Overlays | `-` | Nine field views: o2, co2, temp, fire, smoke, light, power, room quality, rooms | In game | render/overlayDefs.ts; ui/OverlayPicker.svelte |
| Door vents | `ventsSystem` | Every door has a vent the player opens in the tile inspector; open, it passes air and pressure (not fire, heat or smoke) through a shut door; shuts itself on a hazard either side or no power, reopens when clear | In game | sim/systems/vents.ts, ventCommand.ts, diffusion.ts; ui/TileInspector.svelte; `?scenario=vents` |
| Water purifier module | `module.waterPurifier` | Ice to water module | In game | issue #321 |
| Arcade module | `-` | New recreation module | Art only | issue #319 |
| Recovery pod module | `module.recovery` | Recovery module | Partial (built, first pass; see catalog/modules.md) | issue #319 |
| Performance of environment systems | `-` | Per-tick environment cost dominates | Planned | issue #65 |
