# Plan: the far galaxy keeps living (#604)

User decisions (2026-11-21, #604 comment): stations can change owner and borders move on the map; change is slow and steady, never
drastic between looks, cheap to run; the player learns of it through expanded starmap news, territory colours, how a station looks on
arrival, and "since you were last here" lines in the station hail. Rule (2026-11-21): one system per mechanic, used by player and NPCs alike.

## Today (main at 70d7c34)

- Ownership is a pure function of the seed. `TerritoryField.factionAt` (galaxy/territory.ts) gives the faction at a map point. A sector's
  faction is read once at build (`buildSector`, sector.ts:131) and its structures' owners from it; clusters do the same (clusters.ts:110).
  Chunks are saved as keys and rebuilt from the seed on load, so nothing can change an owner today.
- About 56 places in galaxy/app/ui/render read `.faction` of a sector, cluster or node directly, and about 79 read `.owner`.
- Wars are a static table (`content/galaxyRelations.ts`, read through `galaxy/relations.ts`).
- Fleets live only within 9 hops (fleets.ts). Off-screen clashes (meetings.ts, clash.ts) leave news, wrecks, loot and port
  replacement queues (`PortState.queue`, which already carries the faction of each owed ship). Nothing outside the area moves.
- News: `NewsItem` kinds destroyed, driven, clash, raid, cut, loot, shortage, rebuilt, hunt; NEWS_MAX 40.

## Design

### The unit: the sector

A sector (6-12 nodes around a body) is the unit that changes hands. Small enough that borders visibly move, big enough that a flip is an event.
Clusters keep their generated identity (name, type) and are not owned in the sim; the starmap colours sectors.

### Saved state: only what differs

`GalaxyState.control: Record<sectorId, SectorControl>`, entries only for sectors that differ from their generated state:

    SectorControl { owner: string | null; since: number;        // owner now, turn it changed
                    pressure?: { by: string; value: number; ticks: number };  // an enemy pushing on it
                    scarred?: number }                           // turn until which it shows battle damage

Bounded by the generated (explored) sectors, so save size stays small. No entry = the generated owner, no pressure.

### One answer: who owns this

- `sectorOwner(sim, sectorId)`: `control[id]?.owner` else the generated faction.
- `structureOwner(sim, structure)`: a station owned by the sector's original faction follows the sector's owner; neutral, derelict and
  black-market structures keep theirs.
- Every reader of a sector/node/structure faction goes through these (the 56 + owner reads that mean territory). This is a mechanical
  refactor and the bulk of slice 1's diff.

### The coarse tick

Runs every `COARSE_TURNS` turns (proposed 8: about 24 minutes at 1x, or 8 jumps), over generated sectors only. All rolls are hashed on
(seed, sector, coarse tick index): no Rng, and no catch-up needed, since it runs everywhere every time (cheap: O(fronts)).

1. **Fronts:** pairs of sectors joined by a lane whose owners are at war (`relations.ts`).
2. **Strength:** a faction's strength at a front = its sectors within a few lanes, weighted by ports and danger, minus what its ports
   still owe (`PortState.queue`, so losses near the player count). Pirates fight with a raid factor, not a hold factor (they raid but rarely hold).
3. **Pressure:** the stronger side adds pressure to the weaker sector, with a hashed swing. Pressure decays when the push stops.
4. **Flip with hysteresis:** a sector changes hands only after pressure stays over the threshold for `FLIP_TICKS` coarse ticks in a row
   (proposed 3). At most `FLIPS_PER_TICK` (proposed 1) galaxy-wide, strongest pressure first. So nothing changes between two quick looks,
   and the earliest any flip lands is about 70 minutes of play after a front opens.
5. **Protected:** the start sector and each cluster's hub never flip; a faction never loses its last few sectors (no eliminations).
6. **News without fleets:** outside the fleet area the tick posts summary news at a low rate ("fighting along the Kessa border",
   "Vigil Reach fell to the Scrap Clans"). Inside the area the fine tier already posts the real clashes.

### Handover between the tiers

- **Fine feeds coarse:** real outcomes in the fleet area (meetings, #609's engagements, raids, the player's own fights and joined
  sides) add pressure on that sector through the same `addPressure`. So the player's choices move borders near them.
- **Coarse feeds fine:** when a sector flips, its stations' ports switch owner (`structureOwner`), their old fleets go home elsewhere or
  are dropped when frozen, and the port queues the new owner's role mix through the existing rebuild path (`PortState.queue` with the new
  faction). Fleets then appear as they are built: no snap, no spawn.
- Markets: a flipped station sells the new owner's stock profile (it already reads the owner faction; via `structureOwner`).

### How the player finds out

- **Starmap colours** come from `sectorOwner`, so borders move with no extra work. A sector under pressure gets a contested look
  (a hatched or pulsing border). Visual: mock first.
- **News:** new kinds `front`, `fell`, `held`; the starmap news list grows filters (near / far / mine), grouping by place, click to
  locate. New UI layout: static mock sheet first (orchestrator builds it).
- **Station hail:** "since you were last here" lines built from the news items about that sector or cluster since `visited[node]`,
  spoken in the owner's voice. A station that changed hands says so first.
- **Station look on arrival:** the new owner's livery (tint) and, while `scarred`, battle damage: lightly pre-damaged modules and hull,
  reusing the derelict generator's ruin pass at a low level. Visual: screenshots for approval.

## Slices (two or three PRs)

1. **Ownership and the coarse tick (sim).** `control` state, `sectorOwner`/`structureOwner` and the refactor of every reader, fronts,
   pressure, flips with hysteresis and caps, fine-tier pressure feed, port switch and queues, news kinds, `SAVE_VERSION` bump.
   Starmap colours follow for free. Tests: determinism and save round trip, no flip before FLIP_TICKS, cap holds, protected sectors,
   a flipped port rebuilds the new owner's fleets. Profile the tick on a long run with many generated chunks.
2. **Showing it (UI and visuals).** News list (mock first), contested border look, hail dialogue, station livery and scars. Screenshots
   for approval.
3. **Optional: war economy.** Front and siege conditions that move market baselines (war goods dear, food short), booms after a peace.
   Could fold into 1 if small.

## Decided (user, 2026-11-22, #604 comment)

1. The sector is the unit that changes hands, not the whole cluster.
2. Pace: coarse tick every 8 turns, 3 ticks of sustained pressure to flip, 1 flip galaxy-wide per tick.
3. Protected: the start sector and cluster hubs never flip; no faction is wiped out.
4. The player's fights and joined sides near a border push it.
5. Faction stations follow their sector; black markets, neutral traders and derelicts keep their owner.
6. The war table stays fixed for slice 1; peace and new wars are a later issue.

## Slice 1 as built

- Names: `NodeData.faction`, `SectorData.faction` and `StructureRef.owner` became `genFaction` / `genFaction` / `genOwner` (the generated value), so the compiler
  finds every reader; readers ask `sectorOwner(sim, sectorId)`, `nodeOwner(sim, node)`, `nodeOwnerAt(sim, nodeId)` or `structureOwner(sim, node, structure)` (`galaxy/control.ts`).
- `structureOwner` takes the node as well as the structure (a `StructureRef` does not know its sector).
- Ports (`portsOf`) read the current owner; the cluster blob on the starmap takes its colour from the faction holding most of its sectors.
- Coarse tick: `galaxy/coarse.ts` (fronts, strength, pressure, flips), `galaxy/flip.ts` (the handover to the fine tier), `galaxy/pressure.ts` (`addPressure`,
  `fightPressure`), tuning in `galaxy/tuningCoarse.ts`. It runs from `onTurn` after `stepFleets`.
- Not in slice 1: a station already made real (its node visited) keeps its kind and look until slice 2 (livery, scars); the player's own fights do not feed
  pressure yet (only fleet meetings do).

## Review round (user, 2026-11-22: "go ahead with sensible defaults")

- Expansion into unowned space through the same pressure (no defender but `UNOWNED_DEFENCE`; pirates and the rogue AI do not settle).
- The player's kills and captures push the sector's borders (`playerFightPressure`).
- Pace retuned: `PUSH_RATE` 1.2, `EXPAND_RATE` 1, `DEFENDER_EDGE` 1.0, `FLIPS_PER_TICK` 6 with `FLIP_SPACING` 6 lanes (replaces the galaxy-wide cap of 1, which the sparse fronts never reached anyway). The asked pace of one change per 2 to 3 hours inside the 9-hop region would need about 300 flips per 100 ticks galaxy-wide (a region is about 5% of the map), a map replaced every 27 hours; the default is 1.5 to 4 per 100 ticks in a region (one per 10 to 25 hours), with no two changes in one region at once.
