import { PREC, addRoom, depthFrom, nearPublic, solid, type Ctx2 } from './kit';
import type { DeptId, Facility } from './program';
import { leftovers } from './machine';
import type { Face } from './structure';
import { DIR_V } from './template';

/**
 * Harbour strategy (docs/STATIONGEN2.md section 3.4): the dock bank flush on the flat face, the harbour hall behind it
 * and along the side where freight stands (the holds open onto it), and on the other side the customs post (the one way
 * between the hall and public space) with the dock office behind it.
 */
export function harbourStrategy(c: Ctx2, dept: DeptId, tiles: number[], face: Face, facilities: Facility[]): boolean {
  const g = c.g;
  const [dx, dy] = DIR_V[face.dir] as [number, number];
  const along = (i: number): number => g.x(i) * dx + g.y(i) * dy;
  const perp = (i: number): number => (dx === 0 ? g.x(i) : g.y(i));
  const mine = new Set(tiles);
  const docks = facilities.filter((f) => f.spec.role === 'dock');
  const W = docks.length * 4 + 1;
  const p0 = -Math.floor(W / 2);
  // Each dock: interior 3 x 3 behind the hull row, its walls shared with its neighbours.
  const dockRects = docks.map((_, k) => {
    const a = face.line - 4, b = face.line;
    const q0 = p0 + 4 * k, q1 = q0 + 4;
    const pts: number[] = [];
    for (let al = a; al <= b; al++) for (let q = q0; q <= q1; q++) pts.push(dx === 0 ? g.idx(q, al * dy) : g.idx(al * dx, q));
    return { pts, inner: pts.filter((i) => along(i) > a && along(i) < b && perp(i) > q0 && perp(i) < q1) };
  });
  if (dockRects.some((d) => d.pts.some((i) => !mine.has(i)))) return false;
  const bank = new Set(dockRects.flatMap((d) => d.pts));
  const rest = tiles.filter((i) => !bank.has(i));
  if (c.s.t.block) return slotHarbour(c, dept, rest, dockRects, docks, face, facilities, along, perp);
  // The side freight stands on: the hall runs out to it.
  const nbDept = (i: number): DeptId | undefined => g.nb(i).map((j) => c.owner.get(j)).find((d) => d !== undefined && d !== dept);
  const sideA = rest.filter((i) => perp(i) < p0), sideB = rest.filter((i) => perp(i) > p0 + W - 1);
  const freightA = sideA.some((i) => nbDept(i) === 'freight'), freightB = sideB.some((i) => nbDept(i) === 'freight');
  const gate = freightA && !freightB ? sideB : !freightA && freightB ? sideA : c.rng.chance(0.5) ? sideA : sideB;
  const gateSet = new Set(gate);
  const open = rest.filter((i) => !gateSet.has(i));
  if (gate.length < 12) return false;
  // The hall: behind the dock bank, and along the corridor on the freight side (three rows, its wall included) so the
  // holds open onto it; the wing's back becomes stores, not hall.
  const dp = depthFrom(g, open, (i) => nearPublic(g, i));
  const behind = (i: number): boolean => perp(i) >= p0 - 1 && perp(i) <= p0 + W;
  const hall = open.filter((i) => behind(i) || (dp.get(i) ?? 99) <= 3);
  const hallSet = new Set(hall);
  const back = open.filter((i) => !hallSet.has(i));
  const hallId = addRoom(c, { tiles: hall, spec: { role: 'hall', mods: [], w: 1, h: 1 }, dept, prec: PREC.inner + c.rooms.length, doors: [] });
  leftovers(c, dept, back, [hallId], () => ({ role: 'cargo', mods: ['module.storage_rack', 'module.storage_rack'], w: 3, h: 3 }));
  if (dept === 'harbour') c.halls.set('harbour', hallId);
  solid(c, dockRects.flatMap((d) => d.pts.filter((i) => !d.inner.includes(i))));
  for (const [k, d] of dockRects.entries()) {
    addRoom(c, { tiles: d.inner, spec: { ...(docks[k] as Facility).spec }, dept, prec: PREC.rect + c.rooms.length, doors: [hallId] });
  }
  // The gate side: customs on the public face, the office (first harbour only) behind it.
  const customs = facilities.find((f) => f.spec.role === 'armoury');
  const office = facilities.find((f) => f.spec.role === 'bridge');
  const d = depthFrom(g, gate, (i) => nearPublic(g, i));
  const maxD = Math.max(...gate.map((i) => d.get(i) ?? 0));
  const cut = office ? Math.max(3, Math.min(5, Math.floor(maxD / 2))) : maxD;
  const front = gate.filter((i) => (d.get(i) ?? 99) <= cut);
  const rear = gate.filter((i) => (d.get(i) ?? 99) > cut);
  const post = addRoom(c, { tiles: front, spec: { ...(customs?.spec ?? { role: 'armoury', mods: [], w: 3, h: 3 }) }, dept, prec: PREC.inner + 1e4 + c.rooms.length, doors: ['public', hallId] });
  if (rear.length > 0) {
    if (office) addRoom(c, { tiles: rear, spec: { ...office.spec }, dept, prec: PREC.soft + c.rooms.length, doors: [{ any: [hallId, post] }] });
    else addRoom(c, { tiles: rear, spec: { role: 'cargo', mods: ['module.storage_rack', 'module.storage_rack'], w: 3, h: 3 }, dept, prec: PREC.soft + c.rooms.length, doors: [{ any: [hallId, post] }], optional: true });
  }
  return true;
}

/**
 * A core station's harbour slot at its face: the dock bank in the middle, the hall behind it, and a wing either side
 * where the promenade breaks for the harbour: the customs post on one (the one way between the promenade and the
 * hall), the dock office on the other (a second harbour, without an office, gets stores there).
 */
function slotHarbour(c: Ctx2, dept: DeptId, rest: number[], dockRects: { pts: number[]; inner: number[] }[], docks: Facility[], face: Face, facilities: Facility[], along: (i: number) => number, perp: (i: number) => number): boolean {
  const g = c.g;
  const lo = Math.min(...dockRects.flatMap((d) => d.pts.map(perp))), hi = Math.max(...dockRects.flatMap((d) => d.pts.map(perp)));
  const wingA = rest.filter((i) => perp(i) < lo), wingB = rest.filter((i) => perp(i) > hi);
  // The hall: three rows (its wall included) behind the bank; the floor behind it goes with the office's wing.
  const mid = rest.filter((i) => perp(i) >= lo && perp(i) <= hi);
  const hall = mid.filter((i) => along(i) >= face.line - 7);
  const backMid = mid.filter((i) => along(i) < face.line - 7);
  if (wingA.length < 12 || wingB.length < 12 || hall.length < 8) return false;
  const hallId = addRoom(c, { tiles: hall, spec: { role: 'hall', mods: [], w: 1, h: 1 }, dept, prec: PREC.inner + c.rooms.length, doors: [] });
  if (dept === 'harbour') c.halls.set('harbour', hallId);
  solid(c, dockRects.flatMap((d) => d.pts.filter((i) => !d.inner.includes(i))));
  for (const [k, d] of dockRects.entries()) {
    addRoom(c, { tiles: d.inner, spec: { ...(docks[k] as Facility).spec }, dept, prec: PREC.rect + c.rooms.length, doors: [hallId] });
  }
  const customs = facilities.find((f) => f.spec.role === 'armoury');
  const office = facilities.find((f) => f.spec.role === 'bridge');
  // Customs on the side away from freight (else either).
  const fr = (ts: number[]): boolean => ts.some((i) => g.nb(i).some((j) => c.owner.get(j) === 'freight'));
  const postSide = fr(wingA) && !fr(wingB) ? wingB : fr(wingB) && !fr(wingA) ? wingA : c.rng.chance(0.5) ? wingA : wingB;
  const other = [...(postSide === wingA ? wingB : wingA), ...backMid];
  const post = addRoom(c, { tiles: postSide, spec: { ...(customs?.spec ?? { role: 'armoury', mods: [], w: 3, h: 3 }) }, dept, prec: PREC.inner + 1e4 + c.rooms.length, doors: ['public', hallId] });
  // The office in that wing and behind the hall; stores where it has more floor than the office needs (twice).
  const need = office ? office.spec.w * office.spec.h : 0;
  if (office && other.length > 2.2 * (need + 12)) {
    const byHall = other.filter((i) => g.nb(i).some((j) => hall.includes(j)) || along(i) >= face.line - 9);
    const near = new Set(byHall.length >= need * 1.2 ? byHall : other);
    addRoom(c, { tiles: [...near], spec: { ...office.spec }, dept, prec: PREC.soft + c.rooms.length, doors: [{ any: [hallId, post] }] });
    leftovers(c, dept, other.filter((i) => !near.has(i)), [hallId, post], () => ({ role: 'cargo', mods: ['module.storage_rack', 'module.storage_rack'], w: 3, h: 3 }));
  } else if (office) addRoom(c, { tiles: other, spec: { ...office.spec }, dept, prec: PREC.soft + c.rooms.length, doors: [{ any: [hallId, post] }] });
  else leftovers(c, dept, other, [hallId], () => ({ role: 'cargo', mods: ['module.storage_rack', 'module.storage_rack'], w: 3, h: 3 }));
  return true;
}
