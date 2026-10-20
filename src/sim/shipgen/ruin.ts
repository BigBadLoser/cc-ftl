import type { ShipTemplate } from '../registry';
import { Rng } from '../rng';
import { atmosphereStage } from './ruinAtmos';
import { hooksStage } from './ruinHooks';
import { lootStage } from './ruinLoot';
import { structureStage } from './ruinStructure';
import { systemsStage } from './ruinSystems';
import type { RuinCause, RuinCtx, RuinOpts, RuinResult } from './ruinTypes';

/**
 * Derelict ruin pass: `ruin(template, seed, opts)` turns any ship template (generated or hand-made) into a derelict.
 * Deterministic from the seed. The stages run in order over shared working state; each is its own module, so new
 * ones slot into RUIN_STAGES. What the template rows cannot hold goes into `meta` (see ruinTypes.ts), which the
 * spawn path applies (combat/derelict.ts).
 */
export const RUIN_STAGES: readonly ((c: RuinCtx) => void)[] = [structureStage, systemsStage, atmosphereStage, lootStage, hooksStage];

export function ruin(template: ShipTemplate, seed: number, opts: RuinOpts): RuinResult {
  const rng = new Rng(seed ^ 0x5eed0de1);
  const intensity = Math.max(0, Math.min(1, opts.intensity ?? 0.5));
  const cause: RuinCause = opts.cause ?? (rng.chance(0.5) ? 'combat' : 'decay');
  const width = Math.max(1, ...template.rows.map((r) => r.length));
  const height = template.rows.length;
  const cells: string[] = [];
  for (const row of template.rows) for (let x = 0; x < width; x++) cells.push(row[x] ?? '.');
  const c: RuinCtx = {
    rng, defs: opts.defs, width, height, cells,
    modules: (template.modules ?? []).map((m) => ({ ...m, ...(m.stock ? { stock: m.stock.map((s) => ({ ...s })) } : {}) })),
    intensity, infest: opts.infest ?? 'alien', origin: opts.origin ?? '',
    meta: {
      seed, cause, intensity, impacts: [], breaches: [], sheared: 0, modules: [], power: 'off', doors: [], rooms: [],
      fires: [], items: [], caches: [], hooks: [], decals: [],
    },
  };
  for (const stage of RUIN_STAGES) stage(c);
  const rows: string[] = [];
  for (let y = 0; y < height; y++) rows.push(cells.slice(y * width, (y + 1) * width).join(''));
  const out: ShipTemplate = { name: `Derelict ${template.name}`, rows, modules: c.modules, crew: [] };
  if (template.faction) out.faction = template.faction;
  return { template: out, meta: c.meta };
}
