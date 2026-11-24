import type { BladeKind } from '../hull/silhouette';
import type { Poly, Pt } from '../hull/raiderSilhouette';

export { inPoly, type Poly } from '../hull/raiderSilhouette';

/**
 * Raider blades (PROTOTYPE, #581): the shapes of the approved mock sheet (raider_kit_v18), as polygons in tiles. A blade
 * is drawn on the hull's upper side with its root at the origin: x runs aft (a fore blade is drawn flipped), y out from
 * the hull's side. Each shape is one or more slabs fused at the root, the last faired into the hull side.
 */


interface SlabOpts { notch?: boolean; fair?: number; faired?: boolean; point?: boolean }

/**
 * A slab: a straight blade at `ang` degrees off the hull's line, `len` long and `w` thick, from `o`. Its tip slants to its
 * trailing edge (a long slant to a point with `point`), a notch cut behind it (`notch`); faired, a triangle sweeps its
 * root into the hull side so it flows into it rather than standing on a square shoulder.
 */
function slab(ang: number, len: number, w: number, o: Pt, { notch = true, fair = 2, faired = true, point = false }: SlabOpts = {}): Poly[] {
  const r = (ang * Math.PI) / 180, d = [Math.cos(r), Math.sin(r)], n = [-Math.sin(r), Math.cos(r)];
  const P = (t: number, q: number): Pt => [o[0] + d[0]! * t + n[0]! * q, o[1] + d[1]! * t + n[1]! * q];
  const h = w / 2, tin = len - (point ? w * 2.4 : w * 0.9);
  const pts: Pt[] = [P(-w * 0.5, h), P(len, h), P(tin, -h)];
  if (notch && !point) {
    const a = tin - w * 0.9, b = a - w * 0.9;
    pts.push(P(a, -h), P(a, -h + w * 0.3), P(b, -h + w * 0.3), P(b, -h));
  }
  pts.push(P(-w * 0.5, -h - 4));
  const [ox, oy] = P(w * 0.6, h);
  return faired ? [pts, [[o[0] - fair * w, -1], [ox, oy], [o[0] + w * 0.5, -1]]] : [pts];
}

/** `layers` slabs fanned out from one root, each shorter and steeper than the one before, the outermost faired. */
function stack(k: number, layers: number, { ang = 8, first = 34, step = 7, spread = 15, notch = true, point = false } = {}): Poly[] {
  const w = 7 * Math.sqrt(k);
  return Array.from({ length: layers }, (_, i) =>
    slab(ang + spread * i, (first - step * i) * k, w, [-i * w * 1.4, w * 0.35], { notch: notch && i === 0, faired: i === layers - 1, point })).flat();
}

/** A blade of the palette at scale `k` (1: a medium hull's). */
export function bladeShape(kind: BladeKind, k: number): Poly[] {
  const s = Math.sqrt(k);
  switch (kind) {
    case 'slab': return stack(k, 1);
    case 'slabPlain': return stack(k, 1, { notch: false });
    case 'slab2': return stack(k, 2);
    case 'slab3': return stack(k, 3);
    case 'spikes2': return stack(k, 2, { ang: 12, spread: 16, point: true });
    case 'spikes3': return stack(k, 3, { ang: 10, spread: 15, point: true });
    case 'claw': return slab(30, 22 * k, 7 * s, [0, 2.5 * s]);
    case 'claw2': return [...slab(30, 22 * k, 7 * s, [0, 2.5 * s]), ...slab(48, 15 * k, 6 * s, [-7 * s, 2.5 * s], { notch: false, faired: false })];
    case 'horn': return slab(70, 13 * k, 6 * s, [0, 2], { notch: false, fair: 1 });
    case 'kink': {
      // Out steeply, then a hard kink to run along the hull: one fused piece.
      const w = 7 * s;
      return [...slab(55, 13 * k, w, [0, w * 0.35], { notch: false }), ...slab(10, 24 * k, w, [13 * k * 0.57 - 2, 13 * k * 0.82 + w * 0.35], { faired: false })];
    }
  }
}
