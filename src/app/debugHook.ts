import { AllegianceC, NeedsC, MoodC, AssignmentC, CrewC, JobC, SuitC, suitAir, DownedC, ModuleC, SurrenderedC, PositionC, ShipC, accessTile, removeModule, spawnModule, placementError, vehicleViews, cargoAdd, spawnShip, type Faction, type Sim } from '../sim';
import type { Renderer } from '../render/scene';
import { gridIdOf } from '../sim/regions';

/**
 * Debug/tooling hook, only installed with `?hook` in the URL: lets headless scripts find screen positions of tiles and
 * modules and read the events the sim emitted. Read-only; it never touches the sim.
 */
export function installDebugHook(sim: Sim, r: Renderer): { onEvents(types: readonly string[]): void } {
  const seen: string[] = [];
  (window as unknown as { __cc: unknown }).__cc = {
    screenOf: (gridId: number, x: number, y: number) => r.screenOf(gridId, x, y),
    /** Modules of a def: grid, origin and access tile. */
    modules(def: string) {
      const out: { id: number; gridId: number; x: number; y: number; ax: number; ay: number }[] = [];
      for (const id of sim.world.query(ModuleC)) {
        const m = sim.world.get(id, ModuleC);
        const d = m && sim.content.modules[m.def];
        if (!m || !d || m.def !== def) continue;
        const a = accessTile(d, m.x, m.y, m.rot) ?? { x: m.x, y: m.y };
        out.push({ id, gridId: gridIdOf(sim, m), x: m.x, y: m.y, ax: a.x, ay: a.y });
      }
      return out;
    },
    /** Crew on grids, with their side and the screen position of their feet. */
    crew: () =>
      [...sim.world.query(CrewC, PositionC)].map((id) => {
        const p = sim.world.get(id, PositionC);
        return p && { id, enemy: sim.world.get(id, AllegianceC)?.faction !== 'player', down: sim.world.has(id, DownedC) || sim.world.has(id, SurrenderedC), gridId: gridIdOf(sim, p), ...r.screenOf(gridIdOf(sim, p), p.x, p.y) };
      }),
    /** Name, role and suit tank of a crew member (the component keys are not reachable from a page script). */
    crewInfo(id: number) {
      const a = sim.world.get(id, AssignmentC);
      const job = a && sim.world.get(a.jobId, JobC);
      const p = sim.world.get(id, PositionC);
      return {
        name: sim.world.get(id, CrewC)?.name, role: sim.world.get(id, CrewC)?.role, suited: sim.world.has(id, SuitC), air: suitAir(sim, id),
        gridId: p ? gridIdOf(sim, p) : undefined, x: p?.x, y: p?.y, job: job ? `${job.kind} ${Math.round((job.progress / Math.max(1, job.work)) * 100)}%` : null,
      };
    },
    /** Queue a sim command (debug commands included) from a script. */
    /** The sim itself, so scripts can stage states no command reaches (docked shuttle with cargo). Debug only. */
    sim,
    /** Scenery for screenshots: spawn (no placement checks beyond the error returned) or remove a module. */
    stage: {
      spawn: (gridId: number, def: string, x: number, y: number, rot: number) => placementError(sim, gridId, def, x, y, rot) ?? spawnModule(sim, gridId, def, x, y, rot),
      remove: (id: number) => removeModule(sim, id),
      cargo: (vehicle: number, item: string, n: number) => cargoAdd(sim, vehicle, item, n),
      /** Spawn a whole ship from a content template at sector (x, y) (staging a neutral target for shuttle EVA shots); returns its grid id. */
      ship: (template: string, faction: Faction, x: number, y: number) => spawnShip(sim, sim.content.ships[template] as never, { faction, x, y }),
      /** Set a suit's tank (the air-warning shot). */
      suitAir: (crew: number, sec: number) => { const su = sim.world.get(crew, SuitC); if (su) su.air = sec; },
      /** Set a crew member's hunger (0..100) and optionally rest (the needs shots). */
      needs: (crew: number, hunger: number, rest?: number) => { const n = sim.world.get(crew, NeedsC); if (n) { n.hunger = hunger; if (rest !== undefined) n.rest = rest; } },
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
