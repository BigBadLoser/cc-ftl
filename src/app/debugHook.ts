import { StorageC, storageTake, totalStock, siteIds, siteStatus, CombatC, WeaponC, FTL_CHARGE_SEC, playerShip, AllegianceC, NeedsC, MoodC, AssignmentC, CrewC, JobC, SuitC, suitAir, DownedC, ModuleC, SurrenderedC, PositionC, ShipC, Struct, accessTile, removeModule, spawnModule, spawnVehicle, placementError, vehicleViews, cargoAdd, spawnShip, VehicleC, BodyC, type Faction, type Sim } from '../sim';
import type { Renderer } from '../render/scene';
import { shipIdAt, shipIdOf, shipGrid } from '../sim/regions';
import { ItemStackC } from '../sim/items/components';
import { AlienC, EggSacC } from '../sim/aliens/components';
import { DeadC } from '../sim/crew/components';
import { StationAlarmC, StationC } from '../sim/stations/components';
import { AsteroidC } from '../sim/asteroids/components';
import { addHeat } from '../sim/combat/heat';
import { explainAll, explainCrew } from '../sim/ai/explain';
import { auditReservations } from '../sim/ai/audit';
import { parkCrew } from './parkCrew';

/**
 * Debug/tooling hook, only installed with `?hook` in the URL: lets headless scripts find screen positions of tiles and
 * modules and read the events the sim emitted. Read-only; it never touches the sim.
 */
export function installDebugHook(sim: Sim, r: Renderer): { onEvents(types: readonly string[]): void } {
  const seen: string[] = [];
  (window as unknown as { __cc: unknown }).__cc = {
    screenOf: (shipId: number, x: number, y: number) => r.screenOf(shipId, x, y),
    /** Show or hide the space backdrop (screenshot scripts cut ships out against a flat background). */
    backdrop: (on: boolean) => r.showBackdrop(on),
    /** Centre the camera on a sector position in tiles (screenshot scripts). */
    focus: (x: number, y: number) => r.focusSector(x, y),
    /** Step the camera to the zoom level nearest `z` (screenshot scripts); returns the zoom reached. */
    zoomTo(z: number) {
      for (let i = 0; i < 30; i++) {
        const cur = r.info().zoom;
        if (Math.abs(cur - z) < 1e-6) break;
        r.zoomAt(cur < z ? 1.2 : 1 / 1.2, innerWidth / 2, innerHeight / 2);
        if (r.info().zoom === cur) break;
      }
      return r.info().zoom;
    },
    /** Committed enemy aims (the incoming-fire telegraph): weapon module, target ship, aim area and charge. */
    commits: () => [...sim.world.query(WeaponC)].flatMap((id) => {
      const w = sim.world.get(id, WeaponC);
      return w?.commit ? [{ id, ship: w.commit.target.ship, x: w.commit.x, y: w.commit.y, w: w.commit.w, h: w.commit.h, charge: w.charge }] : [];
    }),
    /** Sheet streaming: decoded bytes resident (total and per pool), requests, pending, scene rebuilds. */
    art: () => r.art(),
    /** Crew AI inspector (docs/CREW_AI.md section 11, first cut): a crew member's drive, interrupt, task state path and holds; `dump` for all. */
    ai: {
      crew: (id: number) => explainCrew(sim, id),
      dump: () => ({ crew: explainAll(sim), audit: auditReservations(sim), log: sim.aiLog }),
    },
    /** Trade and handover deals: phase, shuttle state and position, airlock. */
    deals: () => sim.trade.deals.map((d) => {
      const v = d.vehicle ? sim.world.get(d.vehicle, VehicleC) : undefined;
      const b = d.vehicle ? sim.world.get(d.vehicle, BodyC) : undefined;
      return { id: d.id, phase: d.phase, reason: d.reason ?? null, handover: d.handover?.job ?? null, airlock: d.airlock, vehicle: d.vehicle, state: v?.state ?? null, cargo: v?.cargo ?? null, x: b?.x ?? null, y: b?.y ?? null };
    }),
    /** Loose floor stacks: item, count, tile and ship (a delivery crate carries its job id). */
    stacks: () => sim.world.query(ItemStackC).flatMap((id) => {
      const s = sim.world.get(id, ItemStackC);
      return s ? [{ id, item: s.item, count: s.count, x: s.x, y: s.y, ship: shipIdAt(sim, s.x, s.y), job: s.job ?? null }] : [];
    }),
    /** Modules of a def: grid, origin and access tile. */
    modules(def: string) {
      const out: { id: number; shipId: number; ship: number; x: number; y: number; ax: number; ay: number }[] = [];
      for (const id of sim.world.query(ModuleC)) {
        const m = sim.world.get(id, ModuleC);
        const d = m && sim.content.modules[m.def];
        if (!m || !d || m.def !== def) continue;
        const a = accessTile(d, m.x, m.y, m.rot) ?? { x: m.x, y: m.y };
        out.push({ id, shipId: shipIdOf(sim, m), ship: shipIdOf(sim, m), x: m.x, y: m.y, ax: a.x, ay: a.y });
      }
      return out;
    },
    /** Burning tiles of a ship, and the floor tiles that touch open space (damage-control screenshots). */
    hazards(shipId: number) {
      const grid = shipGrid(sim, shipId);
      const fires: { x: number; y: number }[] = [];
      const breaches: { x: number; y: number }[] = [];
      if (grid)
        for (let y = grid.y0; y < grid.y0 + grid.height; y++)
          for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
            if (grid.get('fire', x, y) > 0) fires.push({ x, y });
            if (grid.get('room', x, y) && ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => grid.inBounds(x + dx, y + dy) && grid.get('struct', x + dx, y + dy) === Struct.Space)) breaches.push({ x, y });
          }
      return { fires, breaches };
    },
    /** A ship's modules with their power state and hp, and its ruin dressing counts (for derelict checks). */
    wreck(shipId: number) {
      const ruin = sim.world.get(shipId, ShipC)?.ruin;
      const mods = [...sim.world.query(ModuleC)].flatMap((id) => {
        const m = sim.world.get(id, ModuleC);
        return m && shipIdOf(sim, m) === shipId ? [{ def: m.def, x: m.x, y: m.y, enabled: m.enabled, powered: m.powered, hp: m.hp }] : [];
      });
      const ship = sim.world.get(shipId, ShipC);
      const grid = shipGrid(sim, shipId);
      const jammed: { x: number; y: number; jam: number; near: { x: number; y: number } | null }[] = [];
      if (grid)
        for (let y = grid.y0; y < grid.y0 + grid.height; y++)
          for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
            const jam = grid.get('jam', x, y);
            if (!jam || grid.get('struct', x, y) !== Struct.Door) continue;
            const near = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => ({ x: x + dx, y: y + dy })).find((t) => grid.get('struct', t.x, t.y) === Struct.Floor && !grid.get('module', t.x, t.y));
            jammed.push({ x, y, jam, near: near ?? null });
          }
      return { jammed, origin: ship && { x: ship.x, y: ship.y }, ruin: ruin && { cause: ruin.cause, impacts: ruin.impacts, breaches: ruin.breaches.length, decals: ruin.decals.length, hooks: ruin.hooks.length, modules: ruin.modules }, mods };
    },
    /** Crew on grids, with their side and the screen position of their feet. */
    crew: () =>
      [...sim.world.query(CrewC, PositionC)].map((id) => {
        const p = sim.world.get(id, PositionC);
        return p && { id, enemy: sim.world.get(id, AllegianceC)?.faction !== 'player', down: sim.world.has(id, DownedC) || sim.world.has(id, SurrenderedC), shipId: shipIdOf(sim, p), ship: shipIdOf(sim, p), ...r.screenOf(shipIdOf(sim, p), p.x, p.y) };
      }),
    /** Name, role and suit tank of a crew member (the component keys are not reachable from a page script). */
    crewInfo(id: number) {
      const a = sim.world.get(id, AssignmentC);
      const job = a && sim.world.get(a.jobId, JobC);
      const p = sim.world.get(id, PositionC);
      return {
        name: sim.world.get(id, CrewC)?.name, role: sim.world.get(id, CrewC)?.role, suited: sim.world.has(id, SuitC), air: suitAir(sim, id),
        shipId: p ? shipIdOf(sim, p) : undefined, x: p?.x, y: p?.y, job: job ? `${job.kind} ${Math.round((job.progress / Math.max(1, job.work)) * 100)}%` : null,
      };
    },
    /** Egg sacs on a ship (state, stage, hp) and the aliens on it, for derelict scripts. */
    aliens(shipId: number) {
      const sacs = sim.world.query(EggSacC).flatMap((id) => {
        const s = sim.world.get(id, EggSacC);
        return s && s.ship === shipId ? [{ id, x: s.x, y: s.y, size: s.size, state: s.state, stage: s.stage, hp: s.hp, leaking: s.leaking }] : [];
      });
      const aliens = sim.world.query(AlienC, PositionC).flatMap((id) => {
        const p = sim.world.get(id, PositionC);
        return p && shipIdOf(sim, p) === shipId ? [{ id, role: sim.world.get(id, CrewC)?.role, x: p.x, y: p.y, dead: sim.world.has(id, DeadC) }] : [];
      });
      return { sacs, aliens };
    },
    /** Everything standing in the sector: ships (stations, wrecks, NPCs) and asteroids, with their rectangles in sector tiles (screenshot scripts). */
    structures: () => ({
      ships: [...sim.world.query(ShipC)].map((id) => {
        const s = sim.world.get(id, ShipC);
        return s && { id, name: s.name, faction: s.faction, state: s.state, x: s.x, y: s.y, w: s.width, h: s.height, immobile: !!s.immobile, outpost: s.outpost?.kind ?? null };
      }),
      asteroids: [...sim.world.query(AsteroidC)].map((id) => {
        const a = sim.world.get(id, AsteroidC);
        return a && { id, kind: a.kind, x: a.x, y: a.y, w: a.width, h: a.height };
      }),
      sector: { w: sim.sector.width, h: sim.sector.height, node: sim.sector.node },
    }),
    /** Queue a sim command (debug commands included) from a script. */
    /** The sim itself, so scripts can stage states no command reaches (docked shuttle with cargo). Debug only. */
    sim,
    /** Scenery for screenshots: spawn (no placement checks beyond the error returned) or remove a module. */
    stage: {
      spawn: (shipId: number, def: string, x: number, y: number, rot: number) => placementError(sim, shipId, def, x, y, rot) ?? spawnModule(sim, def, x, y, rot),
      remove: (id: number) => removeModule(sim, id),
      cargo: (vehicle: number, item: string, n: number) => cargoAdd(sim, vehicle, item, n),
      /** Spawn a whole ship from a content template at sector (x, y) (staging a neutral target for shuttle EVA shots); returns its grid id. */
      ship: (template: string, faction: Faction, x: number, y: number) => spawnShip(sim, sim.content.ships[template] as never, { faction, x, y }),
      /** Make every crew member aboard a ship (the player's own excluded) surrender: the "enemy given up" shot. */
      surrenderCrew: (shipId: number) => { for (const id of sim.world.query(CrewC, PositionC)) if (shipIdOf(sim, sim.world.get(id, PositionC) as never) === shipId && sim.world.get(id, AllegianceC)?.faction !== 'player' && !sim.world.has(id, SurrenderedC)) sim.world.add(id, SurrenderedC, { tick: sim.tick }); },
      /** Put a vehicle (e.g. 'vehicle.mining_pod') in an empty bay module; returns its id (the mining shots). */
      vehicle: (def: string, bay: number) => spawnVehicle(sim, def, bay),
      /** Set the progress of every module construction site to a share of its work (the ghost shots). */
      siteProgress: (frac: number) => { for (const id of sim.world.query(JobC)) { const j = sim.world.get(id, JobC); if (j?.kind === 'module') j.progress = Math.round(j.work * frac); } },
      /** Put every player crew member on a tile and drop their orders (keeps crew out of the ghost shots). */
      parkCrew: (x: number, y: number) => parkCrew(sim, x, y),
      /** Take stored `item` out of every storage until `keep` units are left (the "missing materials" shot). */
      drainStock: (item: string, keep: number) => { for (const id of sim.world.query(StorageC)) { const extra = totalStock(sim, item) - keep; if (extra > 0) storageTake(sim, id, item, extra); } },
      /** Set a suit's tank (the air-warning shot). */
      suitAir: (crew: number, sec: number) => { const su = sim.world.get(crew, SuitC); if (su) su.air = sec; },
      /** Set a crew member's hunger (0..100) and optionally rest (the needs shots). */
      needs: (crew: number, hunger: number, rest?: number) => { const n = sim.world.get(crew, NeedsC); if (n) { n.hunger = hunger; if (rest !== undefined) n.rest = rest; } },
      /** Fill the player's FTL drive (a fresh game has no pilot at the helm to charge it). */
      chargeFtl: () => { const c = sim.world.get(playerShip(sim), CombatC); if (c) c.ftl = FTL_CHARGE_SEC; },
      /** Set a ship's integrity 0..1 (screenshots: a battered enemy). */
    setIntegrity: (ship: number, v: number) => { const sc = sim.world.get(ship, ShipC); if (sc) sc.integrity = v; },
    /** Add combat heat to a ship (screenshots: force an overheat). */
    addHeat: (ship: number, amount: number) => addHeat(sim, ship, amount),
    /** Mood readout. */
      mood: (crew: number) => sim.world.get(crew, MoodC) ?? null,
    },
    /** Module construction sites with their status (progress, materials, block). */
    sites: () => siteIds(sim).map((id) => siteStatus(sim, id)),
    dispatch: (cmd: Parameters<Sim['enqueue']>[0]) => sim.enqueue(cmd),
    /** Events: start one by id (ignores triggers and eligibility), set a flag, set the pool context. */
    fireEvent: (event: string) => sim.enqueue({ type: 'story.fire', event }),
    setFlag: (flag: string, value = 1) => sim.enqueue({ type: 'story.setFlag', flag, value }),
    setContext: (danger: number, faction: string | null = null) => sim.enqueue({ type: 'story.setContext', danger, faction }),
    /** Set the player's notoriety (wanted from 10). */
    notoriety: (value: number) => sim.enqueue({ type: 'debug.notoriety', value }),
    story: () => sim.story,
    vehicles: () => vehicleViews(sim),
    ships: () => [...sim.world.query(ShipC)].map((id) => sim.world.get(id, ShipC)),
    /** Ship ids with their components (stations: `immobile`), the trade state, and a camera frame for screenshots. */
    shipList: () => [...sim.world.query(ShipC)].map((id) => ({ id, ...sim.world.get(id, ShipC) })),
    trade: () => sim.trade,
    /** A station's courts and patrol stops, and its alarm. */
    station: (id: number) => ({ ...sim.world.get(id, StationC), alarm: sim.world.get(id, StationAlarmC) }),
    frame: (ids: number[]) => r.frameShips(ids),
    events: () => seen,
  };
  return { onEvents: (types) => void seen.push(...types) };
}
