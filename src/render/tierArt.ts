import { Container, Graphics, Text } from 'pixi.js';
import type { Module } from '../sim/modules/components';
import { footprintTiles, rotateOffset } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { iso, TILE_H, TILE_W } from './iso';

/**
 * Placeholder art of a bigger tier (`ModuleDef.tierArt`), until the tier art pack: the base module's art drawn normally, as a module of
 * the base footprint at the local origin (the hull side of an engine, which grows inboard), plus a tier-coloured outline over the whole
 * footprint and a small "II" / "III" badge (see `tierMark`).
 */
export function tierBase(m: Module, def: ModuleDef): { m: Module; def: ModuleDef } {
  const base = def.tierArt!.base;
  const a = rotateOffset(def, m.rot, 0, 0);
  const b = rotateOffset(def, m.rot, base[0] - 1, base[1] - 1);
  return { m: { ...m, x: m.x + Math.min(a.x, b.x), y: m.y + Math.min(a.y, b.y) }, def: { ...def, footprint: base } };
}

const BADGE = ['', '', 'II', 'III'];

/** The outline (only the footprint's outer edges, as one polygon set) and the badge on the front tile; add it above the module art. */
export function tierMark(m: Module, def: ModuleDef, scale: number): Container {
  const tint = def.tierArt!.tint;
  const tiles = footprintTiles(def, m.x, m.y, m.rot);
  const has = new Set(tiles.map((t) => `${t.x},${t.y}`));
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  const g = new Graphics();
  // Edge between two diamond corners, drawn when the neighbouring tile in that direction is not part of the footprint.
  const edges: [number, number, [number, number], [number, number]][] = [
    [1, 0, [hw, 0], [0, hh]], [0, 1, [0, hh], [-hw, 0]], [-1, 0, [-hw, 0], [0, -hh]], [0, -1, [0, -hh], [hw, 0]],
  ];
  for (const t of tiles) {
    const c = iso(t.x, t.y);
    for (const [dx, dy, p, q] of edges) {
      if (!has.has(`${t.x + dx},${t.y + dy}`)) g.moveTo(c.x + p[0], c.y + p[1]).lineTo(c.x + q[0], c.y + q[1]);
    }
  }
  g.stroke({ width: 4, color: tint, alpha: 0.95, cap: 'round' });
  const root = new Container();
  root.addChild(g);
  const front = tiles.reduce((a, t) => (t.x + t.y > a.x + a.y ? t : a), tiles[0]!);
  const p = iso(front.x, front.y);
  const label = new Text({ text: BADGE[def.blueprint?.tier ?? 2] ?? '', resolution: Math.max(1, scale), style: { fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold', fill: tint, stroke: { color: 0x05080d, width: 5 } } });
  label.anchor.set(0.5);
  label.position.set(Math.round(p.x), Math.round(p.y - 4));
  root.addChild(label);
  return root;
}
