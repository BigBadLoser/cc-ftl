import type { RoomSpec } from '../plan';
import { block, type BlockOpts } from './elements';
import { at, key, rect, type Built, type Ctx, type Frame, type Port } from './model';
import { SOLID } from './regions';
import type { QuayOpts } from './quay';

/**
 * A pier head: the harbour as the end of a street. Its rooms are the street's last rooms, a row either side; past
 * them a gate, customs across the whole width, and a hall no wider than the rows with an airlock in each free wall:
 * the end wall first, then the two sides in turn, a pitch apart. Nothing stands wider than the street's own rows, and
 * the ships lie round the head on three sides.
 */

/** Open ground kept off a wall with an airlock in it: where the shuttle lies. */
const BERTH = 7;
/** Customs, along the street. */
const CUSTOMS = 3;

export function pierHead(c: Ctx, port: Port, rooms: readonly RoomSpec[], docks: readonly RoomSpec[], o: QuayOpts, b: BlockOpts): Built | null {
  const g = c.g, n0 = g.regions.length, deep = Math.max(4, b.rowDepth ?? 4);
  if (docks.length === 0 || port.hall < 0) return null;
  // The rooms line the street; the head stands where their rows end.
  let from: Port = port, ports: Built['ports'] = [], took = 0, inland: Built['box'] | null = null;
  if (rooms.length > 0) {
    const plain: BlockOpts = { ...b, rowDepth: deep, even: true, cap: false, gate: false };
    delete plain.docks;
    const blk = block(c, port, rooms, plain), end = blk?.ports.find((p) => p.kind === 'end');
    if (!blk || !end) return null;
    ports = blk.ports.filter((p) => p !== end);
    took = blk.took ?? 0;
    inland = blk.box;
    from = { ...end, owner: -1, used: false };
  }
  const f: Frame = from.frame;
  // As wide as the rows: their outer walls run on as the head's.
  const v0 = -(deep + 2), v1 = deep + 2;
  // One airlock in the end wall; the rest along the two sides, a pitch apart, two tiles clear of customs and of the end unit.
  const pairs = Math.ceil((docks.length - 1) / 2), L = CUSTOMS + 2 + Math.max(0, pairs - 1) * o.pitch + 3 + 2 + 3;
  const free = (box: readonly [number, number, number, number], open = false): boolean => {
    for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) if (!c.free(x, y) || (open && c.site.hull?.(x, y) && !(c.site.depth?.(x, y) >= 4))) return false;
    return true;
  };
  if (!free(rect(f, 0, L + 1, v0 - 1, v1 + 1))) return null;
  // Where each airlock stands: its unit of three by three (the airlock module's own floor), its hatch, its berth.
  const units = docks.map((d, i) => {
    if (i === 0) return { d, box: rect(f, L - 3, L, -2, 1), hatch: at(f, L, -1), berth: rect(f, L + 1, L + 1 + BERTH, v0 - 1, v1 + 1) };
    const k = (i - 1) >> 1, u = CUSTOMS + 2 + k * o.pitch, north = i % 2 === 1;
    return north
      ? { d, box: rect(f, u, u + 3, v0, v0 + 3), hatch: at(f, u + 1, v0 - 1), berth: rect(f, u - 2, u + 5, v0 - 1 - BERTH, v0 - 1) }
      : { d, box: rect(f, u, u + 3, v1 - 3, v1), hatch: at(f, u + 1, v1), berth: rect(f, u - 2, u + 5, v1 + 1, v1 + 1 + BERTH) };
  });
  if (units.some((un) => !free(un.berth, true))) return null;

  const customs = g.hall('plaza', 'customs'), hall = g.hall('hall', 'harbour');
  g.street(customs, ...rect(f, 0, CUSTOMS, v0, v1));
  g.street(hall, ...rect(f, CUSTOMS, L, v0, v1));
  // The gate: across the street, in line with the last rooms' end walls.
  for (const v of [-1, 0]) g.set(...at(f, -1, v), SOLID);
  g.gate(...at(f, -1, 0));
  for (const un of units) {
    g.rect(g.hall('dock', 'airlock', { ...un.d, w: 3, h: 3 }), ...un.box);
    g.gate(...un.hatch);
    for (let y = un.berth[1]; y < un.berth[3]; y++) for (let x = un.berth[0]; x < un.berth[2]; x++) c.reserved.add(key(x, y));
  }
  const regions: number[] = [];
  for (let id = n0; id < g.regions.length; id++) regions.push(id);
  let box = rect(f, -1, L + 1, v0 - 1, v1 + 1);
  if (inland) box = [Math.min(box[0], inland[0]), Math.min(box[1], inland[1]), Math.max(box[2], inland[2]), Math.max(box[3], inland[3])];
  return { ports, regions, box, took };
}
