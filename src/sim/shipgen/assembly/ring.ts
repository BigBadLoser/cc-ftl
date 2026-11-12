import type { RoomSpec } from '../plan';
import { placeBand, type BandAsk } from './band';
import { placeCorners } from './corners';
import { innerRoom, placeInner } from './inner';
import { site, type Outline, type Site } from './lattice';
import { at, type Built, type Dir, type Frame } from './model';

/**
 * The ring Section: a footprint that is the stepped ring or an arc of it, with band strips as its interior scheme
 * (flow/band.ts), rooms on its inner side when asked (flow/inner.ts) and corner rooms on a square outline. It is the
 * one element built in two steps: the ring and its ports first, so what attaches to its rim can claim the band's depth,
 * then `fill` with the rooms it holds. What it holds is what the strips take: `fill` returns the rest.
 */

/** A piece cut away: everything on the far side of a lattice line (`from` tiles from the centre on side `side`). */
export interface Gap { side: Dir; from: number }

export interface RingOpts { R: number; outline: Outline; cut: number; inner: boolean; gap?: Gap }

const AXIS: Record<Dir, Frame> = { n: { x: 0, y: -1, dir: 'n' }, e: { x: 0, y: 0, dir: 'e' }, s: { x: 0, y: 0, dir: 's' }, w: { x: -1, y: 0, dir: 'w' } };

export function ringSite(o: RingOpts, pad: number): { site: Site; kept: (x: number, y: number) => boolean } {
  const gap = o.gap;
  const kept = (x: number, y: number): boolean => !gap || (gap.side === 's' ? y < gap.from : gap.side === 'n' ? y >= -gap.from : gap.side === 'e' ? x < gap.from : x >= -gap.from);
  return { site: site(o.R, pad, o.outline, o.cut, gap ? kept : undefined), kept };
}

/** The ring's ports: on its rim at the four axes (where the ring is there), and at the cut ends of an arc. */
export function ringPorts(s: Site, kept: (x: number, y: number) => boolean): Built['ports'] {
  const { g } = s, ports: Built['ports'] = [];
  for (const dir of ['n', 'e', 's', 'w'] as const) {
    const f = AXIS[dir];
    let u = 0;
    while (s.depth(...at(f, u, 0)) > 0) u++; // the first tile of the band
    const [x, y] = at(f, u, 0);
    if (g.at(...at(f, u - 1, 0)) !== s.ring || !kept(x, y) || !kept(...at(f, s.R, 0))) continue;
    ports.push({ frame: { x, y, dir }, kind: 'rim', hall: s.ring, along: s.R - u, side: 0 });
  }
  // Cut ends: the two ring tiles that face the cut, one port a pair.
  const seen = new Set<string>();
  for (let y = -s.R; y < s.R; y++) for (let x = -s.R; x < s.R; x++) {
    if (g.at(x, y) !== s.ring) continue;
    for (const [dx, dy, dir] of [[0, 1, 's'], [0, -1, 'n'], [1, 0, 'e'], [-1, 0, 'w']] as const) {
      if (kept(x + dx, y + dy)) continue;
      const pair = dy !== 0 ? g.at(x + 1, y) === s.ring : g.at(x, y + 1) === s.ring;
      const k = `${dir}${dy !== 0 ? Math.floor((x + 1) / 2) : Math.floor((y + 1) / 2)}:${dy !== 0 ? y : x}`;
      if (!pair || seen.has(k)) continue;
      seen.add(k);
      ports.push({ frame: dy !== 0 ? { x: x + 1, y: y + dy, dir } : { x: x + dx, y: y + 1, dir }, kind: 'tip', hall: s.ring, along: 0, side: 0 });
    }
  }
  return ports;
}

/** Fill the ring with its rooms: corners, then the band, then its inner side. Returns the rooms it could not hold. */
export function fillRing(s: Site, asks: readonly BandAsk[], inner: boolean): RoomSpec[] {
  const cornered = placeCorners(s, asks.map((a) => a.spec).filter((r) => r.role === 'weapons').sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 4));
  const rest = asks.filter((a) => !cornered.includes(a.spec));
  const band = placeBand(s, rest);
  if (band.left.length === 0 || !inner) return band.left;
  // A room with an annex stands in the band, where its annex can stand against it.
  const small = band.left.filter((r) => innerRoom(r) && !r.annex);
  const out = placeInner(s, rest.filter((a) => small.includes(a.spec)));
  return band.left.filter((r) => !small.includes(r) || out.includes(r));
}
