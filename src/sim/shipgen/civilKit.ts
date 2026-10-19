import { mirrorBlock, type Block, type Side } from './arranger';
import type { Builder } from './builder';
import { cockpit, drive, type DriveStyle } from './civilBlocks';
import { no, type Ctx } from './navyKit';
import { mountGuns } from './navyMounts';
import type { RoomSpec } from './plan';
import type { Rng } from '../rng';
import { freeze } from './salvage';
import { localBuilder } from './blocks';

/** The civilian grammars' shared kit: joins, the light drive, guns, the cockpit, side-by-side bodies, variant picks. */

export const civil = (b: Builder | null, kind: string, label: string): Block | null => (b ? freeze(b, kind, label, 'civil') : null);
export const blockOf = (c: Ctx, i: number): Block => (c.A.placed[i] as { block: Block }).block;

export function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

const OPP: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };
/** A block's corridor-end port on a side (civil sections join corridor to corridor: one straight run). */
export const hallPort = (b: Block, side: Side): string | undefined => b.ports.find((p) => p.side === side && (p.id.startsWith('h') || p.id === side))?.id;

/** Join `blk` aft of `host` (or on another face), corridor end to corridor end where both have one. */
export function join(c: Ctx, host: number, blk: Block | null, side: Side = 'e'): number | null {
  if (!blk) return null;
  const pp = hallPort(blockOf(c, host), side);
  const cp = hallPort(blk, OPP[side]);
  const straight = c.A.attach(host, blk, { side, align: 'mid', ...(pp ? { parentPort: pp } : {}), ...(cp ? { childPort: cp } : {}) });
  return straight ?? c.A.attach(host, blk, { side, align: 'mid' });
}

/** The drive aft of `host`: a light civil drive in a seeded style, the first that is no taller than its host. */
export function stern(c: Ctx, host: number): boolean {
  const H = blockOf(c, host).rows.length;
  const styles = shuffle(c.rng, ['nozzle', 'pair', 'nacelles'] as DriveStyle[]);
  const built = styles.map((s) => civil(drive(c.rng, c.plan.engines, c.plan.reactors, s), 'drive', `${s} drive`)).filter((b): b is Block => !!b);
  const order = [...built.filter((b) => b.rows.length <= H), ...built.filter((b) => b.rows.length > H).sort((a, b) => a.rows.length - b.rows.length)];
  for (const d of order) if (join(c, host, d) !== null) { c.parts.push(d.label.replace('civil: ', '')); return true; }
  return no(c, 'drive');
}

/** The odd light gun: sponsons on the given hosts (spread). */
export const arms = (c: Ctx, hosts: number[], guns: RoomSpec[]): boolean =>
  guns.length === 0 || mountGuns(c, hosts.map((h) => ({ n: h, s: h })), guns, { cluster: 'spread' }).length === 0 || no(c, 'guns');

export const cratesOf = (stores: RoomSpec[]): number => stores.reduce((t, r) => t + r.mods.length, 0);

/** An empty observation room (a dome or blister), `w` x `h`. */
export function dome(rng: Rng, w: number, h: number): Block | null {
  const b = localBuilder(rng);
  return b.place({ x: 0, y: -1 - Math.ceil(h / 2), w: w + 2, h: h + 2 }, 'support', { role: 'support', mods: [], w, h }) ? freeze(b, 'observation', 'observation dome', 'civil') : null;
}

/** Pick a topology from the ship's variant draw (shared by every candidate arrangement of the ship). */
export function byVariant<T extends string>(c: Ctx, set: [T, number][]): T {
  const total = set.reduce((t, [, w]) => t + w, 0);
  let r = (c.variant ?? c.rng.next()) * total;
  for (const [t, w] of set) if ((r -= w) < 0) return t;
  return (set[set.length - 1] as [T, number])[0];
}

/** The crew block: the bridge with the crew rooms beside its stub. */
export function crewBlock(c: Ctx, rooms: RoomSpec[]): number | null {
  const bow = civil(cockpit(c.rng, c.plan.command, rooms), 'command', 'cockpit');
  return bow ? c.A.placeRoot(bow) : null;
}

/**
 * A cargo body beside a crewed block, flush with its after end (so the drive aft stays clear), on a seeded side; it
 * is built hanging below its own port ('n'), mirrored for the north side. One door joins them.
 */
export function beside(c: Ctx, host: number, blk: Block, flushOnly = false): number | null {
  const first = c.rng.chance(0.5) ? 'n' : 's';
  for (const side of [first, first === 'n' ? 's' : 'n'] as const) {
    const b = side === 's' ? blk : mirrorBlock(blk);
    // Flush aft: the body's last tile against the after end of the host's after-most port on that side.
    // The host's outermost wall line on that side, its after-most port.
    const out = (p: { y: number }): number => (side === 's' ? p.y : -p.y);
    const hp = blockOf(c, host).ports.filter((p) => p.side === side).sort((p, q) => out(q) - out(p) || q.x + q.len - (p.x + p.len))[0];
    const P = c.A.placed[host];
    const xMax = P && hp ? P.x + hp.x + hp.len : undefined;
    const flush = hp ? c.A.attach(host, b, { side, parentPort: hp.id, align: 'start', shift: hp.len - 1, doors: 1, ...(xMax !== undefined ? { xMax } : {}) }) : null;
    if (flush !== null) return flush;
    if (flushOnly) continue;
    for (const align of ['end', 'mid', 'start'] as const) {
      const id = c.A.attach(host, b, { side, align, doors: 1 });
      if (id !== null) return id;
    }
  }
  return null;
}

/** Join through a door (frame). */
export const frameJoin = (c: Ctx, host: number, blk: Block, side: Side): number | null => c.A.attach(host, blk, { side, align: 'mid', doors: 2 });

