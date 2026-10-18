import type { Builder, Part, Rect } from './builder';
import { dockSpec, engineSpec, reactorSpec, type RoomSpec, type ShipPlan } from './plan';
import { eastStack, rowOf, runLen, stackLen, strutE, strutV, strutW } from './topoParts';
import { hall, pairUp } from './topoNavy';
import type { FactionDef } from './types';

/**
 * Machine topologies: no bridge or main hallway; a processing core, struts, rails and pods. Mirrored only when the
 * policy rolls it (balanced mounts), otherwise mounts are split unevenly.
 */

const turretsOf = (plan: ShipPlan): RoomSpec[] => [...plan.weapons, ...plan.pd, ...plan.shields, dockSpec()];
const reactorPods = (plan: ShipPlan): RoomSpec[] => Array.from({ length: plan.reactors }, () => reactorSpec(1));
const enginePods = (plan: ShipPlan): RoomSpec[] => Array.from({ length: plan.engines }, () => engineSpec(1, 'w'));

/** Split specs over two sides: mirrored pairs, or an uneven random split. */
function split(b: Builder, specs: RoomSpec[], mirror: boolean): [RoomSpec[], RoomSpec[]] {
  if (mirror) return pairUp(specs);
  const n: RoomSpec[] = [];
  const s: RoomSpec[] = [];
  for (const x of specs) (b.rng.chance(0.6) ? n : s).push(x);
  return [n, s];
}

/** An engine rail: a vertical strut east of `from` at `row`, engine pods stacked on its east side. */
function engineRail(b: Builder, from: Rect, row: number, len: number, engines: RoomSpec[]): Part | null {
  const st = strutE(b, from, row, len);
  if (!st) return null;
  const h = stackLen(engines);
  const rail = b.place({ x: st.x + st.w - 1, y: row - Math.floor(h / 2), w: 3, h }, 'hall');
  if (!rail) return null;
  b.door(st, rail);
  return eastStack(b, rail, engines, rail.y).length > 0 ? rail : null;
}

/** Processing core with arms: turret clusters north and south, a reactor/stores rail west, engines east. */
export function hub(b: Builder, f: FactionDef, plan: ShipPlan): string | null {
  const [s0, s1] = f.architecture.strutLength;
  const mirror = b.rng.chance(f.architecture.symmetry);
  const core = b.room(plan.command, 0, 0);
  if (!core) return null;
  b.axis2 = plan.command.h - 1;
  const [n, s] = split(b, turretsOf(plan), mirror);
  const col = Math.floor(plan.command.w / 2);
  const struts: Part[] = [];
  const len = b.rng.int(s0, s1);
  for (const [side, pods] of [['n', n], ['s', s]] as const) {
    if (pods.length === 0) continue;
    const st = strutV(b, core, side, col, mirror ? len : b.rng.int(s0, s1));
    if (!st) return null;
    struts.push(st);
    const w = runLen(pods);
    const node = b.place({ x: col - Math.floor(w / 2), y: side === 'n' ? st.y - 2 : st.y + st.h - 1, w, h: 3 }, 'hall');
    if (!node) return null;
    b.door(st, node);
    b.strip(node, side, pods, node.x);
  }
  const west = [...reactorPods(plan), ...plan.cargo];
  const [wn, ws] = split(b, west, mirror);
  const wl = Math.max(runLen(wn), runLen(ws), 3);
  const ws0 = strutW(b, core, 1, wl);
  if (!ws0) return null;
  struts.push(ws0);
  b.strip(ws0, 'n', wn, ws0.x);
  b.strip(ws0, 's', ws, ws0.x);
  if (!engineRail(b, core, 1 + (plan.command.h > 3 ? 1 : 0), b.rng.int(s0, s1), enginePods(plan))) return null;
  return `hub, ${n.length}/${s.length} mounts${mirror ? ', mirrored' : ''}`;
}

/** Parallel rails joined by spanning pods and cross struts; mounts hang off the outer rails; engines at rail ends. */
export function rails(b: Builder, f: FactionDef, plan: ShipPlan): string | null {
  const count = plan.size >= 3 ? 3 : 2;
  const gap = 4;
  const span = [{ ...plan.command, h: gap }, ...reactorPods(plan).map((r) => ({ ...r, h: gap })), ...plan.cargo.map((c) => ({ ...c, h: gap }))];
  const [top, bottom] = split(b, turretsOf(plan), b.rng.chance(f.architecture.symmetry));
  const bands: RoomSpec[][] = Array.from({ length: count - 1 }, () => []);
  span.forEach((s, i) => (bands[i % bands.length] as RoomSpec[]).push(s));
  const bandLen = (specs: RoomSpec[]): number => runLen(specs, 1) + 4;
  const base = Math.max(runLen(top, 2), runLen(bottom, 2), ...bands.map(bandLen)) + 1;
  const railParts: Part[] = [];
  for (let i = 0; i < count; i++) {
    const x = b.rng.int(-2, 1);
    const r = b.place({ x, y: i * (gap + 3), w: base - x + b.rng.int(0, 4), h: 3 }, 'hall');
    if (!r) return null;
    railParts.push(r);
  }
  // Bands: spanning pods with doors to both rails, a cross strut first and between every two pods.
  bands.forEach((specs, i) => {
    const a = railParts[i] as Part;
    const c = railParts[i + 1] as Part;
    let x = Math.max(a.x, c.x) + 1;
    const cross = (): void => {
      const st = b.place({ x, y: a.y + 2, w: 3, h: gap + 2 }, 'hall');
      if (st) { b.door(a, st); b.door(c, st); }
      x += 2 + b.rng.int(1, 2);
    };
    cross();
    specs.forEach((s, k) => {
      const p = b.place({ x, y: a.y + 2, w: s.w + 2, h: gap + 2 }, s.role, s);
      if (p) { b.door(a, p); b.door(c, p); }
      x += s.w + 1 + b.rng.int(1, 2);
      if (k % 2 === 1) cross();
    });
  });
  const gapFn = (): number => b.rng.int(0, 2);
  b.strip(railParts[0] as Part, 'n', top, (railParts[0] as Part).x + 1, { gap: gapFn });
  b.strip(railParts[count - 1] as Part, 's', bottom, (railParts[count - 1] as Part).x + 1, { gap: gapFn });
  // Engines spread over the rail ends.
  const pods = enginePods(plan);
  let placed = 0;
  railParts.forEach((r, i) => {
    const k = Math.floor(pods.length / count) + (i < pods.length % count ? 1 : 0);
    if (k === 0) return;
    const e = engineSpec(k, 'w');
    const p = b.place({ x: r.x + r.w - 1, y: rowOf(r) - 1 - 2 * (k - 1), w: e.w + 2, h: e.h + 2 }, 'engine', e);
    if (p) { b.door(r, p); placed++; }
  });
  if (placed === 0) return null;
  return `rails x${count}, ${bands.reduce((t, x) => t + x.length, 0)} spanning pods`;
}

/** Distributed clusters (junction + pods) linked by long thin struts; the core is one cluster, engines the last. */
export function clusters(b: Builder, f: FactionDef, plan: ShipPlan): string | null {
  const [s0, s1] = f.architecture.strutLength;
  const k = Math.min(4, 2 + Math.floor(plan.size / 2));
  const coreAt = Math.max(0, Math.floor((k - 1) / 2));
  const groups: RoomSpec[][] = Array.from({ length: k }, () => []);
  const turrets = turretsOf(plan);
  turrets.forEach((t, i) => (groups[i % Math.max(1, k - 1)] as RoomSpec[]).push(t));
  plan.cargo.forEach((c) => (groups[coreAt] as RoomSpec[]).push(c));
  let prev: Part | null = null;
  let reach = 0;
  for (let i = 0; i < k; i++) {
    const last = i === k - 1;
    const pods = groups[i] as RoomSpec[];
    const [n, s] = split(b, pods, b.rng.chance(f.architecture.symmetry));
    if (i === coreAt) n.unshift(plan.command);
    let junction: Part | null;
    if (last) {
      const row = prev ? b.rng.int(prev.y + 1, prev.y + prev.h - 2) : 0;
      const engines = enginePods(plan);
      const st = prev ? strutE(b, prev, row, Math.max(2, reach - (prev.x + prev.w - 1)) + b.rng.int(s0, s1)) : null;
      const x = st ? st.x + st.w - 1 : 0;
      const h = stackLen(engines);
      junction = b.place({ x, y: row - b.rng.int(1, h - 2), w: 3, h }, 'hall');
      if (!junction) return null;
      if (st) b.door(st, junction);
      if (eastStack(b, junction, engines, junction.y).length === 0) return null;
      const reactors = reactorPods(plan);
      const half = Math.ceil(reactors.length / 2);
      b.strip(junction, 'n', reactors.slice(0, half), junction.x + 2 - runLen(reactors.slice(0, half)) + 1);
      b.strip(junction, 's', reactors.slice(half), junction.x + 2 - runLen(reactors.slice(half)) + 1);
      continue;
    }
    const spec = hall(Math.max(3, runLen(n) - 2, runLen(s) - 2), b.rng.int(1, 3));
    if (!prev) junction = b.room(spec, 0, 0);
    else {
      const row = b.rng.int(prev.y + 1, prev.y + prev.h - 2);
      const st = strutE(b, prev, row, Math.max(0, reach - (prev.x + prev.w - 1)) + b.rng.int(s0, s1));
      if (!st) return null;
      const y = row - 1 - b.rng.int(0, spec.h - 1);
      junction = b.place({ x: st.x + st.w - 1, y, w: spec.w + 2, h: spec.h + 2 }, spec.role, spec);
      if (junction) b.door(st, junction);
    }
    if (!junction) return null;
    const pn = b.strip(junction, 'n', n, junction.x);
    const ps = b.strip(junction, 's', s, junction.x);
    reach = Math.max(junction.x + junction.w - 1, pn.x, ps.x);
    prev = junction;
  }
  return `clusters x${k}`;
}
