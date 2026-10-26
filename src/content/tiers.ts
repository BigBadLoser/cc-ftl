import type { ModuleDef } from '../sim';
import { modules as base } from './modules';

/**
 * Tiered core modules: Mk II and Mk III of the reactor, shield generator and engine. Each tier is a module def of its own
 * (`module.reactor.mk2`), so build, power and damage need nothing new. Mk I is the basic module in modules.ts, known from the start;
 * the bigger tiers need a blueprint bought at a station (`ModuleDef.blueprint`).
 *
 * All the numbers are here, provisional, to tune in one place. A tier lists only what differs from Mk I.
 *  - `footprint`: grows per tier, always along its local y (the hull-edge engine grows inboard).
 *  - `minDanger` / `price`: the station danger tier a blueprint is sold from, and its base price (the sale price grows with danger).
 *  - `tint`: the placeholder outline colour (see `ModuleDef.tierArt`, render/tierArt.ts).
 */
interface Tier {
  footprint: [number, number];
  power: number;
  maxHp: number;
  buildWork: number;
  cost: { item: string; count: number }[];
  minDanger: number;
  price: number;
  tint: number;
}

const MK2_TINT = 0x3fa0ff;
const MK3_TINT = 0xffc83a;

/** Reactor power: 50 / 100 / 180. */
const REACTOR: Record<2 | 3, Tier & { heatPerSec: number }> = {
  2: { footprint: [2, 3], power: 100, heatPerSec: 14, maxHp: 260, buildWork: 360, minDanger: 3, price: 600, tint: MK2_TINT,
    cost: [{ item: 'item.metal', count: 36 }, { item: 'item.electronics', count: 22 }] },
  3: { footprint: [2, 4], power: 180, heatPerSec: 22, maxHp: 340, buildWork: 520, minDanger: 6, price: 1500, tint: MK3_TINT,
    cost: [{ item: 'item.metal', count: 60 }, { item: 'item.electronics', count: 40 }, { item: 'item.polymer', count: 12 }] },
};

/** Shield generator: |power| x layersPerPower = about 2 / 4 / 7 layers, one back every 10 / 8 / 6 s. */
const SHIELD: Record<2 | 3, Tier & { layersPerPower: number; rechargeSec: number }> = {
  2: { footprint: [2, 4], power: -14, layersPerPower: 0.3, rechargeSec: 8, maxHp: 140, buildWork: 320, minDanger: 3, price: 700, tint: MK2_TINT,
    cost: [{ item: 'item.metal', count: 22 }, { item: 'item.electronics', count: 24 }] },
  3: { footprint: [2, 5], power: -22, layersPerPower: 0.32, rechargeSec: 6, maxHp: 190, buildWork: 460, minDanger: 6, price: 1700, tint: MK3_TINT,
    cost: [{ item: 'item.metal', count: 36 }, { item: 'item.electronics', count: 44 }, { item: 'item.polymer', count: 10 }] },
};

/** Engine: |power| x evasionPerPower = about 12% (Mk I) / 25% / 45% evasion; Mk II burns 15% and Mk III 30% less fuel per jump. */
const ENGINE: Record<2 | 3, Tier & { evasionPerPower: number; fuelFactor: number }> = {
  2: { footprint: [4, 6], power: -10, evasionPerPower: 0.025, fuelFactor: 0.85, maxHp: 210, buildWork: 440, minDanger: 3, price: 800, tint: MK2_TINT,
    cost: [{ item: 'item.metal', count: 42 }, { item: 'item.electronics', count: 18 }] },
  3: { footprint: [4, 7], power: -15, evasionPerPower: 0.03, fuelFactor: 0.7, maxHp: 270, buildWork: 600, minDanger: 6, price: 1900, tint: MK3_TINT,
    cost: [{ item: 'item.metal', count: 66 }, { item: 'item.electronics', count: 32 }, { item: 'item.polymer', count: 14 }] },
};

const NAME = { 2: 'Mk II', 3: 'Mk III' } as const;

function tiered<T extends Tier>(id: keyof typeof base, tiers: Record<2 | 3, T>, extra: (t: T) => Partial<ModuleDef>): Record<string, ModuleDef> {
  const mk1 = base[id] as ModuleDef;
  const out: Record<string, ModuleDef> = {};
  for (const n of [2, 3] as const) {
    const t = tiers[n];
    // The roof part (and its deploy animation) is the Mk I's footprint; the bigger tiers go without until they have art.
    const rest: ModuleDef = { ...mk1 };
    delete rest.roofAsset;
    delete rest.deploySec;
    out[`${id}.mk${n}`] = {
      ...rest, name: `${mk1.name.replace('Shield generator', 'Shield gen')} ${NAME[n]}`, footprint: t.footprint, power: t.power, maxHp: t.maxHp, buildWork: t.buildWork, cost: t.cost,
      blueprint: { tier: n, minDanger: t.minDanger, price: t.price }, tierArt: { base: mk1.footprint, tint: t.tint }, ...extra(t),
    };
  }
  return out;
}

export const tierModules: Record<string, ModuleDef> = {
  ...tiered('module.reactor', REACTOR, (t) => ({ heatPerSec: t.heatPerSec })),
  ...tiered('module.shieldGen', SHIELD, (t) => ({ shieldGen: { layersPerPower: t.layersPerPower, rechargeSec: t.rechargeSec } })),
  ...tiered('module.engine', ENGINE, (t) => ({ engine: { evasionPerPower: t.evasionPerPower, fuelFactor: t.fuelFactor } })),
};
