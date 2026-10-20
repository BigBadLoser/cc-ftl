import { ModuleC } from '../modules/components';
import type { ShipTemplate } from '../registry';
import type { Sim } from '../sim';
import { spillItems } from '../items/stacks';
import type { RuinMeta } from '../shipgen/ruinTypes';
import { shipGrid, shipIdOf } from '../regions';
import { DoorJam } from '../structure';
import { ShipC } from './components';
import { spawnDriftingContainer } from '../containers/detach';
import { ContainerC } from '../containers/components';

/**
 * Apply a ruin pass's meta to a freshly stamped derelict (`stampShip`, so no crew, combat or AI): module hp, power,
 * jammed doors (`jam`), starting air and fires, loose loot and caches. The ship becomes an inert wreck. Data the sim has
 * no state for yet (dressing art, hooks) stays in the meta for the renderer and later systems.
 */
export function applyRuin(sim: Sim, shipId: number, template: ShipTemplate, meta: RuinMeta): void {
  const grid = shipGrid(sim, shipId);
  if (!grid) return;
  const ox = grid.x0, oy = grid.y0;
  const byTile = new Map<string, number>();
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (m && shipIdOf(sim, m) === shipId) byTile.set(`${m.def}@${m.x},${m.y}`, id);
  }
  let hp = 0;
  for (const r of meta.modules) {
    const t = template.modules?.[r.index];
    const id = t ? byTile.get(`${t.def}@${ox + t.x},${oy + t.y}`) : undefined;
    const m = id ? sim.world.get(id, ModuleC) : undefined;
    const def = m && sim.content.modules[m.def];
    if (!m || !def) continue;
    m.hp = Math.round(def.maxHp * r.hp);
    const box = sim.world.get(id as number, ContainerC);
    if (box) box.hp = m.hp;
    hp += r.hp;
    // Power off: every source is shut down. Emergency: sources run, but only lights and life support stay switched on.
    if (def.power > 0) m.enabled = meta.power === 'emergency' && r.state !== 'destroyed';
    else if (def.power < 0) m.enabled = meta.power === 'emergency' && (m.def === 'module.light' || m.def === 'module.lifeSupport');
  }
  const w = Math.max(1, ...template.rows.map((r) => r.length));
  for (const room of meta.rooms) {
    for (const i of room.tiles) {
      const x = ox + (i % w), y = oy + Math.floor(i / w);
      grid.set('o2', x, y, room.o2);
      grid.set('co2', x, y, room.co2);
      grid.set('temp', x, y, room.temp);
    }
  }
  for (const f of meta.fires) grid.set('fire', ox + f.x, oy + f.y, f.level);
  for (const d of meta.doors) {
    if (d.state === 'free') continue;
    grid.set('jam', ox + d.x, oy + d.y, d.state === 'stuckOpen' ? DoorJam.Open : DoorJam.Shut);
    grid.set('door', ox + d.x, oy + d.y, d.state === 'stuckOpen' ? 255 : 0);
  }
  for (const it of [...meta.items, ...meta.caches.flatMap((k) => k.items)]) spillItems(sim, shipId, ox + it.x, oy + it.y, it.item, it.count);
  // Torn-off containers drift near the wreck as free bodies with what stock they kept.
  for (const k of meta.containers ?? []) {
    if (k.fate !== 'torn' || !sim.content.modules[k.def]?.container) continue;
    spawnDriftingContainer(sim, { def: k.def, rot: k.rot, x: ox + k.x, y: oy + k.y, vx: k.vx, vy: k.vy, spin: k.spin, hp: k.hp, ship: shipId, stock: k.stock });
  }
  const ship = sim.world.get(shipId, ShipC);
  if (ship) {
    ship.state = 'wreck';
    ship.integrity = meta.modules.length ? hp / meta.modules.length : 0;
  }
}
