import { ALT, BodyC } from '../body';
import { ShipC } from '../combat/components';
import { ModuleC } from '../modules/components';
import { footprintTiles, rotatedSize } from '../modules/footprint';
import { shipGrid, shipIdOf } from '../regions';
import { StorageC } from '../items/components';
import type { Sim } from '../sim';
import { Struct, writeStruct } from '../structure';
import { ContainerC, type ClampSide } from './components';

/** Drift speed range of a freshly detached container, tiles per second, and its largest spin (rad/s). */
export const DETACH_SPEED: readonly [number, number] = [0.15, 0.35];
export const DETACH_SPIN = 0.15;
/** Drift damping time constant (seconds): a container loses about two thirds of its speed every this long. */
export const DRIFT_DAMP_SEC = 12;
/** Below this speed (tiles/s, or rad/s for spin) a drifting container is at rest. */
export const DRIFT_STOP = 0.004;

/** Tag a freshly spawned container module (spawnModule calls it for `container` defs). */
export function initContainer(sim: Sim, id: number, clamp: ClampSide = 'n'): void {
  const m = sim.world.get(id, ModuleC);
  if (!m) return;
  sim.world.add(id, ContainerC, { def: m.def, rot: m.rot, clamp, state: 'clamped', hp: m.hp, ship: 0, vx: 0, vy: 0, spin: 0 });
}

/**
 * Detach a clamped container: its footprint tiles leave the ship (Space, no owner, no module), the entity drops ModuleC
 * and becomes a free body at the footprint's centre with the same StorageC, drifting away from the ship's centre at a
 * seeded speed. Returns false (nothing changes) if `id` is not a clamped container.
 */
export function detachContainer(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  const c = sim.world.get(id, ContainerC);
  const def = m && sim.content.modules[m.def];
  if (!m || !c || !def?.container || c.state !== 'clamped') return false;
  const ship = shipIdOf(sim, m);
  const grid = shipGrid(sim, ship);
  if (!grid) return false;
  for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
    if (!grid.inBounds(t.x, t.y)) continue;
    if (grid.get('module', t.x, t.y) === id) grid.set('module', t.x, t.y, 0);
    if (grid.get('struct', t.x, t.y) !== Struct.Space) writeStruct(grid, t.x, t.y, Struct.Space);
    grid.set('o2', t.x, t.y, 0);
    grid.set('co2', t.x, t.y, 0);
  }
  const [w, h] = rotatedSize(def, m.rot);
  const x = m.x + w / 2;
  const y = m.y + h / 2;
  // Away from the ship's centre (or along the clamp's outward side when it sits on the centre), jittered.
  const s = sim.world.get(ship, ShipC);
  const out = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[c.clamp === 'n' ? 's' : c.clamp === 's' ? 'n' : c.clamp === 'e' ? 'w' : 'e'] as [number, number];
  let dx = s ? x - (s.x + s.width / 2) : out[0];
  let dy = s ? y - (s.y + s.height / 2) : out[1];
  if (Math.hypot(dx, dy) < 0.5) [dx, dy] = out;
  const a = Math.atan2(dy, dx) + (sim.rng.next() - 0.5) * 0.8;
  const speed = DETACH_SPEED[0] + sim.rng.next() * (DETACH_SPEED[1] - DETACH_SPEED[0]);
  Object.assign(c, { state: 'drifting', rot: m.rot, hp: m.hp, ship, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, spin: (sim.rng.next() - 0.5) * 2 * DETACH_SPIN });
  sim.world.remove(id, ModuleC);
  sim.world.add(id, BodyC, { x, y, heading: 0, alt: ALT.docked });
  sim.events.emit({ type: 'container.detached', container: id, ship, x, y });
  return true;
}

/**
 * A free container body that never was clamped (a ruin's torn-off container): position in sector tiles (its centre),
 * drift and stock. Returns its entity id.
 */
export function spawnDriftingContainer(
  sim: Sim, o: { def: string; rot: number; clamp?: ClampSide; x: number; y: number; vx: number; vy: number; spin: number; hp: number; ship: number; stock: { item: string; count: number }[] },
): number {
  const def = sim.content.modules[o.def];
  if (!def?.container) throw new Error(`spawnDriftingContainer: "${o.def}" is not a container`);
  const id = sim.world.createEntity();
  sim.world.add(id, ContainerC, { def: o.def, rot: o.rot, clamp: o.clamp ?? 'n', state: 'drifting', hp: Math.round(def.maxHp * o.hp), ship: o.ship, vx: o.vx, vy: o.vy, spin: o.spin });
  sim.world.add(id, BodyC, { x: o.x, y: o.y, heading: 0, alt: ALT.docked });
  sim.world.add(id, StorageC, { capacity: def.storage?.capacity ?? 0, filter: null, stacks: o.stock.map((q) => ({ ...q })) });
  return id;
}
