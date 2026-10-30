import { ShipC } from '../combat/components';
import { restoreTasks } from '../ai/task';
import type { EntityData } from '../ecs';
import type { DenseGrid } from '../grid';
import { placementGapError, shipRect } from '../regions';
import type { ShipTemplate } from '../registry';
import { gridFromTemplate } from '../ship';
import type { Sim } from '../sim';
import { ALT } from '../body';
import { BodyC } from '../body';
import { VehicleC } from '../vehicles/components';
import { undock } from '../vehicles/lifecycle';
import { liftSet, type LiftOptions } from './members';
import { cutLeaving } from './refs';
import { translated } from './translate';

/** One entity in transit: its id (kept: ids are never reused) and its components, coordinates in the packet's frame. */
export interface PacketEntity {
  id: number;
  c: EntityData;
}

/**
 * The single format for a ship in transit. Plain JSON data (it is saved while the player deploys). `tiles` holds every grid
 * field over the ship's rectangle, row-major, `w * h` values each, ship-local (0, 0 = the top-left). `entities` are in local
 * tiles too. `ship` is the ShipC entity id, 0 for a packet made from a template (whose modules and ShipC are created when it is
 * stamped, from `template`).
 */
export interface ShipPacket {
  ship: number;
  w: number;
  h: number;
  tiles: Record<string, number[]>;
  entities: PacketEntity[];
  template?: ShipTemplate;
}

/** The fields of a dense ship grid as packet tiles. */
function denseTiles(g: DenseGrid): Record<string, number[]> {
  const tiles: Record<string, number[]> = {};
  for (const f of g.fieldNames()) {
    const out: number[] = new Array<number>(g.width * g.height);
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) out[y * g.width + x] = g.get(f, x, y);
    tiles[f] = out;
  }
  return tiles;
}

/** A packet from a template (or shipgen output): its tiles, no entities yet. `stampShip` places its modules and ShipC. */
export function packetFromTemplate(template: ShipTemplate): ShipPacket {
  const g = gridFromTemplate(template);
  return { ship: 0, w: g.width, h: g.height, tiles: denseTiles(g), entities: [], template };
}

/**
 * Lift a live ship out of the sector into a packet: its tiles (every field over its rectangle, which is then cleared to empty
 * Space and its now empty chunks released) and every entity that travels with it (`liftSet`: what stands on it, its own
 * stowed and docked vehicles, the non-player docked vehicles `opts.withDocked` picks, and the crew aboard them). The entities
 * are detached from the world. Non-player vehicles left docked to it are cut loose first (they undock where they are).
 * References from the lifted entities to ones that stay are cleared (`cutLeaving`).
 */
export function liftShip(sim: Sim, ship: number, opts: LiftOptions = {}): ShipPacket {
  const s = sim.world.get(ship, ShipC);
  if (!s) throw new Error(`liftShip: ${ship} is not a ship`);
  const ids = liftSet(sim, ship, opts);
  const lifting = new Set(ids);
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC);
    if (!v || lifting.has(id) || v.state !== 'docked' || !lifting.has(v.dock)) continue;
    undock(sim, id, v);
    const body = sim.world.get(id, BodyC);
    if (body) body.alt = ALT.cruise;
  }
  const rect = shipRect(s);
  const grid = sim.sector.grid;
  const tiles: Record<string, number[]> = {};
  for (const f of grid.fieldNames()) {
    tiles[f] = Array.from(grid.load(f, rect));
    const empty = grid.emptyValue(f);
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) if (grid.get(f, x, y) !== empty) grid.set(f, x, y, empty);
    }
  }
  grid.releaseEmpty(rect);
  const entities = ids.map((id) => ({ id, c: cutLeaving(translated(sim.world.detach(id), -s.x, -s.y), (e) => lifting.has(e)) }));
  return { ship, w: rect.w, h: rect.h, tiles, entities };
}

/** Write a packet's tiles into the sector with its top-left at (x, y) (struct first, so a chunk is allocated before the rest). */
export function stampTiles(sim: Sim, packet: ShipPacket, x: number, y: number): void {
  const grid = sim.sector.grid;
  const fields = Object.keys(packet.tiles).sort((a, b) => Number(b === 'struct') - Number(a === 'struct'));
  for (const f of fields) {
    if (!grid.has(f)) throw new Error(`stampTiles: the sector has no field "${f}"`);
    const vals = packet.tiles[f] as number[];
    for (let ly = 0; ly < packet.h; ly++) {
      for (let lx = 0; lx < packet.w; lx++) {
        const v = vals[ly * packet.w + lx] as number;
        if (v !== grid.get(f, x + lx, y + ly)) grid.set(f, x + lx, y + ly, v);
      }
    }
  }
}

/**
 * Stamp a lifted packet at sector (x, y): its tiles (owner layer included) and its entities, restored under their own ids with
 * every coordinate moved to the new offset. Returns the ship id. Throws on a template packet (use `stampShip`) or if the spot
 * breaks the gap rule (commands check `placementGapError` first).
 */
export function stampPacket(sim: Sim, packet: ShipPacket, x: number, y: number): number {
  if (!packet.ship) throw new Error('stampPacket: a template packet is stamped by stampShip');
  const gap = placementGapError(sim, { x, y, w: packet.w, h: packet.h });
  if (gap) throw new Error(`stampPacket: ship ${packet.ship} at (${x}, ${y}): ${gap}`);
  stampTiles(sim, packet, x, y);
  for (const e of packet.entities) sim.world.restore(e.id, translated(e.c, x, y));
  restoreTasks(sim); // a task the lift's cut dropped
  return packet.ship;
}

/** Units of an item in the storage modules and loose stacks of a packet's entities (a ship in hyperspace holds its cargo as data). */
export function packetCount(packet: ShipPacket, item: string): number {
  let n = 0;
  for (const e of packet.entities) {
    for (const st of (e.c['storage'] as { stacks: { item: string; count: number }[] } | undefined)?.stacks ?? []) if (st.item === item) n += st.count;
    const loose = e.c['itemStack'] as { item: string; count: number } | undefined;
    if (loose?.item === item) n += loose.count;
  }
  return n;
}

/** Take up to `count` units of an item out of a packet (storage first, then loose stacks); returns how many came out. */
export function packetTake(packet: ShipPacket, item: string, count: number): number {
  let left = count;
  for (const e of packet.entities) {
    const stacks = (e.c['storage'] as { stacks: { item: string; count: number }[] } | undefined)?.stacks;
    for (let i = (stacks?.length ?? 0) - 1; stacks && i >= 0 && left > 0; i--) {
      const st = stacks[i];
      if (!st || st.item !== item) continue;
      const take = Math.min(left, st.count);
      st.count -= take;
      left -= take;
      if (st.count === 0) stacks.splice(i, 1);
    }
  }
  for (const e of [...packet.entities]) {
    const loose = e.c['itemStack'] as { item: string; count: number } | undefined;
    if (left <= 0 || !loose || loose.item !== item) continue;
    const take = Math.min(left, loose.count);
    loose.count -= take;
    left -= take;
    if (loose.count === 0) packet.entities.splice(packet.entities.indexOf(e), 1);
  }
  return count - left;
}
