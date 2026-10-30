import type { QueuedCommand } from './commands';
import type { Sector } from './combat/components';
import { World, type WorldData } from './ecs';
import { restoreTasks } from './ai/task';
import type { ContentRegistry } from './registry';
import { SectorGrid, type SectorGridData } from './sectorGrid';
import type { SectorArchive } from './sector/archive';
import { Sim } from './sim';
import { newStory, type StoryState } from './story/state';
import { loadGalaxy, saveGalaxy, type GalaxySave } from './galaxy/state';
import { newTrade, type TradeState } from './trade/types';
import { newYard, type YardState } from './yard/types';

/**
 * Current save format version. Bump it whenever the shape changes. Saves are not migrated (user decision, 2026-10-19:
 * this is a prototype): a save of any other version is refused and the game starts fresh.
 * v13 (sector grid step 2): the sector's tiles are one `SectorGrid` (`sector.grid`, chunks), `grids` keeps only each
 * grid's window rectangle.
 * v14 (step 8): vehicles keep position, heading and altitude in `BodyC`; `VehicleC.homeShip` and `hover` are ShipC ids;
 * `EvaFloatC.sx/sy` is the hatch point in sector tiles.
 * v15 (step 6, the coordinate flip): every component position (crew, paths, modules, jobs, items, ...) is a sector tile;
 * the shape is unchanged but the meaning is not, so v14 saves are refused.
 * v16 (step 7a): `ItemStack` drops `shipId` (the owning ship is read from the `ship` layer at the stack's tile).
 * v17/v18 (steps 7b, 7b2): module, job, drafted and position drop `shipId`.
 * v19 (step 7c): `Target.ship`, `Projectile.fromShip` and `CoreLink.ship` are ShipC entity ids (were grid ids).
 * v20 (step 7d): no grid windows. `grids` (the window rectangles) is gone from the save and `ShipC.gridId` with it: a ship is its
 * ShipC entity id and its rectangle is the ShipC x, y, width, height.
 * v22: cargo containers (`ContainerC`; a detached one is a free BodyC entity with its StorageC and no ModuleC).
 * v23: `ShipC.ruin` (a derelict's dressing data for the renderer: breach, decal and hook art, module art overrides).
 * v25 (step 9a): `sector.node`, `sector.state` ('active' | 'deploying') and `sector.packet` (the player's ship in transit while
 * deploying), plus `archives` (every sector the player left, frozen).
 * v26: stations (`ShipC.immobile`, `ShipC.dormant`, `StationC`, `StationAlarmC`, `StationCrewC`, `WantedC`) and the `patrol`
 * work category in every `PrioritiesC`.
 * v27 (galaxy): `galaxy` (the starmap state; its chunks are listed by key and regenerated from the seed, with the
 * `generatorVersion` they were made under, which must match).
 * v28 (asteroids slices 1-3; earlier numbered v26-v27 on the branch, never shipped): tile fields `ore` and `oreAmt`, struct kinds Rock and CoreRock, and `AsteroidC` regions that own
 * their rock tiles in the `ship` layer.
 *   Then: CoreRock is gone; struct 6 is rock Ground (walkable, airless foundation); `AsteroidC.coverage`
 * replaces `hollow` and `core`.
 * v29: raw ore items (`item.iron_ore`, `item.rare_ore`) and the 3x4 crafting `module.refinery`.
 * v30: one dormancy state: outposts are stamped `immobile` + `dormant` (like dens); `ShipC.outpost.provoked` and `outpost.provoked` are gone.
 * v31: asteroid outposts are real stations (`station.<kind>` outpost tier): crewed, with `StationC`, `StationAlarmC`, a trader and `ShipC.gen`.
 * v32: finished rock walls (Struct.RockWall) and no ore on big asteroids.
 * v33: `MiningPodC.spot` (where a pod hovers to cut its tile, clear of other pods).
 * v34 (base logistics, numbered in parallel with NPC traffic below): `FerryC` (base-logistics runs on shuttles) and `ShipC.outpost.dock` (the outpost's dock airlock).
 * v35 (logistics, likewise): `TransferC` (logistics orders), `SalvageWatchC`, `Ferry.transfer|loaded|left`.
 * v34 (NPC traffic): `galaxy.turnClock`, `galaxy.fleets`, `galaxy.encounters`, `galaxy.nextFleet`.
 * v35 (encounters): `galaxy.event` (the event grid, node id `event:<id>`), `Encounter.strength` / `danger`, `Travel.phase` 'interdicted' | 'event' and `Travel.held`.
 * v36 (stage 1 of the living world): `Combat.pilot` (the helm's piloting skill, for evade odds).
 * v37 (stage 2, persistent population): `galaxy.fleets` are persistent roster fleets (`home` port, `legs`, `synced`, ship `name` / `size`; `ttl` is gone), `galaxy.ports` (replacement queues of ports that lost ships),
 * `Encounter.name`, `EventGrid.fled`. Fleets are created when their chunk is generated and live until destroyed.
 * v38 (stage 3, NPC economy): `galaxy.markets` (port stock that differs from its baseline), `Fleet.cargo` / `Fleet.pick`, `Trader.port` / `Trader.base`
 * (a live station that is a port's market).
 * v39 (node population): `NodeState.populated` (the node's structures were made real; its archive owns them).
 * v40 (stage 4, off-screen life): `galaxy.news` / `galaxy.nextNews` (the bounded news log), `NodeState.wrecks` (ships destroyed in NPC fights, waiting to be found as wrecks).
 * v41: `Combat.cruisePilot` / `Combat.cruiseEvasion` (evade odds outside combat).
 * v42: base logistics and the living world in one save.
 * v43 (story events in transit): no `galaxy.pendingDraw`, no `story.periodicSec` / `nextPeriodic`, `Travel.phase` 'story' and `Travel.held` 'hopEnd'.
 * v44: `Combat.ftlOrder` (the standing `ftl.charge` order and its queued jump).
 * v45: construction hauling carries several item types per trip (bigger carry capacity, chained haul jobs).
 * v46: `powerPriority` rename, Refine/Craft work categories split.
 * v47: art/2x and dual art sets on top of v46: cargo containers are 2x4 and 3x6 (the art's sizes; were 2x3 and 3x5), new def ids, footprints and stock capacity; shipgen frames repacked; mining pod geometry.
 * v48 (danger layers): `GalaxyState.heat` (notoriety, last hunt per faction), `Fleet.hunt` / `standDown`, `Ship.killedBy` / `tallied`.
 * v49 (station jobs): `GalaxyState.jobs`, `jobLog`, `nextJob`.
 * v50 (goal chain): `StoryState.goals` (act, goals done, skipped, home cluster), `stat.*` story flags.
 * v51 (crew for hire): `GalaxyState.recruitLog`, `ForHireC` on station crew who can be hired, `Deal.crew` (a hiring run fetches them by
 *     shuttle).
 * v52 (fuel economy): `GalaxyState.distress` (a pending call for a tug), `item.fuel` in the market goods.
 * v53 (playtest fixes): optional `Module.wrecked` (set at 0 hp, cleared past half hp; a patched wreck is not announced twice).
 * v54 (blueprints): `StoryState.blueprints` (the bought module blueprints), Mk II / III core module defs, research stations.
 * v55 (shield tiers): `module.shieldGenSmall` removed (now `module.shieldGen`, 2x2); Mk II is 2x3, Mk III 3x3.
 * v56 (research): `ResearchC` (a ship's research queue), the `research` work category, the science skill and role.scientist.
 * v57 (tile aim): optional `Target.tile` (a blind aim at one tile of the target ship, on `CombatC.target` and `WeaponC.target`).
 * v58 (per-faction standing): reputation keys `meridian`, `helix`, `vantor` replace the shared `corp`; optional `Trader.owner` and `Ship.gen.owner` (the galaxy faction a trader or fleet ship belongs to).
 * v59 (shipyard): `yard` (hull-expansion orders), `YardCrewC` (the yard shuttle's crew), `Job.yard`, a ship's rectangle that grows with its hull.
 * v60: `HullPlanC` (a ship's planned outer hull), `Job.yardOnly`, `YardOrder.gaps` / `sealed` / `ejected`; the yard sells outer-profile hull tiles.
 * v62: the yard and per-faction standing together (the shipyard branch numbered v58 to v61 before standing took v58; this is the merged line).
 * v63 (pirate factions): new galaxy factions (`raiders`, `cartel`, `zealots`, `mercenaries`) with their own reputation keys, `Contact.hired`, `CoreRaiderC` / `CoreRaidC`, boarder flags `prefer` / `coreRaid`.
 * v64 (black markets): optional `Trader.services` / `Trader.fence`, `NodeState.truce` / `scanned`, `Encounter.scan`, `Ship.banned`, `ForHire.shady` (and `SkillXpC` on shady crew), contraband items (`item.stolen_goods`, `item.looted_goods`, `item.disruptor`, the zealot machine goods).
 * v65 (jobs by station): `GalaxyState.claims` (finished bounties and surveys waiting for hand-in), survey jobs (`StationJob.kind` 'survey', `station`, `feature`), `Deal.handover` (the station shuttle collecting a delivery crate).
 * v66 (combat heat): `Combat.heat` (heat meter, vent, lockout, overcharges), `WeaponDef.heat`, `ModuleDef.radiator`.
 * v67: `Combat.heat.auto` removed (the player's heat is never automatic).
 * v68 (bed owners, merged after combat heat): `BedOwnerC` (the bed a crew member owns and sleeps in).
 * v69 (trade): optional `Deal.getValue` (each get line's agreed share of the escrow, for settling a part-delivered run).
 */
export const SAVE_VERSION = 69;

/** The persisted shape. Content is never saved, only referenced by ID inside components. */
export interface SaveData {
  version: number;
  seed: number;
  tick: number;
  rng: number;
  world: WorldData;
  sector: Omit<Sector, 'grid'> & { grid: SectorGridData };
  /** Event system state. Optional: saves from before it existed load with a fresh one (no version bump needed). */
  story?: StoryState;
  /** Trade state. Optional like `story`: older saves load with an empty one. */
  trade?: TradeState;
  /** Shipyard orders. Optional like `trade`. */
  yard?: YardState;
  /** Starmap state, chunks as keys (see galaxy/state.ts). */
  galaxy: GalaxySave;
  pending: QueuedCommand[];
  /** Sectors the player left (see sector/archive.ts). */
  archives: SectorArchive[];
}

/** Serialize the sim to a JSON string. */
export function serialize(sim: Sim): string {
  const data: SaveData = {
    version: SAVE_VERSION,
    seed: sim.seed,
    tick: sim.tick,
    rng: sim.rng.getState(),
    world: sim.world.serialize(),
    sector: { ...sim.sector, grid: sim.sector.grid.serialize() },
    story: sim.story,
    trade: sim.trade,
    yard: sim.yard,
    galaxy: saveGalaxy(sim.galaxy),
    pending: [...sim.commands.getPending()],
    archives: sim.archives,
  };
  return JSON.stringify(data);
}

/** Check raw save data is of SAVE_VERSION. Older and newer saves are refused: there are no migrations. */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const version = raw['version'];
  if (version !== SAVE_VERSION) throw new Error(`Save version ${String(version)} is not ${SAVE_VERSION}; old saves are not migrated`);
  return raw;
}

/** Rebuild a Sim from a JSON save. Throws on a save of another version. */
export function deserialize(json: string, content: ContentRegistry): Sim {
  const data = migrate(JSON.parse(json) as Record<string, unknown>) as unknown as SaveData;
  const sim = new Sim(data.seed, content);
  sim.tick = data.tick;
  sim.rng.setState(data.rng);
  sim.world = World.deserialize(data.world);
  sim.sector = { ...data.sector, grid: SectorGrid.deserialize(0, data.sector.grid) };
  sim.story = { ...newStory(data.seed), ...data.story };
  sim.trade = { ...newTrade(), ...data.trade };
  sim.yard = { ...newYard(), ...data.yard };
  sim.galaxy = loadGalaxy(sim, data.galaxy);
  sim.commands.setPending(data.pending);
  sim.archives = data.archives;
  restoreTasks(sim); // a save from before the crew-AI task mirror (Phase 1) has none
  return sim;
}
