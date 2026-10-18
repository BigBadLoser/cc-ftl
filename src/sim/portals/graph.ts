import { ModuleC } from '../modules/components';
import { isTileWalkable } from '../modules/walk';
import type { Sim } from '../sim';
import { airlockDoorAt, airlockWorking } from './airlock';
import { PortalC, SuitC, type Portal, type PortalEnd, type PortalKind } from './components';

/** Default planner weight and traversal time of a portal kind. */
export const PORTAL_DEFAULTS: Record<PortalKind, { cost: number; ticks: number }> = {
  airlock: { cost: 30, ticks: 20 },
  dock: { cost: 20, ticks: 10 },
  eva: { cost: 120, ticks: 80 },
  teleporter: { cost: 10, ticks: 20 },
};

/** Create a portal entity. Assumes validation (see portalError). */
export function createPortal(sim: Sim, portal: Portal): number {
  const id = sim.world.createEntity();
  sim.world.add(id, PortalC, portal);
  return id;
}

/** Remove a portal entity (a crew member mid-traversal stays put, see portalSystem). */
export function removePortal(sim: Sim, id: number): boolean {
  if (!sim.world.has(id, PortalC)) return false;
  sim.world.destroyEntity(id);
  return true;
}

/** Remove every portal that ends at an airlock module (the module was removed). */
export function removePortalsOfAirlock(sim: Sim, moduleId: number): void {
  for (const id of sim.world.query(PortalC)) {
    const p = sim.world.get(id, PortalC) as Portal;
    if (p.a.airlock === moduleId || p.b.airlock === moduleId) sim.world.destroyEntity(id);
  }
}

/** Why a portal between these ends cannot be made, or null. Fills in `airlock` on ends that are airlock outer doors. */
export function portalError(sim: Sim, kind: PortalKind, a: PortalEnd, b: PortalEnd): string | null {
  if (a.gridId === b.gridId && a.x === b.x && a.y === b.y) return 'sameTile';
  for (const e of [a, b]) {
    const grid = sim.grids.get(e.gridId);
    if (!grid?.has('struct')) return 'badGrid';
    if (!grid.inBounds(e.x, e.y)) return 'outOfBounds';
    if (!isTileWalkable(sim, grid, e.x, e.y)) return 'notWalkable';
    const door = airlockDoorAt(sim, grid, e.x, e.y);
    if (door) {
      if (door.door !== 'outer') return 'notOuterDoor';
      e.airlock = door.id;
    } else if (kind === 'airlock') return 'notAirlock';
  }
  for (const id of sim.world.query(PortalC)) {
    const p = sim.world.get(id, PortalC) as Portal;
    if (sameEnd(p.a, a) && sameEnd(p.b, b)) return 'exists';
    if (sameEnd(p.a, b) && sameEnd(p.b, a)) return 'exists';
  }
  return null;
}

function sameEnd(p: PortalEnd, q: PortalEnd): boolean {
  return p.gridId === q.gridId && p.x === q.x && p.y === q.y;
}

/** Every portal entity, ascending id. */
export function allPortals(sim: Sim): readonly number[] {
  return sim.world.query(PortalC);
}

/**
 * Whether `crew` could use the portal right now, ignoring the airlock cycle (a crossing waits for that). Checks the
 * airlock ends are working and the portal's own requirements. `crew` 0 means nobody (suit checks fail).
 */
export function portalUsable(sim: Sim, portal: Portal, crew: number): boolean {
  for (const e of [portal.a, portal.b]) {
    if (!sim.grids.has(e.gridId)) return false;
    if (e.airlock !== undefined && !airlockWorking(sim, e.airlock)) return false;
  }
  for (const r of portal.requires) {
    if (r.type === 'suit' && !(crew && sim.world.has(crew, SuitC))) return false;
    if (r.type === 'powered') {
      const m = sim.world.get(r.module, ModuleC);
      if (!m || !m.enabled || m.hp <= 0 || !m.powered) return false;
    }
  }
  return true;
}
