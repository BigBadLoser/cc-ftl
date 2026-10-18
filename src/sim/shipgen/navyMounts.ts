import { mirrorBlock, type Block, type Side } from './arranger';
import { blockFrom, localBuilder } from './blocks';
import type { Ctx } from './navyKit';
import type { RoomSpec } from './plan';

/**
 * Navy guns as individual mounts: a slim hull of crew, core and systems, guns grafted onto its flanks one mount at
 * a time (sponsons), or flush in a band section where they are light. Where the mounts go is the seed's: spread at
 * intervals or clustered fore, amidships or aft; mirrored pairs or staggered. Gun faces stay open to space (the
 * arranger keeps them clear), airlocks stay in the hull face, engines face +x.
 */

/** A sponson: one gun room sized to its mount, entered from the hull through its inner (south) wall. */
export function mountBlock(rng: Parameters<typeof localBuilder>[0], spec: RoomSpec): Block {
  const b = localBuilder(rng);
  b.place({ x: 0, y: 0, w: spec.w + 2, h: spec.h + 2 }, 'weapons', spec);
  return blockFrom(b, 'mount', spec.h >= 4 ? 'heavy sponson' : 'sponson', 'human', [{ id: 's', side: 's', x: 1, y: spec.h + 1, len: spec.w, access: 'human' }]);
}

export type Cluster = 'spread' | 'fore' | 'mid' | 'aft';

/** A mount host: its north flank and its mirror's south flank (one block for a spine section, two for decks). */
export interface Host { n: number; s: number }

/** Hosts in the order this seed's mount layout wants them filled. */
function rank(c: Ctx, hosts: Host[], cluster: Cluster): Host[] {
  const n = hosts.length;
  const key = (i: number): number => {
    const t = n > 1 ? i / (n - 1) : 0.5;
    if (cluster === 'fore') return t;
    if (cluster === 'aft') return 1 - t;
    if (cluster === 'mid') return Math.abs(t - 0.5);
    // Spread: every other host first (gaps between mounts), then the rest.
    return (i % 2) + t * 0.1;
  };
  return hosts.map((h, i) => ({ h, k: key(i) + c.rng.next() * 0.05 })).sort((a, b) => a.k - b.k).map((x) => x.h);
}

/**
 * Graft guns onto the flanks of `hosts` (spine sections fore to aft). Mirrored pairs or staggered sides; returns the
 * guns that found no place.
 */
export function mountGuns(c: Ctx, hosts: Host[], guns: RoomSpec[], o: { cluster?: Cluster; paired?: boolean; keepOrder?: boolean } = {}): RoomSpec[] {
  const cluster = o.cluster ?? c.rng.pick(['spread', 'spread', 'fore', 'mid', 'aft'] as const);
  const paired = o.paired ?? c.rng.chance(0.5);
  const order_ = o.keepOrder ? hosts : rank(c, hosts, cluster);
  const left: RoomSpec[] = [];
  const queue = [...guns];
  let side: Side = c.rng.chance(0.5) ? 'n' : 's';
  while (queue.length > 0) {
    const g = queue.shift() as RoomSpec;
    const blk = mountBlock(c.rng, g);
    let ok = false;
    if (paired && queue.length > 0) {
      const h = queue[0] as RoomSpec;
      const twin = mountBlock(c.rng, h);
      for (const host of order_) {
        if (c.A.attachMirrored(host.n, host.s, blk, { side: 'n', align: 'mid', doors: 1 }, twin)) { ok = true; queue.shift(); break; }
      }
    }
    for (const host of ok ? [] : order_) {
      for (const s of [side, side === 'n' ? 's' : 'n'] as Side[]) {
        if (c.A.attach(s === 'n' ? host.n : host.s, s === 'n' ? blk : mirrorBlock(blk), { side: s, align: 'mid', doors: 1 }) !== null) { ok = true; break; }
      }
      if (ok) break;
    }
    side = side === 'n' ? 's' : 'n';
    if (!ok) left.push(g);
  }
  c.parts.push(`mounts ${cluster}${paired ? ' paired' : ''} ${guns.length - left.length}`);
  return left;
}
