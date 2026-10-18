import { mirrorBlock, type Block, type Side } from './arranger';
import { blockFrom, localBuilder } from './blocks';
import { Builder } from './builder';
import { noseBlock } from './navyBlocks';
import { bands, chain, deckPair, evenDepth, jobs, no, order, propulsion, spanOf, type Ctx } from './navyKit';
import type { RoomSpec } from './plan';
import { pickNose } from './topoNavy';
import type { FactionDef } from './types';

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
const self = (id: number): Host => ({ n: id, s: id });

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

const nose = (c: Ctx, f: FactionDef): number | null => {
  const front = noseBlock(c.rng, pickNose(new Builder(c.rng), f, c.plan));
  return front ? c.A.placeRoot(front) : null;
};

/** Split guns: heavy ones (3x3 mounts) always in sponsons; light ones flush in the hull or in sponsons. */
function split(c: Ctx, guns: RoomSpec[]): { flush: RoomSpec[]; mounts: RoomSpec[] } {
  const flushShare = c.rng.pick([0, 0, 0.5, 1]);
  const flush: RoomSpec[] = [];
  const mounts: RoomSpec[] = [];
  for (const g of guns) (g.h <= 3 && c.rng.next() < flushShare ? flush : mounts).push(g);
  return { flush, mounts };
}

/**
 * Frigate / corvette: a slim spine of crew, core and stores (airlocks in its faces), the guns grafted along its
 * flanks as sponsons, light ones sometimes flush in a band section near the bow.
 */
export function spineMounts(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const { flush, mounts } = split(c, j.guns);
  const per = c.rng.chance(0.6) ? 1 : 2;
  const spine = [...bands('battery', flush, 1), ...order(c.rng, bands('core', [...j.core, ...j.stores, ...j.crew], per))];
  evenDepth(c, ['core', 'cargo']);
  const ids = chain(c, root, spine, -1);
  if (!ids) return false;
  if (!propulsion(c, ids[ids.length - 1] as number, c.rng.pick(c.fam.propulsion.filter((p) => p !== 'wingPods')))) return false;
  const hosts = ids.filter((_, i) => spine[i]?.kind !== 'battery').map(self);
  return mountGuns(c, hosts, mounts).length === 0 || no(c, 'mounts');
}

/**
 * Battleship (layered cruiser): a long spine, crew decks along its middle (the raised citadel line), sponson rows on
 * the decks' outer walls and on the spine fore and aft of them: several rows of mounts down a long hull.
 */
export function battleship(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const docks = j.crew.filter((r) => r.role === 'dock');
  const crew = j.crew.filter((r) => r.role !== 'dock');
  // A short raised citadel amidships (one room a side); the rest of the crew lengthens the spine.
  const deckCrew = crew.slice(0, 2);
  const spine = order(c.rng, bands('core', [...j.core, ...j.stores, ...docks, ...crew.slice(2)], 1));
  evenDepth(c, ['core', 'cargo']);
  const ids = chain(c, root, spine, Math.floor(spine.length / 2));
  if (!ids) return false;
  if (!propulsion(c, ids[ids.length - 1] as number, c.rng.pick(c.fam.propulsion))) return false;
  // The citadel: crew decks over the middle third of the spine.
  const a = Math.floor(ids.length / 3);
  const z = Math.max(a, ids.length - 1 - Math.floor(ids.length / 3));
  const mid = ids.slice(a, z + 1);
  const host = ids[Math.floor(spine.length / 2)] as number;
  const decks = deckCrew.length > 0 ? deckPair(c, host, host, 'citadel', deckCrew, 'start', spanOf(c, mid)) : null;
  if (deckCrew.length > 0 && !decks) return no(c, 'citadel decks');
  // Sponson rows: heavy guns on the citadel decks, the rest on the spine fore and aft of them.
  const heavy = j.guns.filter((g) => g.h >= 4 || c.rng.chance(0.4));
  const light = j.guns.filter((g) => !heavy.includes(g));
  const left = decks ? mountGuns(c, [{ n: decks[0], s: decks[1] }], heavy, { paired: true, cluster: 'spread' }) : heavy;
  const ends = ids.filter((id) => !mid.includes(id));
  return mountGuns(c, (ends.length > 0 ? ends : ids).map(self), [...left, ...light], { cluster: 'spread' }).length === 0 || no(c, 'mounts');
}
