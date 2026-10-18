import { AllegianceC, CrewC, ModuleC, PositionC, ShipC, accessTile, type Sim } from '../sim';
import type { Renderer } from '../render/scene';

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
      const out: { gridId: number; x: number; y: number; ax: number; ay: number }[] = [];
      for (const id of sim.world.query(ModuleC)) {
        const m = sim.world.get(id, ModuleC);
        const d = m && sim.content.modules[m.def];
        if (!m || !d || m.def !== def) continue;
        const a = accessTile(d, m.x, m.y, m.rot) ?? { x: m.x, y: m.y };
        out.push({ gridId: m.gridId, x: m.x, y: m.y, ax: a.x, ay: a.y });
      }
      return out;
    },
    /** Crew on grids, with their side and the screen position of their feet. */
    crew: () =>
      [...sim.world.query(CrewC, PositionC)].map((id) => {
        const p = sim.world.get(id, PositionC);
        return p && { id, enemy: sim.world.get(id, AllegianceC)?.faction !== 'player', gridId: p.gridId, ...r.screenOf(p.gridId, p.x, p.y) };
      }),
    ships: () => [...sim.world.query(ShipC)].map((id) => sim.world.get(id, ShipC)),
    events: () => seen,
  };
  return { onEvents: (types) => void seen.push(...types) };
}
