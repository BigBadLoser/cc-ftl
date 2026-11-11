/** The checks on a layout, all from the game's owners: the template validator, the unreachable tiles, and the power system's allocation. */
import { content } from '../../src/content';
import { validateTemplate, type ModuleDef } from '../../src/sim';
import { unreachableTiles } from '../shipgen/templates';
import { moduleTiles, toTemplate, type Layout, type Tile } from './layout';
import { unpowered } from './world';

export interface Problem {
  text: string;
  /** The module it names (its stable id), if any. */
  module?: number;
  /** Tiles to show for it. */
  tiles: Tile[];
}
const defs = content.modules as Record<string, ModuleDef>;

export function problemsOf(l: Layout): Problem[] {
  const t = toTemplate(l);
  const out: Problem[] = [];
  const moduleAt = (x: number, y: number): number => l.modules.findIndex((m) => m.x === x && m.y === y);
  for (const text of validateTemplate(t, defs, { immobile: l.immobile })) {
    if (text.startsWith('unreachable')) {
      const tiles = unreachableTiles(t).map((s): Tile => s.split(',').map(Number) as Tile);
      out.push({ text, tiles });
      continue;
    }
    const at = /@(-?\d+),(-?\d+)/.exec(text) ?? /door (-?\d+),(-?\d+)/.exec(text) ?? / at (-?\d+),(-?\d+)/.exec(text);
    const x = at ? Number(at[1]) : NaN, y = at ? Number(at[2]) : NaN;
    const module = at ? moduleAt(x, y) : -1;
    const m = l.modules[module];
    out.push({ text, ...(module >= 0 ? { module: l.moduleIds[module] as number } : {}), tiles: m ? moduleTiles(m) : at ? [[x, y]] : [] });
  }
  for (const i of unpowered(l)) {
    const m = l.modules[i];
    if (m) out.push({ text: `${defs[m.def]?.name ?? m.def}@${m.x},${m.y}: unpowered`, module: l.moduleIds[i] as number, tiles: moduleTiles(m) });
  }
  return out;
}
