import { Texture } from 'pixi.js';
import type { StaticSprite } from './assets/loader';
import { TILE_H, TILE_W } from './iso';
import { Z_PX } from './heights';

/**
 * PLACEHOLDER art for cargo containers until the `container.<W>x<H>` sheets land: an isometric box drawn on a canvas over
 * the footprint (top and the two near faces, ribbed), the cargo doors on the short end that faces the frame (darker),
 * and a yellow clamp along that end. Anchored like a
 * module sprite: at the footprint's front tile. Replaced as soon as the manifest has the real ids.
 */
export type BoxState = 'ok' | 'damaged' | 'destroyed';

const HW = TILE_W / 2;
const HH = TILE_H / 2;
/** Box height in tiles: about the cutaway hull wall, well under a full wall, so the frame does not tower over the ship (destroyed shells are crumpled lower). */
const BOX_Z = 0.8;
const COLOR: Record<BoxState, [number, number, number]> = { ok: [222, 132, 58], damaged: [160, 86, 52], destroyed: [74, 60, 54] };
const cache = new Map<string, StaticSprite>();

const rgb = (c: [number, number, number], k: number): string => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

/** The box sprite for a container footprint `w` x `h` (rotation applied), its state, its door end (n e s w) and whether the clamp grips it (a loose box shows its doors, no clamp). */
export function containerBox(w: number, h: number, state: BoxState, clamp: string, clamped = true): StaticSprite {
  const key = `${w}x${h}|${state}|${clamp}|${clamped ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const Z = Math.round((state === 'destroyed' ? 0.45 : BOX_Z) * Z_PX);
  // Footprint corners (art px, origin at the top-left tile's centre): north, east, south, west.
  const N = { x: 0, y: -HH }, E = { x: w * HW, y: (w - 1) * HH }, S = { x: (w - h) * HW, y: (w + h - 1) * HH }, W = { x: -h * HW, y: (h - 1) * HH };
  const minX = W.x, minY = N.y - Z;
  const cw = E.x - W.x + 2, ch = S.y - minY + 2;
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const P = (p: { x: number; y: number }, up = 0): [number, number] => [p.x - minX + 1, p.y - minY + 1 - up];
  const poly = (pts: [number, number][], fill: string, stroke = 'rgba(30,22,18,0.9)'): void => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = stroke;
    g.lineWidth = 1;
    g.stroke();
  };
  const c = COLOR[state];
  // Near faces: south-west (darker) and south-east, then the lid.
  poly([P(W), P(S), P(S, Z), P(W, Z)], rgb(c, 0.62));
  poly([P(S), P(E), P(E, Z), P(S, Z)], rgb(c, 0.8));
  poly([P(N, Z), P(E, Z), P(S, Z), P(W, Z)], rgb(c, 1));
  // Ribs: vertical corrugation on both near faces, one every half tile.
  g.strokeStyle = rgb(c, 0.45);
  const rib = (a: { x: number; y: number }, b: { x: number; y: number }, n: number): void => {
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const [x, y] = P({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      g.beginPath();
      g.moveTo(Math.round(x) + 0.5, y - 2);
      g.lineTo(Math.round(x) + 0.5, y - Z + 2);
      g.stroke();
    }
  };
  if (state !== 'destroyed') { rib(W, S, w * 2); rib(S, E, h * 2); }
  if (state !== 'ok') {
    // A blown hole on the lid (damaged), or a torn-open lid (destroyed).
    const m = { x: (N.x + S.x) / 2, y: (N.y + S.y) / 2 };
    poly([P({ x: m.x - HW * 0.6, y: m.y }, Z), P({ x: m.x, y: m.y - HH * 0.5 }, Z), P({ x: m.x + HW * 0.7, y: m.y + 2 }, Z), P({ x: m.x - 4, y: m.y + HH * 0.6 }, Z)], 'rgb(18,14,14)', 'rgba(255,140,60,0.8)');
  }
  // The door end (always the clamped short end): a darker band across the lid there, and on a near face (s or e) the
  // double cargo door itself. Then the clamp: a yellow bar along the lid edge on the frame side.
  const edge = { n: [N, E], e: [E, S], s: [S, W], w: [W, N] }[clamp as 'n' | 'e' | 's' | 'w'];
  if (edge) {
    const [a, b] = edge as [{ x: number; y: number }, { x: number; y: number }];
    // Inward from that edge, a third of a tile across the lid.
    const mid = { x: (N.x + S.x) / 2, y: (N.y + S.y) / 2 };
    const inset = (p: { x: number; y: number }, t: number) => ({ x: p.x + (mid.x - (a.x + b.x) / 2) * t, y: p.y + (mid.y - (a.y + b.y) / 2) * t });
    const t = 0.7 / Math.max(w, h);
    poly([P(a, Z), P(b, Z), P(inset(b, t), Z), P(inset(a, t), Z)], rgb(c, 0.55), 'rgba(0,0,0,0)');
    if (clamp === 's' || clamp === 'e') {
      // The face from a to b (the near short end), doors inset from its edges, a seam down the middle.
      const lerp = (u: number, up: number): [number, number] => { const [x, y] = P({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, up); return [x, y]; };
      poly([lerp(0.12, 3), lerp(0.88, 3), lerp(0.88, Z - 3), lerp(0.12, Z - 3)], rgb(c, 0.38), 'rgba(20,14,10,0.9)');
      g.strokeStyle = 'rgba(20,14,10,0.9)';
      g.lineWidth = 1;
      g.beginPath();
      const [sx, sy] = lerp(0.5, 3), [tx, ty] = lerp(0.5, Z - 3);
      g.moveTo(Math.round(sx) + 0.5, sy);
      g.lineTo(Math.round(tx) + 0.5, ty);
      g.stroke();
    }
    g.strokeStyle = clamped ? 'rgb(255,214,60)' : 'rgba(0,0,0,0)';
    g.lineWidth = 3;
    g.beginPath();
    const [ax, ay] = P(a, Z), [bx, by] = P(b, Z);
    g.moveTo(ax + (bx - ax) * 0.12, ay + (by - ay) * 0.12);
    g.lineTo(ax + (bx - ax) * 0.88, ay + (by - ay) * 0.88);
    g.stroke();
  }
  const tex = Texture.from(cv);
  tex.source.scaleMode = 'nearest';
  const s: StaticSprite = {
    tex,
    glow: null,
    ax: (w - h) * HW - minX + 1,
    ay: (w + h - 2) * HH - minY + 1,
    footprint: [w, h],
  };
  cache.set(key, s);
  return s;
}

/** Box state from hp: damaged under half, destroyed at 0 (the `.damaged` / `.destroyed` art ids). */
export const boxState = (hp: number, maxHp: number): BoxState => (hp <= 0 ? 'destroyed' : hp < maxHp / 2 ? 'damaged' : 'ok');
