/*
 * UI OVERLAY, drawn in code on purpose (like crewMarks): the marker that flashes where an order was given, and the line each
 * walking drafted crew member follows to its target. Not game art; there is no sprite for it.
 */
import { Container, Graphics } from 'pixi.js';
import type { World } from '../sim/ecs';
import { CrewC, DeadC, DraftedC, PathC, PositionC } from '../sim/crew/components';
import { AllegianceC } from '../sim/fight/components';
import { ART_SCALE as S, iso } from './iso';

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
  update(): void;
  dispose(): void;
}

/** 1 at birth to 0 when the marker is gone (eased out). */
export function markerAlpha(ageMs: number): number {
  const k = Math.max(0, Math.min(1, ageMs / MARKER_MS));
  return 1 - k * k;
}

export function createOrderFx(world: World, parent: Container): OrderFx {
  const g = new Graphics();
  parent.addChild(g);
  let markers: Marker[] = [];
  return {
    addMarker(x, y, kind = 'move') {
      markers.push({ x, y, kind, born: performance.now() });
    },
    update() {
      g.clear();
      // Paths: from where the crew member stands, through its remaining steps, to the end of the order.
      for (const id of world.query(CrewC, DraftedC, PositionC, PathC)) {
        const d = world.get(id, DraftedC);
        const path = world.get(id, PathC);
        const pos = world.get(id, PositionC);
        if (!d?.target || !path || !pos || path.steps.length === 0 || world.has(id, DeadC) || world.get(id, AllegianceC)?.faction !== 'player') continue;
        const from = iso(pos.x + (pos.toX - pos.x) * pos.progress, pos.y + (pos.toY - pos.y) * pos.progress);
        g.moveTo(from.x, from.y);
        for (const s of path.steps) {
          const p = iso(s.x, s.y);
          g.lineTo(p.x, p.y);
        }
        g.stroke({ width: 2 * S, color: COLOR.move, alpha: 0.7 });
        const end = iso(d.target.x, d.target.y);
        g.circle(end.x, end.y, 2.5 * S).fill({ color: COLOR.move, alpha: 0.9 });
      }
      // Markers: a flat ring on the floor with an arrow dropping onto it.
      const now = performance.now();
      markers = markers.filter((m) => now - m.born < MARKER_MS);
      for (const m of markers) {
        const age = now - m.born;
        const a = markerAlpha(age);
        const c = iso(m.x, m.y);
        const rx = (13 - 4 * (age / MARKER_MS)) * S;
        g.ellipse(c.x, c.y, rx, rx / 2).stroke({ width: 2 * S, color: COLOR[m.kind], alpha: a });
        g.ellipse(c.x, c.y, rx / 3, rx / 6).fill({ color: COLOR[m.kind], alpha: a * 0.5 });
        const bob = Math.sin(age / 90) * 1.5 * S;
        const tip = c.y - 5 * S + bob;
        const top = tip - 22 * S;
        g.moveTo(c.x, top).lineTo(c.x, tip).stroke({ width: 3 * S, color: COLOR[m.kind], alpha: a });
        g.poly([c.x - 6 * S, tip - 7 * S, c.x + 6 * S, tip - 7 * S, c.x, tip + 1 * S]).fill({ color: COLOR[m.kind], alpha: a });
      }
    },
    dispose() {
      g.destroy();
    },
  };
}
