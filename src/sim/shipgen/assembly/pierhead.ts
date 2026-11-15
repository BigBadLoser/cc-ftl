import type { RoomSpec } from '../plan';
import type { BlockOpts } from './elements';
import { K, RING_STREET, RING_WALL } from './lattice';
import { at, key, rect, sides, type Built, type Ctx, type Frame, type Port } from './model';
import type { QuayOpts } from './quay';
import { SOLID } from './regions';
import { stretchOf } from './sizing';

/**
 * A pier head (the user's pick, "D": one block, three bands): the harbour as one plain rectangle straight out from its
 * host, as wide from the host's wall to the tip, its street the ring's width. From the host out:
 *   a short street with the harbour's other rooms either side, a pair at a time, both rows ending level
 *   the office | CUSTOMS | the armoury: customs is open floor on the avenue, in line with the street, and the two rooms
 *     either side open into it
 *   the arrivals hall, the block's full width, the airlocks inside it against its three outer walls (one in the end
 *     wall on the avenue's line, the rest along the sides a pitch apart), their hatches in the hull and their berths
 *     kept clear outside
 * The only way from an airlock in is through customs. On a ring's rim the block's sides fall on the band's lattice
 * lines, so it takes the strips it crosses whole and leaves no sliver beside it.
 *
 * The block is solid first and its floor is cut out of it, so every wall is the block's own, one tile thick, and a room
 * beside it (a band strip) meets a straight line.
 */

/** Open ground kept off a wall with an airlock in it: where the shuttle lies. */
const BERTH = 7;
/** The street's last line across: it runs v = -1 to LAST, the ring's width. */
const LAST = RING_STREET - 2;

const area = (r: RoomSpec): number => r.w * r.h;
/** A room's floor along the street at a floor depth, keeping its area. */
const lengthAt = (r: RoomSpec, d: number): number => Math.max(3, Math.ceil(area(r) / d));
/** As long as it may grow at that depth (`stretchOf`). */
const capAt = (r: RoomSpec, d: number): number => Math.max(lengthAt(r, d), Math.floor((stretchOf(r) * area(r)) / d));

/**
 * The floor lengths of two rows of rooms (each room its floor and one wall after it) so both rows end level: the
 * shorter row's rooms grow a tile at a time, the one with the most room to grow first, as far as each may; what they
 * cannot reach the longer row's biggest rooms give back. Neither row may be empty.
 */
function level(rows: readonly [RoomSpec[], RoomSpec[]], depth: readonly [number, number]): [number[], number[]] {
  const lens = rows.map((row, k) => row.map((r) => lengthAt(r, depth[k] as number))) as [number[], number[]];
  const total = (k: 0 | 1): number => lens[k].reduce((n, l) => n + l + 1, 0);
  for (let guard = 0; guard < 400 && total(0) !== total(1); guard++) {
    const s = total(0) < total(1) ? 0 : 1, l = s === 0 ? 1 : 0;
    const room = rows[s].map((r, i) => capAt(r, depth[s]) - (lens[s][i] as number));
    const grow = room.indexOf(Math.max(...room));
    if ((room[grow] as number) > 0) { lens[s][grow] = (lens[s][grow] as number) + 1; continue; }
    const give = lens[l].indexOf(Math.max(...lens[l]));
    if ((lens[l][give] as number) <= 3) break;
    lens[l][give] = (lens[l][give] as number) - 1;
  }
  // (Rooms that can go no further either way: the shorter row's last room takes up the rest.)
  const s = total(0) < total(1) ? 0 : 1, last = lens[s].length - 1;
  lens[s][last] = (lens[s][last] as number) + Math.abs(total(0) - total(1));
  return lens;
}

/** A filler for a row with nothing to stand opposite a room: a small garden. */
const filler = (d: number): RoomSpec => ({ role: 'garden', dept: 'commons', mods: [], w: 3, h: d });

export function pierHead(c: Ctx, port: Port, rooms: readonly RoomSpec[], docks: readonly RoomSpec[], o: QuayOpts, b: BlockOpts): Built | null {
  const g = c.g, n0 = g.regions.length, f: Frame = port.frame, deep = Math.max(4, b.rowDepth ?? 4);
  if (docks.length === 0 || port.hall < 0) return null;
  // Across the block (v): its outer walls V0 and V1, the street v = -1 to LAST, the rows' floor either side. On a ring's
  // rim the outer walls stand on lattice lines; elsewhere they run on from the host street's rows.
  const ring = port.kind === 'rim' && !!c.site.hull;
  const V0 = ring ? -K * Math.ceil((deep + 3) / K) : -(deep + 3);
  const V1 = ring ? K * Math.ceil((deep + LAST + 3) / K) - 1 : deep + 2 + Math.max(2, port.width ?? 2) - 2;
  const depth: [number, number] = [-3 - V0, V1 - LAST - 2];
  const span: [[number, number], [number, number]] = [[V0 + 1, -2], [LAST + 2, V1]];
  // The rooms: the office and an armoury either side of customs, the rest in pairs along the street before it.
  const others = [...rooms].sort((p, q) => area(q) - area(p));
  const take = (role: RoomSpec['role']): RoomSpec | undefined => { const i = others.findIndex((r) => r.role === role && !r.annex); return i < 0 ? undefined : others.splice(i, 1)[0]; };
  const office = take('bridge'), arms = take('armoury');
  const gate: [RoomSpec[], RoomSpec[]] = [[office ?? others.shift() ?? filler(depth[0])], [arms ?? others.shift() ?? filler(depth[1])]];
  const pairs = sides(others).map((row) => row.flatMap((r) => (r.annex ? [r, { ...r.annex, annexed: true }] : [r]))) as [RoomSpec[], RoomSpec[]];
  if (pairs[0].length + pairs[1].length > 0) for (const k of [0, 1] as const) if (pairs[k].length === 0) pairs[k].push(filler(depth[k]));
  const street = pairs[0].length > 0 ? level(pairs, depth) : null, held = level(gate, depth);
  // Along the block (u): its near wall at U0, the street to S1 (the wall before the customs row), customs to S2, the
  // arrivals hall to L. On a ring the near wall is the band's first line; at the end of a street it is the line of the
  // host rows' own end walls (u = -1), so the two never stand two thick.
  const U0 = ring ? 0 : -1;
  const S1 = U0 + (street ? street[0].reduce((n, l) => n + l + 1, 0) : 0), S2 = S1 + (held[0][0] as number) + 1;
  const n = docks.length, sidePairs = Math.ceil((n - 1) / 2), P = o.pitch;
  const free = (box: readonly [number, number, number, number], open = false): boolean => {
    for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) if (!c.free(x, y) || (open && c.site.hull?.(x, y) && !(c.site.depth?.(x, y) > RING_WALL))) return false;
    return true;
  };
  // On a ring the block meets the ring all the way across, with no band left between.
  if (ring) for (let v = V0; v <= V1; v++) if (g.at(...at(f, -1, v)) !== port.hall) return null;
  // The airlocks: one in the end wall on the avenue's line, the rest along the sides a pitch apart, starting two tiles
  // into the hall or further out, where their berths are clear of the station.
  const lay = (A: number): { L: number; units: { d: RoomSpec; box: [number, number, number, number]; hatch: [number, number]; berth: [number, number, number, number] }[] } => {
    const L = sidePairs > 0 ? A + (sidePairs - 1) * P + 8 : S2 + 5;
    const units = docks.map((d, i) => {
      if (i === 0) return { d, box: rect(f, L - 3, L, -1, LAST + 1), hatch: at(f, L, 0), berth: rect(f, L + 1, L + 1 + BERTH, V0, V1 + 1) };
      const k = (i - 1) >> 1, u = A + k * P;
      return i % 2 === 1
        ? { d, box: rect(f, u, u + 3, V0 + 1, V0 + 4), hatch: at(f, u + 1, V0), berth: rect(f, u - 2, u + 5, V0 - BERTH, V0) }
        : { d, box: rect(f, u, u + 3, V1 - 3, V1), hatch: at(f, u + 1, V1), berth: rect(f, u - 2, u + 5, V1 + 1, V1 + 1 + BERTH) };
    });
    return { L, units };
  };
  let plan: ReturnType<typeof lay> | null = null;
  for (let A = S2 + 3; A <= S2 + 3 + 4 * K && !plan; A++) {
    const p = lay(A);
    if (free(rect(f, U0 + 1, p.L + 1, V0, V1 + 1)) && (!ring || free(rect(f, 0, 1, V0, V1 + 1))) && p.units.every((un) => free(un.berth, true))) plan = p;
    if (sidePairs === 0) break;
  }
  if (!plan) return null;
  const { L, units } = plan;

  g.rect(SOLID, ...rect(f, U0, L + 1, V0, V1 + 1), (x, y) => { const id = g.at(x, y); return id < 0 || !g.regions[id]?.hall; });
  const hall = street ? g.hall('hall', 'harbour') : -1, customs = g.hall('plaza', 'customs'), arrivals = g.hall('hall', 'harbour');
  if (street) g.rect(hall, ...rect(f, 0, S1, -1, LAST + 1));
  g.rect(customs, ...rect(f, Math.max(S1, 0), S2 + 1, -1, LAST + 1));
  g.rect(arrivals, ...rect(f, S2 + 1, L, V0 + 1, V1));
  // The rooms: floor only, the block's solid between them.
  const stand = (spec: RoomSpec, k: 0 | 1, u: number, len: number, access: number): number => {
    const id = g.room(spec.role, { spec: { ...spec, w: lengthAt(spec, depth[k]), h: depth[k] }, access: [access] });
    g.rect(id, ...rect(f, u, u + len, span[k][0], span[k][1]));
    return id;
  };
  if (street) for (const k of [0, 1] as const) {
    let u = U0 + 1, before = -1;
    for (const [i, spec] of pairs[k].entries()) {
      const len = street[k][i] as number;
      before = stand(spec, k, u, len, spec.annexed && before >= 0 ? before : hall);
      u += len + 1;
    }
  }
  for (const k of [0, 1] as const) stand(gate[k][0] as RoomSpec, k, S1 + 1, held[0][0] as number, customs);
  for (const un of units) {
    g.rect(g.hall('dock', 'airlock', { ...un.d, w: 3, h: 3 }), ...un.box);
    g.gate(...un.hatch);
    for (let y = un.berth[1]; y < un.berth[3]; y++) for (let x = un.berth[0]; x < un.berth[2]; x++) c.reserved.add(key(x, y));
  }
  const regions: number[] = [];
  for (let id = n0; id < g.regions.length; id++) regions.push(id);
  return { ports: [], regions, box: rect(f, U0, L + 1, V0, V1 + 1), took: 0 };
}
