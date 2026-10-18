import { mirrorBlock, type Block, type Side } from './arranger';
import { hallBlock } from './blocks';
import type { Builder } from './builder';
import { barge, cockpit, containers, habitat, liner, podString, station } from './civilBlocks';
import { beam } from './droneBlocks';
import { bankBlock, dockBlock } from './navyBlocks';
import { jobs, no, type Ctx } from './navyKit';
import { mountGuns } from './navyMounts';
import type { RoomSpec } from './plan';
import { freeze } from './salvage';
import type { CivilGrammar, FactionDef } from './types';

/**
 * Civilian grammars on the shared arranger, from the shared civil builders (`civilBlocks.ts`, also the scrappers'
 * donors). Lightly armed: point defence in the core room, the odd single light gun on a sponson.
 *   freighter  a cockpit, a long spine of cargo containers, the drive
 *   liner      a cockpit, a train of passenger segments (lounge bulbs and cabin rows), the drive
 *   mining     an exposed rig of beam arms fore, a cockpit, ore hopper barges, the drive
 *   station    a square hub with docking arms on three faces, cargo pods and a habitat, a small drive
 */

const civil = (b: Builder | null, kind: string, label: string): Block | null => (b ? freeze(b, kind, label, 'civil') : null);

const OPP: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };
/** A block's corridor-end port on a side (civil sections join corridor to corridor: one straight run). */
const hallPort = (b: Block, side: Side): string | undefined => b.ports.find((p) => p.side === side && (p.id.startsWith('h') || p.id === side))?.id;

/** Join `blk` aft of `host` (or on another face), corridor end to corridor end where both have one. */
function join(c: Ctx, host: number, blk: Block | null, side: Side = 'e'): number | null {
  if (!blk) return null;
  const pp = hallPort((c.A.placed[host] as { block: Block }).block, side);
  const cp = hallPort(blk, OPP[side]);
  const straight = c.A.attach(host, blk, { side, align: 'mid', ...(pp ? { parentPort: pp } : {}), ...(cp ? { childPort: cp } : {}) });
  return straight ?? c.A.attach(host, blk, { side, align: 'mid' });
}

/** The drive at the stern: a bank of the plan's engines and reactors. */
function stern(c: Ctx, host: number): boolean {
  const d = bankBlock(c.rng, c.plan.engines, c.plan.reactors);
  return join(c, host, d) !== null || no(c, 'drive');
}

/** The odd light gun: sponsons on the given hosts (spread). */
const arms = (c: Ctx, hosts: number[], guns: RoomSpec[]): boolean =>
  guns.length === 0 || mountGuns(c, hosts.map((h) => ({ n: h, s: h })), guns, { cluster: 'spread' }).length === 0 || no(c, 'guns');

const cratesOf = (stores: RoomSpec[]): number => stores.reduce((t, r) => t + r.mods.length, 0);

/** Freighter: a cockpit with the crew beside its stub, then cargo containers strung along a spine, the drive. */
function freighter(c: Ctx): boolean {
  const j = jobs(c.plan);
  const bow = civil(cockpit(c.rng, c.plan.command, [...j.core, ...j.crew]), 'command', 'cockpit');
  if (!bow) return no(c, 'cockpit');
  const root = c.A.placeRoot(bow);
  const crates = Math.max(4, cratesOf(j.stores));
  // The container train: one to three spines (at least six crates each), container size, spacing and stacking
  // drawn per ship.
  const halves = c.rng.int(1, Math.max(1, Math.min(3, Math.floor(crates / 6))));
  let host = root;
  const spines: number[] = [];
  const size = c.rng.int(3, 5);
  // Gap 2+ leaves open space between containers (1 only doubles the wall).
  const gap = c.rng.int(2, 3);
  const stagger = c.rng.chance(0.4) ? Math.ceil((size + 1 + gap) / 2) : 0;
  for (let i = 0; i < halves; i++) {
    const sp = join(c, host, civil(containers(c.rng, Math.ceil(crates / halves), size, gap, stagger), 'cargo', 'containers'));
    if (sp === null) return no(c, 'containers');
    spines.push(sp);
    host = sp;
  }
  c.parts.push(`containers ${crates}`);
  return stern(c, host) && arms(c, spines, j.guns);
}

/** Liner: a cockpit, then passenger segments (a lounge bulb and a cabin row each), the drive. */
function linerHull(c: Ctx): boolean {
  const j = jobs(c.plan);
  const docks = j.crew.filter((r) => r.role === 'dock');
  const bow = civil(cockpit(c.rng, c.plan.command, [...j.core, ...docks, ...j.stores]), 'command', 'cockpit');
  if (!bow) return no(c, 'cockpit');
  let host = c.A.placeRoot(bow);
  const quarters = c.plan.quarters;
  const support = c.plan.support;
  // One to three passenger segments, cabin size and lounge bulbs drawn per ship.
  const k = c.rng.int(1, Math.max(1, Math.min(3, quarters.length)));
  const cabin: [number, number] = c.rng.pick([[2, 2], [2, 3], [3, 2]] as [number, number][]);
  const bulb = c.rng.int(5, 9);
  const segs: number[] = [];
  for (let i = 0; i < k; i++) {
    const q = quarters.filter((_, n) => n % k === i);
    const beds = q.reduce((t, r) => t + r.mods.filter((m) => m === 'module.bed').length, 0);
    const ls = q.flatMap((r) => r.mods.filter((m) => m !== 'module.bed'));
    const lounge: RoomSpec = { role: 'support', mods: [...ls, ...(support[i]?.mods ?? [])], w: c.rng.int(3, 5), h: bulb };
    const seg = join(c, host, civil(liner(c.rng, Math.max(2, beds), lounge, cabin, bulb), 'habitat', 'passenger segment'));
    if (seg === null) return no(c, 'segment');
    segs.push(seg);
    host = seg;
  }
  // Support rooms beyond the segments' lounges ride in an extra lounge-only segment.
  for (const s of support.slice(k)) {
    const seg = join(c, host, civil(liner(c.rng, 2, { ...s, w: 4, h: bulb }, cabin, bulb), 'habitat', 'passenger segment'));
    if (seg === null) return no(c, 'segment');
    host = seg;
  }
  c.parts.push(`segments ${k}`);
  return stern(c, host) && arms(c, segs, j.guns);
}

/** Mining ship: an exposed rig of beam arms fore, the cockpit, ore hopper barges, the drive. */
function mining(c: Ctx): boolean {
  const j = jobs(c.plan);
  const bow = civil(cockpit(c.rng, c.plan.command, [...j.core, ...j.crew]), 'command', 'cockpit');
  if (!bow) return no(c, 'cockpit');
  const root = c.A.placeRoot(bow);
  // The rig: a cross piece on the bow and two (or three) arms reaching forward.
  const spread = c.rng.int(5, 8);
  const cross = c.A.attach(root, beam(c.rng, 2 * spread + 1, 1, false), { side: 'w', align: 'mid', doors: 0, kind: 'beam' });
  if (cross === null) return no(c, 'rig');
  const reach = c.rng.int(6, 10);
  for (const a of c.rng.chance(0.4) ? (['start', 'mid', 'end'] as const) : (['start', 'end'] as const)) {
    if (c.A.attach(cross, beam(c.rng, reach, c.rng.int(1, 2), true), { side: 'w', align: a, doors: 0, kind: 'beam' }) === null) return no(c, 'rig arm');
  }
  const crates = Math.max(6, cratesOf(j.stores));
  const n = crates > 16 ? 2 : 1;
  let host = root;
  const holds: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = join(c, host, civil(barge(c.rng, Math.ceil(crates / n)), 'cargo', 'ore holds'));
    if (h === null) return no(c, 'holds');
    holds.push(h);
    host = h;
  }
  c.parts.push(`rig ${reach} holds ${n}`);
  return stern(c, host) && arms(c, holds, j.guns);
}

/** Station: a square hub, docking arms with airlocks on its faces, cargo pods and a habitat, a small drive. */
function stationHub(c: Ctx): boolean {
  const j = jobs(c.plan);
  const crew = j.crew.filter((r) => r.role !== 'dock');
  const hubRooms = [c.plan.command, ...j.core.slice(0, 2), ...crew.splice(0, 1)].slice(0, 4);
  const hub = civil(station(c.rng, hubRooms), 'command', 'station hub');
  if (!hub) return no(c, 'hub');
  const root = c.A.placeRoot(hub);
  // Radial: docking arms up and down (an airlock at each end), cargo pods fore, the habitat ring and drive aft.
  for (const side of ['n', 's'] as const) {
    const arm = c.A.attach(root, hallBlock(c.rng, c.rng.int(3, 7), 1, false), { side, align: 'mid' });
    const d = side === 'n' ? dockBlock(c.rng) : mirrorBlock(dockBlock(c.rng));
    if (arm === null || c.A.attach(arm, d, { side, align: 'mid', doors: 1 }) === null) return no(c, 'docking arm');
  }
  const pods = civil(podString(c.rng, Math.max(4, cratesOf(j.stores))), 'cargo', 'cargo pods');
  if (join(c, root, pods, 'w') === null) return no(c, 'pods');
  let aft = root;
  if (crew.length > 0) {
    const hubR = crew.find((r) => r.role === 'support') ?? (crew[0] as RoomSpec);
    const rest = [...crew.filter((r) => r !== hubR), ...j.core.slice(2)];
    const hab = join(c, root, civil(habitat(c.rng, hubR, rest.filter((_, i) => i % 2 === 0), rest.filter((_, i) => i % 2 === 1)), 'habitat', 'habitat ring'));
    if (hab === null) return no(c, 'habitat');
    aft = hab;
  }
  c.parts.push('station');
  return stern(c, aft) && arms(c, [root], j.guns);
}

export const CIVIL_GRAMMARS: Record<CivilGrammar, (c: Ctx, f: FactionDef) => boolean> = {
  freighter: (c) => freighter(c), liner: (c) => linerHull(c), mining: (c) => mining(c), station: (c) => stationHub(c),
};
