import type { ShipPlan } from './plan';
import { requirementsOfStationPlan } from './stationArchitecturePlan';
import { stationHullIntegrityProblems } from './stationHullIntegrity';
import { sourceModuleDeficits } from './stationStructuralIntegration';
import type { GenResult, RoomRole } from './types';

/**
 * Checks on the FINISHED station of a flow grammar: what must survive the whole pipeline (layout, wall thinning, door
 * pruning, cabins, fit-out, archways), read from the furnished template and nothing else. Each failure is a problem of
 * the layout, so a station that drops a bed or loses a gate does not pass as generated.
 *
 *   content      every module the plan asked for is placed
 *   hull, walls  the recovered hull check: one-tile walls, no solid 2x2 block, no diagonal leak, a continuous hull
 *   regions      no room or hall in disconnected pieces
 *   reach        every room is walkable to from the public network
 *   controlled   rooms of a controlled department open only onto circulation behind a gate (a door between two halls),
 *                and that circulation has exactly one gate
 */

/** Roles whose rooms stand behind a controlled entrance. */
const CONTROLLED: readonly RoomRole[] = ['reactor', 'shields', 'core'];
const OPEN: readonly RoomRole[] = ['hall', 'plaza', 'garden', 'drill'];

export function finishedFlowProblems(g: GenResult, plan: ShipPlan, controlled: readonly RoomRole[] = CONTROLLED): string[] {
  const out: string[] = [];
  const rows = g.template.rows, W = g.width, H = g.height;
  const at = (i: number): string => rows[Math.floor(i / W)]?.[i % W] ?? '.';
  const roleAt = (i: number): RoomRole | undefined => g.rooms[g.roomOf[i] ?? -1]?.role;
  const near = (i: number): number[] => [i % W > 0 ? i - 1 : -1, i % W < W - 1 ? i + 1 : -1, i - W, i + W].filter((j) => j >= 0 && j < W * H);

  const short = sourceModuleDeficits(requirementsOfStationPlan(plan), g.template.modules ?? []);
  if (short.length > 0) out.push(`content: ${short.map((m) => `${m.def.replace('module.', '')} ${m.found}/${m.needed}`).join(', ')}`);

  const hull = stationHullIntegrityProblems(g.template);
  if (hull.length > 0) out.push(`hull: ${hull.join('; ').replace(/graph-wheel /g, '')}`);

  // Regions in one piece.
  const seen = new Uint8Array(W * H);
  const pieces = new Map<number, number>();
  for (let i = 0; i < W * H; i++) {
    const room = g.roomOf[i] ?? -1;
    if (at(i) !== '_' || room < 0 || seen[i]) continue;
    pieces.set(room, (pieces.get(room) ?? 0) + 1);
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) for (const j of near(stack.pop() as number)) if (!seen[j] && at(j) === '_' && g.roomOf[j] === room) { seen[j] = 1; stack.push(j); }
  }
  const split = [...pieces].filter(([, n]) => n > 1).map(([room, n]) => `${g.rooms[room]?.role} #${room} in ${n} pieces`);
  if (split.length > 0) out.push(`regions: ${split.join(', ')}`);

  // Circulation components, a door between two halls (a gate) counting as closed.
  const open = (i: number): boolean => at(i) === '_' && OPEN.includes(roleAt(i) as RoomRole);
  const isGate = (i: number): boolean => at(i) === 'D' && near(i).filter(open).length >= 2 && near(i).every((j) => at(j) !== '_' || open(j));
  const comp = new Int32Array(W * H).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!open(i) || comp[i] !== -1) continue;
    const id = sizes.length;
    let n = 0;
    const stack = [i];
    comp[i] = id;
    while (stack.length > 0) {
      const k = stack.pop() as number;
      n++;
      for (const j of near(k)) {
        if (comp[j] !== -1) continue;
        // Through open floor, and through a door or archway between two open rooms that is not a hall-to-hall gate.
        if (open(j) || (at(j) === 'D' && !isGate(j) && near(j).every((q) => at(q) !== '_' || open(q)))) { comp[j] = id; stack.push(j); }
      }
    }
    sizes.push(n);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  const gates = new Map<number, number>();
  for (let i = 0; i < W * H; i++) if (isGate(i)) for (const c of new Set(near(i).map((j) => comp[j] as number).filter((c) => c >= 0 && c !== main))) gates.set(c, (gates.get(c) ?? 0) + 1);

  // Each room's doors: which circulation it opens onto.
  const onto = new Map<number, Set<number>>();
  for (let i = 0; i < W * H; i++) {
    if (at(i) !== 'D' || isGate(i)) continue;
    const sides = near(i).filter((j) => at(j) === '_');
    for (const a of sides) {
      const room = g.roomOf[a] ?? -1;
      if (room < 0 || open(a)) continue;
      for (const b of sides) if (open(b)) (onto.get(room) ?? onto.set(room, new Set()).get(room) as Set<number>).add(comp[b] as number);
    }
  }
  const bad: string[] = [], lost: string[] = [];
  g.rooms.forEach((rm, id) => {
    if (OPEN.includes(rm.role) || !(g.roomOf as Int16Array).includes(id)) return;
    const cs = onto.get(id);
    if (!cs || cs.size === 0) {
      // A room with no door of its own onto circulation: fine when it was opened into it (a dock) or is reached through a neighbour.
      return;
    }
    if (!controlled.includes(rm.role)) return;
    if (cs.has(main)) bad.push(`${rm.role} #${id} opens onto public circulation`);
    else for (const c of cs) if ((gates.get(c) ?? 0) !== 1) bad.push(`${rm.role} #${id}: its circulation has ${gates.get(c) ?? 0} gates`);
  });
  if (bad.length > 0) out.push(`controlled: ${[...new Set(bad)].join('; ')}`);

  // Every room walkable to from the public network (doors and gates open).
  const reach = new Uint8Array(W * H);
  const start = comp.indexOf(main);
  if (start >= 0) {
    const stack = [start];
    reach[start] = 1;
    while (stack.length > 0) for (const j of near(stack.pop() as number)) if (!reach[j] && (at(j) === '_' || at(j) === 'D')) { reach[j] = 1; stack.push(j); }
    g.rooms.forEach((rm, id) => {
      const tile = (g.roomOf as Int16Array).indexOf(id);
      if (tile >= 0 && at(tile) === '_' && !reach[tile]) lost.push(`${rm.role} #${id}`);
    });
  }
  if (lost.length > 0) out.push(`reach: no way to ${lost.join(', ')}`);
  return out;
}
