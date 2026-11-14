import type { RoomSpec } from '../plan';
import { placeBand, type BandAsk } from './band';
import { batteries } from './battery';
import { cornersOf, placeCorners } from './corners';
import { innerRoom, placeInner } from './inner';
import { placeStreets } from './street';
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

export interface RingOpts { R: number; outline: Outline; cut: number; inner: boolean | 'rows' | 'street'; gap?: Gap; round?: boolean; shoulders?: boolean }

const BACK: Record<Dir, Dir> = { n: 's', e: 'w', s: 'n', w: 'e' };
const AXIS: Record<Dir, Frame> = { n: { x: 0, y: -1, dir: 'n' }, e: { x: 0, y: 0, dir: 'e' }, s: { x: 0, y: 0, dir: 's' }, w: { x: -1, y: 0, dir: 'w' } };

export function ringSite(o: RingOpts, pad: number): { site: Site; kept: (x: number, y: number) => boolean } {
  const gap = o.gap;
  const kept = (x: number, y: number): boolean => !gap || (gap.side === 's' ? y < gap.from : gap.side === 'n' ? y >= -gap.from : gap.side === 'e' ? x < gap.from : x >= -gap.from);
  return { site: site(o.R, pad, o.outline, o.cut, gap ? kept : undefined, !!o.round, !!o.shoulders, gap?.side), kept };
}

/** The ring's ports: on its rim and on its inner side at the four axes (where the ring is there), and at the cut ends of an arc. */
export function ringPorts(s: Site, kept: (x: number, y: number) => boolean): Built['ports'] {
  const { g } = s, ports: Built['ports'] = [];
  for (const dir of ['n', 'e', 's', 'w'] as const) {
    const f = AXIS[dir];
    let u = 0;
    while (s.depth(...at(f, u, 0)) > 0) u++; // the first tile of the band
    const [x, y] = at(f, u, 0);
    if (g.at(...at(f, u - 1, 0)) !== s.ring || !kept(x, y) || !kept(...at(f, s.R, 0))) continue;
    ports.push({ frame: { x, y, dir }, kind: 'rim', hall: s.ring, along: s.R - u, side: 0 });
    // And on its inner side there: from the ring's inner wall, heading for the centre.
    const [ix, iy] = at(f, u - 3, 0);
    ports.push({ frame: { x: ix, y: iy, dir: BACK[dir] }, kind: 'spoke', hall: s.ring, along: 0, side: 0 });
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
export function fillRing(s: Site, asks: readonly BandAsk[], inner: boolean | 'rows' | 'street', front?: (r: RoomSpec) => boolean, streetFirst?: (r: RoomSpec) => boolean, battery = false): RoomSpec[] {
  // Bastions hold the biggest guns. A corner cut deeper than a bastion is a whole face of the hull: the common rooms
  // take those, biggest first and opposite each other, and a face with none is a garden gallery.
  const specs = asks.map((a) => a.spec), bySize = (a: RoomSpec, b: RoomSpec): number => b.w * b.h - a.w * a.h;
  // A corner with shoulders is all curve, with no straight end for an annex to stand on: it takes the biggest rooms
  // without one, whatever their department, so no corner is left a gallery while the band is short.
  // A gun bay or crew quarters never: stretched over a whole curve they are a hall with a gun or two beds in it. Nor a
  // hangar: its bay is a straight pit.
  // Common rooms first.
  const commonsFirst = (a: RoomSpec, b: RoomSpec): number => Number(b.dept === 'commons') - Number(a.dept === 'commons') || bySize(a, b);
  const halls = specs.filter((r) => !r.cabin && !front?.(r) && (s.shoulders ? !r.annex && !r.annexed && r.role !== 'weapons' && r.role !== 'quarters' && !r.vehicle : r.dept === 'commons')).sort(s.shoulders ? commonsFirst : bySize);
  // The corners the outline has (an arc lacks some), in the order they are given rooms: halls to opposite corners first.
  const order = (s.cut > 2 ? [1, 3, 0, 2] : [0, 1, 2, 3]).filter((k) => cornersOf(s).includes(k));
  const given = s.cut > 2 || battery ? halls : specs.filter((r) => r.role === 'weapons').sort(bySize);
  // Batteries: the guns take the corners, a bay each as big as the curve; a corner with none takes a hall as before.
  // A hall too big for anywhere else (a station's main mess) keeps its corner, the first in order.
  const big = battery ? halls.filter((r) => r.w * r.h >= 50) : [];
  const gunned = order.slice(Math.min(big.length, order.length));
  const bat = battery ? batteries(s, gunned, specs.filter((r) => r.role === 'weapons' && !front?.(r))) : null;
  const spare = [...big, ...given.filter((r) => !big.includes(r))];
  const cornered = placeCorners(s, [0, 1, 2, 3].map((k) => bat?.specs[k] ?? (order.includes(k) ? (bat ? spare.shift() : given[order.indexOf(k)]) : undefined)));
  if (bat) cornered.push(...bat.used);
  // The waterfront: rooms that stand on the inner side first. What finds no place there goes to the band with the rest.
  const fronted = front ? asks.filter((a) => !cornered.includes(a.spec) && front(a.spec) && !a.spec.annex) : [];
  const ashore = fronted.length > 0 ? placeInner(s, fronted, Math.PI / 4) : [];
  const all = asks.filter((a) => !cornered.includes(a.spec) && (!fronted.includes(a) || ashore.includes(a.spec)));
  // Rooms the streets take first never ask the band.
  const streeted = inner === 'street' && streetFirst ? all.filter((a) => streetFirst(a.spec) && !a.spec.annex && !a.spec.annexed).map((a) => a.spec) : [];
  const rest = all.filter((a) => !streeted.includes(a.spec));
  const band = placeBand(s, rest, inner === 'street' ? (r) => (r.annex ? 2 : r.role === 'weapons' ? 1 : 0) : undefined);
  if ((band.left.length === 0 && streeted.length === 0) || !inner) return band.left;
  // Streets through the middle take whatever the band could not hold. A room with an annex and the guns chose first in
  // the band; a gun stands inside only when the hull has no place left for it.
  if (inner === 'street') {
    const lone = [...streeted, ...band.left.filter((r) => !r.annex && !r.annexed)];
    const out = placeStreets(s, lone);
    return [...band.left.filter((r) => !lone.includes(r)), ...out];
  }
  // A room with an annex stands in the band, where its annex can stand against it.
  const small = band.left.filter((r) => innerRoom(r) && !r.annex);
  const out = placeInner(s, rest.filter((a) => small.includes(a.spec)), Infinity, inner === 'rows');
  const left = band.left.filter((r) => !small.includes(r) || out.includes(r));
  // A cabin or two still over: they double up, as in the band, with cabins that found a place on either side.
  const stood = specs.filter((r) => r.cabin && !left.includes(r));
  if (left.length <= 2 && left.every((r) => r.cabin) && stood.length >= left.length) for (const [k, extra] of left.splice(0).entries()) (stood[k] as RoomSpec).mods.push(...extra.mods);
  return left;
}
