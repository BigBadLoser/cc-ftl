# Progression build plan

The plan for the progression design in `docs/DESIGN.md` ("Progression"). Each phase is one PR, built and tested on
its own, in this order. Visual phases get a prototype and screenshots before the PR.

## Core idea: blueprints

One mechanism gates everything: a **blueprint** (unlock). A module, tier, upgrade or implant can only be built once
its blueprint is known.

- **Getting blueprints:** buy them at stations, find them in salvage, or research them.
- **Tiers are modules:** a tier is a module def with better stats and a higher materials cost (for example
  `module.shieldGen.mk2`), so the existing build, power and damage systems all work unchanged.
- **Art:** tiers reuse their base module's art with a small variant (a tint, trim or decal layer), so there is no new
  model per tier.
- **Starting state:** the player starts knowing only the basic blueprints.

## Phases

1. **Blueprints and tiered core modules.**
   - Sim: a `GalaxyState`/story-level set of known blueprints, and a build menu that only lists known modules.
   - Content:
     - Mk I, II and III for shield generators, engines and reactors, with stats and costs.
     - Start weapons limited to the simple ones.
   - Blueprints are sold by station type (see "Where blueprints are sold" in `docs/DESIGN.md`): research stations sell
     the Mk II/III reactors and engines, military stations the defence modules (shields included), trading posts sell
     none. Availability and price scale with danger tier.
   - Add the **research station** type: a generator layout from existing modules, rarer than trading posts, more common
     in calm space. Art later.
   - Tests:
     - Gating holds.
     - A blueprint bought deep can be built.
     - Saves keep the known set.
   - Art: a tier variant layer, or a tint, reusing the module art. The first art ask is a small variant pass.
2. **Faction and territory availability.**
   - Availability tables: some blueprints and items are only sold in certain faction territories or system types.
   - The starmap and the station inspector hint at notable stock ("Mk II shields here").
2b. **Pirate factions and the black market** (design in `docs/DESIGN.md`).
   - Sim: a faction relations table (pirates at war with each other too) and per-faction player standing; the truce rule
     (AI never starts a fight at a black market's node; a player who does is flagged and banned for a while, which means
     fired on sight).
   - Content: new pirate factions (raider clan, cartel, zealots, mercenaries) with doctrine, territory and ship templates
     built from existing donors; the black market station (a few named ones, plus black market services on some lawless
     stations); a contraband item tag; the fence, pirate weapon blueprints, shady hires and pirate-on-pirate jobs.
   - Art: liveries and the black market look as a later pack; placeholders reuse the Scrapper motif.
3. **Research module and projects.**
   - Sim:
     - A research module, buildable once its blueprint is known.
     - Research projects, each with its own materials cost and research time.
     - Crew do the research as a work category, through the job system.
     - Finished projects unlock blueprints.
   - UI: a research panel listing the projects, their costs, progress and what each unlocks.
   - Art: a research module, as a new art pack.
4. **Upgrade slots, weapons first.**
   - Some modules get slots. An upgrade is an item that changes module stats or behaviour; the first example is a
     nuclear warhead for the missile launcher.
   - Upgrades come from buying, finding or research, and the UI to slot them is in the module inspector.
   - Art: item icons. Some already exist, and more go in an item art top-up.
5. **Hull expansion at a station (shipyard refit).**
   - A shipyard service at certain stations: choose hull sections to add, pay credits and materials, dock, and the
     station builds them.
   - A bigger ship costs more fuel per jump (fuel cost scales with hull size).
   - Decide then whether the size cap comes from reactor or AI core tier.
6. **Construction pod and drones.**
   - Blueprints for building them; once built, the crew can expand the hull anywhere using materials.
7. **Implant tiers.** Tiered implants: bought, researched or found, and fitted at a medbay or station.
8. **Story missions.**
   - Self-contained arcs on the existing event and story system. The first start after `goals.done`.
   - Arcs can share factions, characters and places.

Later, not scheduled: building your own research station, full weapon tiers, recoverable failure, and tier scaling in
shipgen (generated ships fit Mk II and Mk III cores by depth and faction; see `docs/SHIPGEN.md`).

## Open questions, to settle at each phase

- **Phase 1:** the exact Mk II and Mk III stat curves, and whether blueprints are items (tradeable, lootable) or
  instant unlocks.
- **Phase 3:** research time versus crew skill: does a research skill make sense?
- **Phase 5:** which stations have shipyards, and how expansion is priced.
