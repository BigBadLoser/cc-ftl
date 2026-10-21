/**
 * Asteroid contact sheets (dev tool, not shipped): top-down rasters of generated asteroids showing the outline, ore veins
 * and the hollowable core, plus a text summary per seed. Reuses the ship viewer's Raster.
 */
import { content } from '../../src/content';
import { generateAsteroid, Struct, type AsteroidKind, type AsteroidPlan, type OreDef } from '../../src/sim';
import { validateAsteroid } from '../../src/sim/asteroids/validate';
import { Raster } from '../shipgen/draw';

type RGB = [number, number, number];
const ORES = Object.values(content.ores) as OreDef[];
const rgb = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

function draw(r: Raster, plan: AsteroidPlan, ox: number, oy: number, s: number): void {
  for (let y = 0; y < plan.h; y++) {
    for (let x = 0; x < plan.w; x++) {
      const i = y * plan.w + x;
      const k = plan.struct[i];
      if (k === Struct.Space) continue;
      const ore = plan.ore[i] ? ORES.find((o) => o.code === plan.ore[i]) : undefined;
      // light from the top-left: rim tiles facing it are brighter, ones facing away darker
      const open = (dx: number, dy: number) => {
        const nx = x + dx, ny = y + dy;
        return nx < 0 || ny < 0 || nx >= plan.w || ny >= plan.h || plan.struct[ny * plan.w + nx] === Struct.Space;
      };
      const shade = open(-1, 0) || open(0, -1) ? 1.25 : open(1, 0) || open(0, 1) ? 0.7 : 1;
      const base: RGB = ore ? rgb(ore.color) : k === Struct.CoreRock ? [74, 64, 96] : [104, 98, 92];
      r.rect(ox + x * s, oy + y * s, s, s, base.map((v) => Math.min(255, v * shade)) as RGB);
    }
  }
}

/** A sheet of `count` asteroids of `kind` from seed `from`, laid out in rows no wider than `maxWidth` px. */
export function asteroidSheet(kind: AsteroidKind, from: number, count: number, scale: number, maxWidth = 2400, hollow?: boolean): { raster: Raster; text: string } {
  const plans: AsteroidPlan[] = [];
  for (let k = 0; k < count; k++) plans.push(generateAsteroid(kind, from + k, ORES, hollow === undefined ? {} : { hollow }));
  const pad = 16;
  const label = 14;
  const cells = plans.map((p) => ({ p, w: p.w * scale + pad, h: p.h * scale + pad + label }));
  const rows: { items: typeof cells; h: number }[] = [];
  let row: typeof cells = [];
  let rw = pad;
  for (const c of cells) {
    if (row.length > 0 && rw + c.w > maxWidth) { rows.push({ items: row, h: Math.max(...row.map((i) => i.h)) }); row = []; rw = pad; }
    row.push(c);
    rw += c.w;
  }
  if (row.length > 0) rows.push({ items: row, h: Math.max(...row.map((i) => i.h)) });
  const width = Math.max(...rows.map((rr) => pad + rr.items.reduce((s, i) => s + i.w, 0)));
  const height = pad + rows.reduce((s, rr) => s + rr.h, 0) + 24;
  const r = new Raster(width, height);
  r.text(`${kind} asteroids  seeds ${from}-${from + count - 1}  1 tile = ${scale}px`, pad, 6, [200, 200, 210], 2);
  let y = pad + 16;
  const lines: string[] = [];
  for (const rr of rows) {
    let x = pad;
    for (const c of rr.items) {
      const p = c.p;
      const rock = p.struct.filter((k) => k !== Struct.Space).length;
      const core = p.struct.filter((k) => k === Struct.CoreRock).length;
      const ore = p.ore.filter((o) => o !== 0).length;
      const problems = validateAsteroid(p);
      r.text(`#${p.seed} ${p.w}X${p.h}${p.hollow ? ' H' : ''}${problems.length ? ' !' : ''}`, x, y, problems.length ? [255, 90, 90] : [170, 170, 180], 2);
      r.frame(x - 1, y + label - 1, p.w * scale + 2, p.h * scale + 2, [40, 44, 56]);
      draw(r, p, x, y + label, scale);
      if (p.core) r.frame(x + p.core.x * scale, y + label + p.core.y * scale, p.core.w * scale, p.core.h * scale, [150, 120, 220]);
      lines.push(`seed ${p.seed}: ${p.w}x${p.h} parts ${p.parts.length} rock ${rock} core ${core} ore ${ore}${problems.length ? ` PROBLEMS ${problems.join('; ')}` : ''}`);
      x += c.w;
    }
    y += rr.h;
  }
  return { raster: r, text: lines.join('\n') + '\n' };
}
