import type { Block } from './arranger';
import { blockFrom, localBuilder, type LocalPort } from './blocks';
import type { Builder, Part } from './builder';
import { doorRows } from './canvas';
import { dockSpec, engineSpec, reactorSpec, cargoSpec, type RoomSpec } from './plan';
import type { Rng } from '../rng';
import { hall, nose, stern, type pickNose } from './topoNavy';
import { runLen } from './topoParts';
import { depthAt, type Profile } from './profile';

/**
 * The navy's standard section vocabulary as blocks. Every section is mirrored about its own axis (rows -1 / 0) and
 * exposes ports: hall ends ('w', 'e'), hatches through its room bands ('hn', 'hs'), and the outer walls of its rooms
 * ('rn0'…, 'rs0'…) for grafts.
 */

const roomPorts = (parts: Part[], side: 'n' | 's'): LocalPort[] =>
  parts.filter((p) => p.role !== 'hall').map((p, i) => ({ id: `r${side}${i}`, side, x: p.x + 1, y: side === 'n' ? p.y : p.y + p.h - 1, len: p.w - 2, access: 'human' as const }));

/** Insert a hatch passage (a hall column through the band) in the middle of a room list. */
function withHatch(list: RoomSpec[], depth: number): RoomSpec[] {
  const out = [...list];
  out.splice(Math.ceil(out.length / 2), 0, { ...hall(2, depth), mods: [] });
  return out;
}

const hatchPort = (parts: Part[], side: 'n' | 's'): LocalPort[] => {
  const h = parts.find((p) => p.role === 'hall');
  return h ? [{ id: `h${side}`, side, x: h.x + 1, y: side === 'n' ? h.y : h.y + h.h - 1, len: h.w - 2, access: 'human' }] : [];
};

export interface SectionOpts {
  depth: number;
  hatchN?: boolean;
  hatchS?: boolean;
  sponson?: boolean;
}

/** Band section: a 2-wide hall on the axis, rooms side by side above and below. */
export function bandBlock(rng: Rng, kind: string, top: RoomSpec[], bottom: RoomSpec[], o: SectionOpts): Block | null {
  const b = localBuilder(rng);
  if (!o.sponson && [...top, ...bottom].some((s) => s.h > o.depth)) return null;
  const inner = (s: RoomSpec): RoomSpec => (o.sponson ? hall(s.w, 1) : { ...s, h: o.depth });
  let t = top.map(inner);
  let u = bottom.map(inner);
  const d = o.sponson ? 1 : o.depth;
  if (o.hatchN && !o.sponson) t = withHatch(t, d);
  if (o.hatchS && !o.sponson) u = withHatch(u, d);
  const W = Math.max(3, runLen(t) - 2, runLen(u) - 2);
  const h = b.place({ x: 0, y: -2, w: W + 2, h: 4 }, 'hall');
  if (!h) return null;
  const nt = b.strip(h, 'n', t, 0).parts;
  const ns = b.strip(h, 's', u, 0).parts;
  if (o.sponson) {
    nt.filter((p) => p.role === 'hall' && p.h === 3).forEach((p, i) => { const s = top[i]; if (s) b.attach(p, 'n', s, 0); });
    ns.filter((p) => p.role === 'hall' && p.h === 3).forEach((p, i) => { const s = bottom[i]; if (s) b.attach(p, 's', s, 0); });
  }
  const ports: LocalPort[] = [
    { id: 'w', side: 'w', x: 0, y: -1, len: 2, access: 'human' }, { id: 'e', side: 'e', x: W + 1, y: -1, len: 2, access: 'human' },
    ...(o.hatchN && !o.sponson ? hatchPort(nt, 'n') : []), ...(o.hatchS && !o.sponson ? hatchPort(ns, 's') : []),
    ...roomPorts(nt, 'n'), ...roomPorts(ns, 's'),
  ];
  return blockFrom(b, kind, `${kind}${o.sponson ? ' (sponsons)' : ''}`, 'human', ports);
}

/** Enclosed section (citadel, hangar deck): compartments on the axis, passages around them, rooms outboard. */
export function enclosedBlock(rng: Rng, kind: string, centreIn: RoomSpec[], extra: [RoomSpec[], RoomSpec[]], o: SectionOpts): Block | null {
  const b = localBuilder(rng);
  const centre = [...centreIn];
  let hc = Math.max(2, ...centre.map((s) => s.h));
  if (hc % 2 === 1) hc++;
  let [n, s] = extra;
  if (o.hatchN) n = withHatch(n, o.depth);
  if (o.hatchS) s = withHatch(s, o.depth);
  let L = Math.max(runLen(centre), runLen(n), runLen(s));
  if (L - runLen(centre) === 1) L += 2;
  if (L > runLen(centre)) centre.push({ ...cargoSpec(2), w: L - runLen(centre) - 1, h: hc });
  const top = -hc / 2 - 3;
  const tw = b.place({ x: 0, y: top, w: 3, h: hc + 6 }, 'hall');
  const pt = b.place({ x: 2, y: top, w: L, h: 3 }, 'hall');
  const pb = b.place({ x: 2, y: hc / 2, w: L, h: 3 }, 'hall');
  if (!tw || !pt || !pb) return null;
  b.door(tw, pt);
  b.door(tw, pb);
  let x = 2;
  for (const c of centre) {
    const p = b.place({ x, y: -hc / 2 - 1, w: c.w + 2, h: hc + 2 }, c.role, { ...c, h: hc });
    if (p) { b.door(pt, p); b.door(pb, p); }
    x += c.w + 1;
  }
  const te = b.place({ x: L + 1, y: top, w: 3, h: hc + 6 }, 'hall');
  if (!te) return null;
  b.door(pt, te);
  b.door(pb, te);
  const fit = (r: RoomSpec): RoomSpec => ({ ...r, h: Math.max(r.h, o.depth) });
  const nt = b.strip(pt, 'n', n.map(fit), 2).parts;
  const ns = b.strip(pb, 's', s.map(fit), 2).parts;
  const ports: LocalPort[] = [
    { id: 'w', side: 'w', x: 0, y: -1, len: 2, access: 'human' }, { id: 'e', side: 'e', x: L + 3, y: -1, len: 2, access: 'human' },
    ...(o.hatchN ? hatchPort(nt, 'n') : []), ...(o.hatchS ? hatchPort(ns, 's') : []),
    ...roomPorts(nt, 'n'), ...roomPorts(ns, 's'),
    // Without outboard rooms, the passages' outer walls are ports themselves.
    ...(nt.length === 0 ? [{ id: 'pn', side: 'n' as const, x: 3, y: top, len: L - 2, access: 'human' as const }] : []),
    ...(ns.length === 0 ? [{ id: 'ps', side: 's' as const, x: 3, y: hc / 2 + 2, len: L - 2, access: 'human' as const }] : []),
  ];
  return blockFrom(b, kind, `${kind} ${centreIn.map((c) => c.role[0]).join('')}`, 'human', ports);
}

/** Engines stacked mirrored about the axis on the east side of a rail at column x; returns the rail. */
function engineColumn(b: Builder, x: number, engines: number): Part | null {
  const e = engineSpec(1, 'w');
  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  let k = engines;
  let topY = 0;
  // Odd: a centre engine on the axis; even: the first pair meets at the axis (walls on rows -1 and 0).
  if (k % 2 === 1) { rooms.push({ x: x + 2, y: -3, w: e.w + 2, h: e.h + 2 }); topY = -3; k--; } else topY = -1;
  for (let i = 0; i < k / 2; i++) {
    const r = { x: x + 2, y: topY - (e.h + 1), w: e.w + 2, h: e.h + 2 };
    rooms.push(r, b.mir(r));
    topY = r.y;
  }
  const lo = Math.min(...rooms.map((r) => r.y));
  const rail = b.place({ x, y: lo, w: 3, h: -1 - 2 * lo + 1 }, 'hall');
  if (!rail) return null;
  for (const r of rooms) { const p = b.place(r, 'engine', e); if (p) b.door(rail, p); }
  return rail;
}

/** Transverse engineering bank (the v3 stern): engines outboard, reactors inboard, on a transverse hall. */
export function bankBlock(rng: Rng, engines: number, reactors: number): Block | null {
  const b = localBuilder(rng);
  if (stern(b, 0, [], engines, reactors).length === 0) return null;
  return blockFrom(b, 'drive', `bank ${engines}E`, 'human', [{ id: 'w', side: 'w', x: 0, y: -1, len: 2, access: 'human' }]);
}

/** Engine cluster on a stern spine: a hall aft with reactors either side, engines on a rail at its end. */
export function clusterBlock(rng: Rng, engines: number, reactors: number): Block | null {
  const b = localBuilder(rng);
  const r = Math.ceil(reactors / 2);
  const rs = reactorSpec(r);
  const L = rs.w + 2 + rng.int(0, 3);
  const spine = b.place({ x: 0, y: -2, w: L + 2, h: 4 }, 'hall');
  if (!spine) return null;
  const at = 1 + rng.int(0, L - rs.w - 1);
  b.strip(spine, 'n', [rs], at);
  b.strip(spine, 's', [rs], at);
  const rail = engineColumn(b, L + 1, engines);
  if (!rail) return null;
  b.door(spine, rail);
  return blockFrom(b, 'drive', `cluster ${engines}E`, 'human', [{ id: 'w', side: 'w', x: 0, y: -1, len: 2, access: 'human' }]);
}

/** Power section: reactors either side of a short hall. */
export function powerBlock(rng: Rng, reactors: number): Block | null {
  const r = Math.ceil(reactors / 2);
  return bandBlock(rng, 'power', [reactorSpec(r)], [reactorSpec(r)], { depth: 3, hatchN: true, hatchS: true });
}

/** An engine pod (k engines) entered from below: a nacelle. Mirror it for the other side. */
export function podBlock(rng: Rng, k: number): Block {
  const b = localBuilder(rng);
  const e = engineSpec(k, 'ns');
  const p = b.place({ x: 0, y: 0, w: e.w + 2, h: e.h + 2 }, 'engine', e) as Part;
  return blockFrom(b, 'drive', `pod ${k}E`, 'human', [{ id: 's', side: 's', x: 1, y: p.h - 1, len: e.w, access: 'human' }]);
}

/** A docking port room (airlock) grafted on an outer wall, entered from below. */
export function dockBlock(rng: Rng): Block {
  const b = localBuilder(rng);
  const s = dockSpec();
  b.place({ x: 0, y: 0, w: s.w + 2, h: s.h + 2 }, 'dock', s);
  return blockFrom(b, 'dock', 'dock', 'human', [{ id: 's', side: 's', x: 1 + (s.w >> 1), y: s.h + 1, len: 1, access: 'human' }]);
}

/** The command nose: the hand-made chunk with its doors on the axis rows. */
export function noseBlock(rng: Rng, front: ReturnType<typeof pickNose>): Block | null {
  const b = localBuilder(rng);
  if (!nose(b, front, 0)) return null;
  const dr = doorRows(front.c, 'last');
  return blockFrom(b, 'command', 'command', 'human', [{ id: 'e', side: 'e', x: 0, y: -1, len: dr.length, access: 'human' }]);
}

/**
 * An outboard deck: a 2-wide hall running fore and aft with one band of rooms on its outer (north) side, attached
 * lengthways along a host through its inner wall ('xs'); mirror it for the south side. Decks give parallel layers.
 */
export function deckBlock(rng: Rng, kind: string, roomsIn: RoomSpec[], depth: number, minLen = 0, profile?: Profile): Block | null {
  const b = localBuilder(rng);
  const d = Math.max(depth, ...roomsIn.map((r) => r.h));
  // A deck stretched to `minLen` (the length it runs along its host) widens its rooms, not its corridor.
  const rooms = roomsIn.map((r) => ({ ...r }));
  for (let extra = minLen - runLen(rooms), i = 0; extra > 0 && rooms.length > 0; extra--, i++) (rooms[i % rooms.length] as RoomSpec).w++;
  const L = Math.max(5, runLen(rooms), minLen);
  const h = b.place({ x: 0, y: 0, w: L, h: 4 }, 'hall');
  if (!h) return null;
  // A profiled deck steps its outer edge along its length (room by room); otherwise one depth throughout.
  let x = 1;
  const deep = rooms.map((r) => {
    const t = (x + r.w / 2) / L;
    x += r.w + 1;
    return { ...r, h: profile ? Math.max(r.h, depthAt(profile, t)) : d };
  });
  const parts = b.strip(h, 'n', deep, 0).parts;
  const ports: LocalPort[] = [
    { id: 'xs', side: 's', x: 1, y: 3, len: L - 2, access: 'human' },
    { id: 'w', side: 'w', x: 0, y: 1, len: 2, access: 'human' }, { id: 'e', side: 'e', x: L - 1, y: 1, len: 2, access: 'human' },
    ...roomPorts(parts, 'n'),
  ];
  return blockFrom(b, kind, `${kind} deck`, 'human', ports);
}
