import { describe, expect, it } from 'vitest';
import { generateShip, type FactionDef, type GenResult, type ModuleDef } from '../../sim';
import { content } from '../index';
import { factions } from './index';

/**
 * Hull integrity of generated ships (playtest bugs): no hull plating laid inside a truss or against its containers,
 * no room corner left open to space, no cargo container floating free, and freighter containers framed by an open truss.
 */

const defs = content.modules as Record<string, ModuleDef>;
const DEPTHS = [1, 4, 9];
const SEEDS = 12;

/** One faction, or one hull family of it (`faction.civilian:freighter`). */
function gen(spec: string, seed: number, depth: number): GenResult {
  const [id, family] = spec.split(':') as [keyof typeof factions, string | undefined];
  const f = factions[id] as FactionDef;
  const only = family && f.hullFamilies ? { ...f, hullFamilies: f.hullFamilies.filter((h) => h.id === family) } : f;
  return generateShip(only, id, seed, depth, defs);
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** Tiles under cargo containers (key y * 4096 + x), and the container boxes. */
function containerBoxes(g: GenResult): { boxes: Set<number>; list: { x: number; y: number; w: number; h: number }[] } {
  const boxes = new Set<number>();
  const list = (g.template.modules ?? []).flatMap((m) => {
    const d = defs[m.def];
    if (!d?.container) return [];
    const [w, h] = d.footprint as [number, number];
    const box = { x: m.x, y: m.y, w: m.rot % 2 ? h : w, h: m.rot % 2 ? w : h };
    for (let j = 0; j < box.h; j++) for (let i = 0; i < box.w; i++) boxes.add((box.y + j) * 4096 + box.x + i);
    return [box];
  });
  return { boxes, list };
}

/** Problems on one template: hull tiles in a truss, open corners, containers with nothing to clamp to. */
function problems(g: GenResult): string[] {
  const rows = g.template.rows;
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  const { boxes, list: containers } = containerBoxes(g);
  const out: string[] = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < (rows[y]?.length ?? 0); x++) {
      const c = at(x, y);
      // Hull that bounds no floor but touches a truss: plating laid in a truss gap or against its containers.
      if (c === '#' && N4.some(([dx, dy]) => at(x + dx, y + dy) === '=') && !N8.some(([dx, dy]) => '_D'.includes(at(x + dx, y + dy)))) out.push(`hull in truss at ${x},${y}`);
      // Floor with space beside it, even diagonally: a hull corner left out.
      if (c === '_' && N8.some(([dx, dy]) => at(x + dx, y + dy) === '.')) out.push(`open corner at ${x},${y}`);
    }
  }
  for (const b of containers) {
    let framed = false;
    // Clamped to a truss, or to a crawl tube's hull (pod strings, barges); never only to other containers or space.
    for (let j = -1; j <= b.h && !framed; j++) for (let i = -1; i <= b.w && !framed; i++) if ('=#'.includes(at(b.x + i, b.y + j)) && !boxes.has((b.y + j) * 4096 + b.x + i)) framed = true;
    if (!framed) out.push(`container at ${b.x},${b.y} floats`);
  }
  return out;
}

describe('ship generator: hull integrity', () => {
  for (const spec of ['faction.civilian:freighter', 'faction.civilian', 'faction.scrapper', 'faction.drones', 'faction.navy']) {
    it(`${spec}: no hull in trusses, no open corners, no floating containers`, () => {
      for (const depth of DEPTHS) {
        for (let seed = 1; seed <= SEEDS; seed++) expect(problems(gen(spec, seed, depth)).slice(0, 3), `${spec} seed ${seed} depth ${depth}`).toEqual([]);
      }
    });
  }

  it('freighter container frames hang on an open truss with cell guides between the boxes', () => {
    let guides = 0;
    for (const depth of DEPTHS) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('faction.civilian:freighter', seed, depth);
        for (const a of g.debug?.assemblies ?? []) if (a.label.startsWith('container frame')) expect(a.label, `seed ${seed} depth ${depth}`).not.toContain('beam');
        // A guide: frame truss with a container on both sides of it along the spine.
        const { boxes } = containerBoxes(g);
        g.template.rows.forEach((r, y) => [...r].forEach((c, x) => {
          if (c === '=' && !boxes.has(y * 4096 + x) && boxes.has(y * 4096 + x - 1) && boxes.has(y * 4096 + x + 1)) guides++;
        }));
      }
    }
    expect(guides).toBeGreaterThan(50);
  });
});
