import { CombatC, FTL_CHARGE_SEC, playerShip, AllegianceC, NeedsC, MoodC, AssignmentC, CrewC, JobC, SuitC, suitAir, DownedC, ModuleC, SurrenderedC, PositionC, ShipC, Struct, accessTile, removeModule, spawnModule, placementError, vehicleViews, cargoAdd, spawnShip, type Faction, type Sim } from '../sim';
import type { Renderer } from '../render/scene';
import { shipIdOf, shipGrid } from '../sim/regions';
import { AlienC, EggSacC } from '../sim/aliens/components';
import { DeadC } from '../sim/crew/components';

/**
 * Debug/tooling hook, only installed with `?hook` in the URL: lets headless scripts find screen positions of tiles and
 * modules and read the events the sim emitted. Read-only; it never touches the sim.
 */
export function installDebugHook(sim: Sim, r: Renderer): { onEvents(types: readonly string[]): void } {
  const seen: string[] = [];
  (window as unknown as { __cc: unknown }).__cc = {
    screenOf: (shipId: number, x: number, y: number) => r.screenOf(shipId, x, y),
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
      /** Set a suit's tank (the air-warning shot). */
      suitAir: (crew: number, sec: number) => { const su = sim.world.get(crew, SuitC); if (su) su.air = sec; },
      /** Set a crew member's hunger (0..100) and optionally rest (the needs shots). */
      needs: (crew: number, hunger: number, rest?: number) => { const n = sim.world.get(crew, NeedsC); if (n) { n.hunger = hunger; if (rest !== undefined) n.rest = rest; } },
      /** Fill the player's FTL drive (a fresh game has no pilot at the helm to charge it). */
      chargeFtl: () => { const c = sim.world.get(playerShip(sim), CombatC); if (c) c.ftl = FTL_CHARGE_SEC; },
      /** Mood readout. */
      mood: (crew: number) => sim.world.get(crew, MoodC) ?? null,
    },
    dispatch: (cmd: Parameters<Sim['enqueue']>[0]) => sim.enqueue(cmd),
    /** Events: start one by id (ignores triggers and eligibility), set a flag, set the pool context. */
    fireEvent: (event: string) => sim.enqueue({ type: 'story.fire', event }),
    setFlag: (flag: string, value = 1) => sim.enqueue({ type: 'story.setFlag', flag, value }),
    setContext: (danger: number, faction: string | null = null) => sim.enqueue({ type: 'story.setContext', danger, faction }),
    story: () => sim.story,
    vehicles: () => vehicleViews(sim),
    ships: () => [...sim.world.query(ShipC)].map((id) => sim.world.get(id, ShipC)),
    events: () => seen,
  };
  return { onEvents: (types) => void seen.push(...types) };
}
