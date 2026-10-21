import { describe, expect, it } from 'vitest';
import { CrewC, PositionC, ShipC, footprintTiles, generateShip, newGame, openTilesOf, structureParts, type FactionDef, type ModuleDef } from '../../sim';
import { shipGrid, shipIdOf } from '../../sim/regions';
import { ruin } from '../../sim/shipgen/ruin';
import type { RuinCause, RuinResult } from '../../sim/shipgen/ruinTypes';
import { content } from '../index';
import { factions } from './index';

const defs = content.modules as Record<string, ModuleDef>;
const FACTIONS = ['faction.navy', 'faction.civilian', 'faction.scrapper'] as const;
const CAUSES: RuinCause[] = ['combat', 'decay'];
const ruined = (f: string, seed: number, intensity: number, cause?: RuinCause): RuinResult =>
  ruin(generateShip(factions[f as keyof typeof factions] as FactionDef, f, seed, 2, defs).template, seed, { defs, intensity, ...(cause ? { cause } : {}) });

/**
 * Walkable tiles reached from every walkable tile touching space (breach entries) or beside an airlock, doors all passable
 * (a jammed one can be forced) and solid modules blocking.
 */
function reach(r: RuinResult): Set<number> {
  const rows = r.template.rows;
  const w = Math.max(...rows.map((x) => x.length));
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  const solid = new Set<number>();
  for (const m of r.template.modules ?? []) {
    const def = defs[m.def];
    if (!def?.solid) continue;
    const open = new Set(openTilesOf(def, m.x, m.y, m.rot).map((t) => t.y * w + t.x));
    for (const t of footprintTiles(def, m.x, m.y, m.rot)) if (!open.has(t.y * w + t.x)) solid.add(t.y * w + t.x);
  }
  const walk = (x: number, y: number): boolean => x >= 0 && x < w && (at(x, y) === '_' || at(x, y) === 'D') && !solid.has(y * w + x);
  const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const q: number[] = [];
  const seen = new Set<number>();
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < w; x++) {
    if (walk(x, y) && n4.some(([dx, dy]) => at(x + dx, y + dy) === '.')) { seen.add(y * w + x); q.push(y * w + x); }
  }
  for (const m of r.template.modules ?? []) if (m.def === 'module.airlock') for (let dy = -1; dy <= 4; dy++) for (let dx = -1; dx <= 4; dx++) {
    const x = m.x + dx, y = m.y + dy;
    if (walk(x, y) && !seen.has(y * w + x)) { seen.add(y * w + x); q.push(y * w + x); }
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h] as number;
    const x = i % w, y = (i - x) / w;
    for (const [dx, dy] of n4) {
      const j = (y + dy) * w + x + dx;
      if (walk(x + dx, y + dy) && !seen.has(j)) { seen.add(j); q.push(j); }
    }
  }
  return seen;
}

describe('derelict ruin pass', () => {
  it('is deterministic from the seed', () => {
    for (const f of FACTIONS) {
      const a = JSON.stringify(ruined(f, 5, 0.7));
      expect(JSON.stringify(ruined(f, 5, 0.7))).toBe(a);
      expect(JSON.stringify(ruined(f, 6, 0.7))).not.toBe(a);
    }
  });

  it('leaves one connected structure, whatever it breaks or shears off', () => {
    for (const f of FACTIONS) for (const cause of CAUSES) for (const lv of [0.2, 0.5, 0.95]) for (let seed = 1; seed <= 6; seed++) {
      const r = ruined(f, seed, lv, cause);
      const w = Math.max(...r.template.rows.map((x) => x.length));
      const cells = r.template.rows.flatMap((row) => Array.from({ length: w }, (_, x) => row[x] ?? '.'));
      expect(structureParts(cells, w, r.template.rows.length), `${f} ${cause} ${lv} #${seed}`).toBe(1);
      expect(r.template.crew).toEqual([]);
    }
  });

  it('records hull and wall breaches only on the torn edge, bordering a standing wall', () => {
    for (const f of FACTIONS) for (const cause of CAUSES) for (const seed of [1, 2, 3]) {
      const r = ruined(f, seed, 0.8, cause);
      const at = (x: number, y: number): string => r.template.rows[y]?.[x] ?? '.';
      for (const b of r.meta.breaches) {
        if (b.kind === 'floor') continue;
        expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(b.x + (dx as number), b.y + (dy as number)) === '#' || at(b.x + (dx as number), b.y + (dy as number)) === 'D')).toBe(true);
      }
    }
  });
  it('puts every cache where a boarding party can reach it (open, through a jammed door, or by EVA)', () => {
    const access: Record<string, number> = {};
    for (const f of FACTIONS) for (const cause of CAUSES) for (const lv of [0.2, 0.5, 0.95]) for (let seed = 1; seed <= 6; seed++) {
      const r = ruined(f, seed, lv, cause);
      const w = Math.max(...r.template.rows.map((x) => x.length));
      const seen = reach(r);
      expect(r.meta.caches.length, `${f} ${cause} ${lv} #${seed}`).toBeGreaterThan(0);
      for (const k of r.meta.caches) {
        access[k.access] = (access[k.access] ?? 0) + 1;
        for (const it of k.items) expect(seen.has(it.y * w + it.x), `${f} ${cause} ${lv} #${seed} cache`).toBe(true);
      }
    }
    expect(Object.keys(access).length).toBeGreaterThan(1);
  });

  it('damages more with intensity', () => {
    const dead = (lv: number): number => FACTIONS.reduce((t, f) => t + [1, 2, 3, 4].reduce((u, s) => u + ruined(f, s, lv).meta.modules.filter((m) => m.state === 'destroyed').length, 0), 0);
    expect(dead(0.9)).toBeGreaterThan(dead(0.1));
  });

  it('spawns as an inert wreck with the ruin state applied', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnDerelict', faction: 'faction.navy', seed: 3, depth: 2, cx: 130, cy: 70, intensity: 0.8, cause: 'combat' });
    sim.step();
    const id = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)?.faction === 'neutral') ?? 0;
    const ship = sim.world.get(id, ShipC);
    expect(ship?.state).toBe('wreck');
    expect(ship?.faction).toBe('neutral');
    const crew = sim.world.query(CrewC, PositionC).filter((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === id);
    expect(crew).toEqual([]);
    const grid = shipGrid(sim, id)!;
    let vac = 0, thin = 0, jammed = 0;
    for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('jam', x, y) !== 0) jammed++;
      if (grid.get('struct', x, y) !== 1) continue;
      if (grid.get('o2', x, y) < 1) vac++;
      else if (grid.get('o2', x, y) < 20) thin++;
    }
    expect(vac).toBeGreaterThan(0);
    expect(thin).toBeGreaterThan(0);
    expect(jammed).toBeGreaterThan(0);
  });
});
