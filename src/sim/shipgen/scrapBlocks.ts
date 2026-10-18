import { Arranger, mirrorBlock, type Block } from './arranger';
import { blockFrom, localBuilder, type LocalPort } from './blocks';
import { Builder } from './builder';
import { crawl, sealedPod } from './droneBlocks';
import { bandBlock, bankBlock, noseBlock } from './navyBlocks';
import { cargoSpec, engineSpec, reactorSpec, type RoomSpec } from './plan';
import type { Part } from './builder';
import type { Rng } from '../rng';

/**
 * Salvage donors: whole sections cut from other builders' ships, each keeping its own geometry, layout and
 * construction style, tagged with its origin. Navy pieces come from the navy blocks themselves, the drone weapon
 * cluster is a small drone arrangement frozen into one block, the civil and mining pieces are hand-made.
 */

const tag = (b: Block, donor: string, label: string): Block => ({ ...b, donor, label: `${donor}: ${label}` });

/** Navy bow cut-out: the hand-made nose chunk with the scrapper's bridge in it. */
export function navyBow(rng: Rng, front: Parameters<typeof noseBlock>[1]): Block | null {
  const b = noseBlock(rng, front);
  return b && tag(b, 'navy', 'bow');
}

/** Navy drive cut-out: the transverse engineering bank (engines and reactors). */
export function navyDrive(rng: Rng, engines: number, reactors: number): Block | null {
  const b = bankBlock(rng, engines, reactors);
  return b && tag(b, 'navy', 'drive');
}

/** Navy battery cut-out: a mirrored gun section, room ports on both faces. */
export function navyBattery(rng: Rng, guns: RoomSpec[]): Block | null {
  const half = Math.ceil(guns.length / 2);
  const b = bandBlock(rng, 'battery', guns.slice(0, half), guns.slice(half), { depth: Math.max(3, ...guns.map((g) => g.h)), hatchN: true, hatchS: true });
  return b && tag(b, 'navy', 'battery');
}

const run = (specs: RoomSpec[]): number => specs.reduce((t, r) => t + r.w + 1, 1);
const outer = (parts: Part[], side: 'n' | 's', pre: string): LocalPort[] =>
  parts.filter((p) => p.role !== 'hall').map((p, i) => ({ id: `${pre}${i}`, side, x: p.x + 1, y: side === 'n' ? p.y : p.y + p.h - 1, len: p.w - 2, access: 'human' as const }));
/** Bare hull wall left over after a strip of rooms, as a graft port. */
const bare = (id: string, side: 'n' | 's', from: number, to: number, y: number): LocalPort[] =>
  to - from >= 2 ? [{ id, side, x: from, y, len: to - from, access: 'human' }] : [];

/**
 * Civil bulk freighter: one big open cargo bay under a 2-wide gangway, the shuttle bay and service rooms on the
 * gangway's far side. No hatches, no band of matching rooms: one huge box and a walkway.
 */
export function freighterHold(rng: Rng, north: RoomSpec[], crates: number, south: RoomSpec[]): Block | null {
  const b = localBuilder(rng);
  const bay: RoomSpec = { ...cargoSpec(crates), w: Math.max(6, Math.ceil(crates / 3) + 2), h: 5 };
  const W = Math.max(10, run(north), bay.w + 1 + run(south));
  const g = b.place({ x: 0, y: -2, w: W, h: 4 }, 'hall');
  if (!g) return null;
  const bx = b.place({ x: 0, y: 1, w: bay.w + 2, h: bay.h + 2 }, 'cargo', bay);
  if (!bx) return null;
  b.door(g, bx);
  const n = b.strip(g, 'n', north, 0);
  const s = b.strip(g, 's', south, bay.w + 1);
  const ports: LocalPort[] = [
    { id: 'w', side: 'w', x: 0, y: -1, len: 2, access: 'human' }, { id: 'e', side: 'e', x: W - 1, y: -1, len: 2, access: 'human' },
    ...outer(n.parts, 'n', 'rn'), ...bare('hn', 'n', n.x + 1, W - 1, -2),
    { id: 'bay', side: 's', x: 1, y: bx.y + bx.h - 1, len: bay.w, access: 'human' },
    ...outer(s.parts, 's', 'rs'), ...bare('hs', 's', s.x + 1, W - 1, 1),
  ];
  return tag(blockFrom(b, 'hold', 'hold', 'human', ports), 'civil', 'freighter');
}

/**
 * Civil habitat: a ring corridor round a central hub room (mess, medbay), cabins and airlocks outboard of the ring.
 */
export function habitat(rng: Rng, hub: RoomSpec, top: RoomSpec[], bottom: RoomSpec[]): Block | null {
  const b = localBuilder(rng);
  const W = Math.max(hub.w + 6, run(top) + 4, run(bottom) + 4, 10);
  const th = b.place({ x: 2, y: -5, w: W - 4, h: 3 }, 'hall');
  const hb = b.place({ x: 2, y: -3, w: W - 4, h: 6 }, hub.role, hub);
  const bh = b.place({ x: 2, y: 2, w: W - 4, h: 3 }, 'hall');
  const cw = b.place({ x: 0, y: -5, w: 3, h: 10 }, 'hall');
  const ce = b.place({ x: W - 3, y: -5, w: 3, h: 10 }, 'hall');
  if (!th || !hb || !bh || !cw || !ce) return null;
  for (const [a, c] of [[cw, th], [cw, bh], [ce, th], [ce, bh], [th, hb]] as const) b.door(a, c);
  const n = b.strip(th, 'n', top, 2);
  const s = b.strip(bh, 's', bottom, 2);
  const ports: LocalPort[] = [
    { id: 'w', side: 'w', x: 0, y: -1, len: 2, access: 'human' }, { id: 'e', side: 'e', x: W - 1, y: -1, len: 2, access: 'human' },
    ...outer(n.parts, 'n', 'rn'), ...bare('hn', 'n', n.x + 1, W - 3, -5),
    ...outer(s.parts, 's', 'rs'), ...bare('hs', 's', s.x + 1, W - 3, 4),
  ];
  return tag(blockFrom(b, 'habitat', 'habitat', 'human', ports), 'civil', 'habitat ring');
}

/** Mining tug: a stubby hull with an ore hopper, a reactor and one big engine aft. */
export function miningTug(rng: Rng, hopper: RoomSpec): Block | null {
  const b = localBuilder(rng);
  const r = reactorSpec(1);
  const L = Math.max(r.w, hopper.w) + 3;
  const h = b.place({ x: 0, y: -2, w: L + 2, h: 4 }, 'hall');
  if (!h) return null;
  const top = b.strip(h, 'n', [{ ...r, h: 3 }], 1).parts;
  const bot = b.strip(h, 's', [{ ...hopper, h: Math.max(3, hopper.h) }], 1).parts;
  const e = engineSpec(1, 'w');
  const eng = b.place({ x: L + 1, y: -3, w: e.w + 2, h: e.h + 2 }, 'engine', e);
  if (eng) b.door(h, eng);
  const ports: LocalPort[] = [
    { id: 'w', side: 'w', x: 0, y: -1, len: 2, access: 'human' },
    ...top.map((p, i) => ({ id: `rn${i}`, side: 'n' as const, x: p.x + 1, y: p.y, len: p.w - 2, access: 'human' as const })),
    ...bot.map((p, i) => ({ id: `rs${i}`, side: 's' as const, x: p.x + 1, y: p.y + p.h - 1, len: p.w - 2, access: 'human' as const })),
  ];
  return tag(blockFrom(b, 'tug', 'tug', 'human', ports), 'mining', 'tug');
}

/**
 * Drone weapon cluster: a crawl node with sealed gun pods on its outer side and a crawl stub down to the graft
 * point ('s'); mirror it to graft from above.
 */
export function droneCluster(rng: Rng, guns: RoomSpec[]): Block | null {
  const A = new Arranger(() => rng.next(), -1);
  const node = A.placeRoot(crawl(rng, Math.max(4, guns.reduce((t, g) => t + g.w + 1, 0)), true));
  for (const g of guns) if (A.attach(node, sealedPod(rng, 'weapons pod', g), { side: 'n', align: 'any', doors: 0 }) === null) return null;
  const stub = A.attach(node, crawl(rng, rng.int(1, 2), false), { side: 's', align: 'mid', doors: 1 });
  if (stub === null) return null;
  const b = new Builder(rng, -1);
  A.stamp(b);
  const s = A.bounds(stub);
  // Block bounds include a one-tile margin: the stub's interior column is x + 2, its bottom wall h - 2 down.
  return tag(blockFrom(b, 'guns', 'guns', 'robot', [{ id: 's', side: 's', x: s.x + 2, y: s.y + s.h - 2, len: 1, access: 'robot' }]), 'drone', 'weapon cluster');
}

export { mirrorBlock };
