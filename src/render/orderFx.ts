/*
 * UI OVERLAY, drawn in code on purpose (like crewMarks): the marker that flashes where an order was given, and the line each
 * walking drafted crew member follows to its target. Not game art; there is no sprite for it. Everything is drawn on the art-pixel
 * grid (1 art pixel = ART_SCALE layer units) as hard-edged squares, so it reads like the pixel art under it.
 */
import { Container, Graphics } from 'pixi.js';
import type { World } from '../sim/ecs';
import { CrewC, DeadC, DraftedC, PathC, PositionC } from '../sim/crew/components';
import { AllegianceC } from '../sim/fight/components';
import { Z_PX } from './heights';
import { ART_SCALE as S, iso } from './iso';
import { arrowHeadPx, blockPx, dashedPath, ellipsePx, type Px } from './pixelShapes';

export type OrderKind = 'move' | 'attack' | 'station' | 'board';

/** Marker colours. */
const COLOR: Record<OrderKind, number> = { move: 0x22d3ee, attack: 0xff4d4d, station: 0xf0c030, board: 0x4cd964 };
/** How long a marker lasts (ms of the real clock: it is UI feedback, so it fades while the game is paused too). */
export const MARKER_MS = 1100;

interface Marker {
  x: number;
  y: number;
  kind: OrderKind;
  born: number;
}

export interface OrderFx {
  /** Flash a marker on a sector tile (x, y are the tile, whose centre it marks, like the crew positions). */
  addMarker(x: number, y: number, kind?: OrderKind): void;
  /** The selected crew: each gets a clear ring on the floor and a small arrow over the head. */
  setSelected(ids: readonly number[]): void;
  update(): void;
  dispose(): void;
}

/** 1 at birth to 0 when the marker is gone (eased out). */
export function markerAlpha(ageMs: number): number {
  const k = Math.max(0, Math.min(1, ageMs / MARKER_MS));
  return 1 - k * k;
}

const CYAN = 0x22d3ee;

/** Pixels of one colour and opacity; the overlay is drawn as a few batches of S x S squares. */
type Batch = { color: number; alpha: number; pts: Px[] };

/** Opacity in four hard steps (pixel art fades in steps, not smoothly). */
const steps = (a: number): number => Math.max(0.25, Math.ceil(a * 4) / 4);

export function createOrderFx(world: World, parent: Container): OrderFx {
  const g = new Graphics();
  parent.addChild(g);
  let markers: Marker[] = [];
  let selected: readonly number[] = [];
  /** A layer-frame point as an art pixel. */
  const art = (p: { x: number; y: number }): Px => ({ x: Math.round(p.x / S), y: Math.round(p.y / S) });
  const flush = (batches: Batch[]): void => {
    for (const b of batches) {
      if (b.pts.length === 0) continue;
      for (const p of b.pts) g.rect(p.x * S, p.y * S, S, S);
      g.fill({ color: b.color, alpha: b.alpha });
    }
  };
  return {
    addMarker(x, y, kind = 'move') {
      markers.push({ x, y, kind, born: performance.now() });
    },
    setSelected(ids) {
      selected = ids;
    },
    update() {
      g.clear();
      const path: Batch = { color: CYAN, alpha: 0.9, pts: [] };
      const ends: Batch = { color: CYAN, alpha: 1, pts: [] };
      // Paths: from where the crew member stands, through its remaining steps to the end of the order, as a dashed pixel line.
      for (const id of world.query(CrewC, DraftedC, PositionC, PathC)) {
        const d = world.get(id, DraftedC);
        const walk = world.get(id, PathC);
        const pos = world.get(id, PositionC);
        if (!d?.target || !walk || !pos || walk.steps.length === 0 || world.has(id, DeadC) || world.get(id, AllegianceC)?.faction !== 'player') continue;
        // One dash pattern for the whole line, counted from the target end so the dashes hold still while the walker moves.
        const corners = [art(iso(pos.x + (pos.toX - pos.x) * pos.progress, pos.y + (pos.toY - pos.y) * pos.progress)), ...walk.steps.map((st) => art(iso(st.x, st.y)))];
        // 2x2 art pixels thick, like the art's own pixel blocks
        for (const d of dashedPath(corners, 3, 2)) path.pts.push(d, { x: d.x + 1, y: d.y }, { x: d.x, y: d.y + 1 }, { x: d.x + 1, y: d.y + 1 });
        const end = art(iso(d.target.x, d.target.y));
        ends.pts.push(...blockPx(end.x - 2, end.y - 2, 5, 5));
      }
      flush([path, ends]);
      // Selected crew: a pixel ring on the floor and a little arrow over the head.
      const ring: Batch = { color: CYAN, alpha: 1, pts: [] };
      for (const id of selected) {
        const pos = world.get(id, PositionC);
        if (!pos || world.has(id, DeadC)) continue;
        const c = iso(pos.x + (pos.toX - pos.x) * pos.progress, pos.y + (pos.toY - pos.y) * pos.progress);
        const f = art(c);
        ring.pts.push(...ellipsePx(f.x, f.y, 15, 7), ...ellipsePx(f.x, f.y, 14, 6));
        const head = art({ x: c.x, y: c.y - 1.9 * Z_PX });
        ring.pts.push(...arrowHeadPx(head.x, head.y - 2, 5));
      }
      flush([ring]);
      // Markers: a pixel ring on the floor with an arrow dropping onto it, fading in steps.
      const now = performance.now();
      markers = markers.filter((m) => now - m.born < MARKER_MS);
      for (const m of markers) {
        const age = now - m.born;
        const a = steps(markerAlpha(age));
        const f = art(iso(m.x, m.y));
        const rx = Math.round(22 - 8 * (age / MARKER_MS));
        const ry = Math.round(rx / 2);
        const col = COLOR[m.kind];
        const outer: Batch = { color: col, alpha: a, pts: [...ellipsePx(f.x, f.y, rx, ry), ...ellipsePx(f.x, f.y, rx - 1, ry - 1), ...ellipsePx(f.x, f.y, Math.max(2, rx - 5), Math.max(1, ry - 3))] };
        const bob = Math.round(Math.sin(age / 90) * 1.5);
        const tipY = f.y - 3 + bob;
        const arrow: Batch = { color: col, alpha: a, pts: [...blockPx(f.x - 2, tipY - 42, 4, 36), ...arrowHeadPx(f.x, tipY, 8)] };
        flush([outer, arrow]);
      }
    },
    dispose() {
      g.destroy();
    },
  };
}
