import { K } from './grid';
import { PREC, addRoom, depthFrom, nearPublic, solid, type Ctx2 } from './kit';
import type { DeptId, Facility } from './program';
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
  // The side freight stands on: the hall runs out to it.
  const nbDept = (i: number): DeptId | undefined => g.nb(i).map((j) => c.owner.get(j)).find((d) => d !== undefined && d !== dept);
  const sideA = rest.filter((i) => perp(i) < p0), sideB = rest.filter((i) => perp(i) > p0 + W - 1);
  const freightA = sideA.some((i) => nbDept(i) === 'freight'), freightB = sideB.some((i) => nbDept(i) === 'freight');
  const gate = freightA && !freightB ? sideB : !freightA && freightB ? sideA : c.rng.chance(0.5) ? sideA : sideB;
  const gateSet = new Set(gate);
  const hall = rest.filter((i) => !gateSet.has(i));
  if (gate.length < 12) return false;
  const hallId = addRoom(c, { tiles: hall, spec: { role: 'hall', mods: [], w: 1, h: 1 }, dept, prec: PREC.inner + c.rooms.length, doors: [] });
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
  const back = gate.filter((i) => (d.get(i) ?? 99) > cut);
  const post = addRoom(c, { tiles: front, spec: { ...(customs?.spec ?? { role: 'armoury', mods: [], w: 3, h: 3 }) }, dept, prec: PREC.inner + 1e4 + c.rooms.length, doors: ['public', hallId] });
  if (back.length > 0) {
    if (office) addRoom(c, { tiles: back, spec: { ...office.spec }, dept, prec: PREC.soft + c.rooms.length, doors: [{ any: [hallId, post] }] });
    else { for (const i of back) g.set(i, K.Room, hallId); (c.rooms[hallId] as { tiles: number[] }).tiles.push(...back); }
  }
  return true;
}
