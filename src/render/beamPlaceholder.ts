import { Graphics } from "pixi.js";
import { iso, TILE_H, TILE_W } from "./iso";

/**
 * TEMPORARY PLACEHOLDER (strut art pending): a structural beam tile drawn as a low steel box with a hazard stripe,
 * so beams read differently from walls. Replace with strut sprites from the Blender pipeline; keep this file the only
 * place that draws beams.
 */
export function beamPlaceholder(gx: number, gy: number, key: number): Graphics {
  const c = iso(gx, gy);
  const hw = TILE_W / 2 - 6;
  const hh = TILE_H / 2 - 3;
  const lift = 12;
  const top = { x: c.x, y: c.y - lift };
  const g = new Graphics();
  // Left and right faces, then the top diamond, then a stripe along it.
  g.poly([top.x - hw, top.y, top.x, top.y + hh, top.x, top.y + hh + lift, top.x - hw, top.y + lift]).fill(0x3a4048);
  g.poly([top.x + hw, top.y, top.x, top.y + hh, top.x, top.y + hh + lift, top.x + hw, top.y + lift]).fill(0x2b3036);
  g.poly([top.x, top.y - hh, top.x + hw, top.y, top.x, top.y + hh, top.x - hw, top.y]).fill(0x59616b);
  g.moveTo(top.x - hw / 2, top.y - hh / 2).lineTo(top.x + hw / 2, top.y + hh / 2).stroke({ width: 2, color: 0xc9892a });
  g.position.set(Math.round(0), Math.round(0));
  g.zIndex = key;
  return g;
}
