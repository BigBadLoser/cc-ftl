import { bands, jobs, no, propulsion, type Ctx, type SectionPlan } from './navyKit';
import { mountGuns, type Cluster, type Host } from './navyMounts';
import type { RoomSpec } from './plan';
import { Builder } from './builder';
import { bandBlock, noseBlock } from './navyBlocks';
import { pickNose } from './topoNavy';
import type { FactionDef } from './types';

/**
 * Proof of concept: parametric structural components between the functional assemblies and the arranger.
 *   hull spine   a run of band sections whose depth follows a PROFILE (taper, plateau, peak position), so the hull
 *                outline is one designed curve rather than whatever depth each section's rooms needed
 *   sockets      the spine's flanks, ranked by where the profile is narrow or broad
 *   sponsons     a family: FLUSH (the gun room sits in a spine section, its face on the hull line) or BULGED (a
 *                one-mount block grafted on a socket)
 * Battleships and frigates are rebuilt from these; everything else is unchanged.
 */

/** A hull profile: interior depth of the band rooms along the spine (t = 0 bow .. 1 stern). */
export interface Profile {
  lo: number;
  hi: number;
  /** Where the hull is broadest, and over how long a stretch (fractions of the spine). */
  peak: number;
  plateau: number;
}

export function depthAt(p: Profile, t: number): number {
  const off = Math.max(0, Math.abs(t - p.peak) - p.plateau / 2);
  const reach = Math.max(1e-3, Math.max(p.peak, 1 - p.peak) - p.plateau / 2);
  return Math.round(p.hi - (p.hi - p.lo) * Math.min(1, off / reach));
}

/** Spine sections fore to aft with their profile depth; flush guns go into the sections the cluster names. */
export function hullSpine(c: Ctx, from: number, rooms: RoomSpec[], per: number, p: Profile, flush: RoomSpec[], cluster: Cluster): { ids: number[]; depth: number[] } | null {
  const secs: SectionPlan[] = bands('core', rooms, per);
  const n = secs.length + flush.length;
  // Flush gun sections slot in where the cluster wants them (the bow, amidships, aft, or spread).
  const at = (k: number): number => {
    const f = cluster === 'fore' ? 0.15 : cluster === 'aft' ? 0.85 : cluster === 'mid' ? 0.5 : (k + 0.5) / Math.max(1, flush.length);
    return Math.round(f * (n - 1));
  };
  const plan: SectionPlan[] = [...secs];
  flush.forEach((g, k) => plan.splice(Math.min(plan.length, at(k)), 0, { kind: 'battery', top: [g], bottom: [], sponson: false }));
  const ids: number[] = [];
  const depth: number[] = [];
  let prev = from;
  for (let i = 0; i < plan.length; i++) {
    const sp = plan[i] as SectionPlan;
    const t = plan.length > 1 ? i / (plan.length - 1) : 0.5;
    const d = Math.max(depthAt(p, t), ...[...sp.top, ...sp.bottom].map((r) => r.h));
    // A lone flush gun is mirrored by its own twin face: the band gets the gun on one side, a store on the other.
    const bottom = sp.bottom.length > 0 || sp.kind !== 'battery' ? sp.bottom : [{ role: 'cargo' as const, mods: ['module.storage'], w: (sp.top[0] as RoomSpec).w, h: 2, stock: true }];
    const blk = bandBlock(c.rng, sp.kind, sp.top, bottom, { depth: d });
    const id = blk ? c.A.attach(prev, blk, { side: 'e' }) : null;
    if (id === null) { no(c, `spine ${i}`); return null; }
    ids.push(id);
    depth.push(d);
    prev = id;
  }
  c.parts.push(`spine ${plan.length} (${depth.join('')})`);
  return { ids, depth };
}

const nose = (c: Ctx, f: FactionDef): number | null => {
  const front = noseBlock(c.rng, pickNose(new Builder(c.rng), f, c.plan));
  return front ? c.A.placeRoot(front) : null;
};

/** Sockets on the spine, narrow (low profile) first: bulged sponsons there even the outline out. */
const sockets = (ids: number[], depth: number[], narrowFirst: boolean): Host[] =>
  ids.map((id, i) => ({ id, d: depth[i] as number, i })).sort((a, b) => (narrowFirst ? a.d - b.d : b.d - a.d) || a.i - b.i).map((x) => ({ n: x.id, s: x.id }));

/** Frigate from components: a tapered spine (broadest forward or amidships), light guns flush, heavy ones bulged. */
export function componentFrigate(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const p: Profile = { lo: 3, hi: c.rng.int(3, 4), peak: c.rng.next() * 0.5 + 0.2, plateau: c.rng.next() * 0.5 };
  const cluster = c.rng.pick(['spread', 'fore', 'mid', 'aft'] as const);
  const light = j.guns.filter((g) => g.h <= 3 && g.mods.length === 1);
  const flush = light.filter(() => c.rng.chance(0.5));
  const bulged = j.guns.filter((g) => !flush.includes(g));
  const sp = hullSpine(c, root, [...j.core, ...j.stores, ...j.crew], c.rng.chance(0.6) ? 1 : 2, p, flush, cluster);
  if (!sp) return false;
  if (!propulsion(c, sp.ids[sp.ids.length - 1] as number, c.rng.pick(c.fam.propulsion.filter((x) => x !== 'wingPods')))) return false;
  return mountGuns(c, sockets(sp.ids, sp.depth, c.rng.chance(0.5)), bulged, { cluster, keepOrder: true }).length === 0 || no(c, 'mounts');
}

/**
 * Battleship from components: a long spine with a raised citadel (a plateau of deep sections amidships tapering
 * gently to bow and stern), heavy turrets bulged on the narrow sections fore and aft of it, light guns flush along
 * the citadel.
 */
export function componentBattleship(c: Ctx, f: FactionDef): boolean {
  const root = nose(c, f);
  if (root === null) return no(c, 'nose');
  const j = jobs(c.plan);
  const p: Profile = { lo: 3, hi: c.rng.int(4, 5), peak: 0.45 + c.rng.next() * 0.1, plateau: 0.3 + c.rng.next() * 0.2 };
  const heavy = j.guns.filter((g) => g.h >= 4 || g.mods.length > 1);
  const light = j.guns.filter((g) => !heavy.includes(g));
  const sp = hullSpine(c, root, [...j.core, ...j.stores, ...j.crew], 1, p, light, 'mid');
  if (!sp) return false;
  if (!propulsion(c, sp.ids[sp.ids.length - 1] as number, c.rng.pick(c.fam.propulsion))) return false;
  // Turrets fore and aft of the citadel, in mirrored pairs where they fit.
  return mountGuns(c, sockets(sp.ids, sp.depth, true), heavy, { cluster: 'spread', paired: c.rng.chance(0.7), keepOrder: true }).length === 0 || no(c, 'turrets');
}
