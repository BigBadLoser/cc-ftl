import type { ModuleDef } from '../sim';
import { modules as base } from './modules';

/**
 * Tiered core modules: Mk II and Mk III of the reactor, shield generator and engine. Each tier is a module def of its own
 * (`module.reactor.mk2`), so build, power and damage need nothing new. Mk I is the basic module in modules.ts, known from the start;
 * the bigger tiers need a blueprint bought at a station (`ModuleDef.blueprint`).
 *
 * All the numbers are here, provisional, to tune in one place. A tier lists only what differs from Mk I.
 *  - `footprint`: grows per tier, along its local y (the hull-edge engine grows inboard); the shield generator is 2x2, 2x3, 3x3.
 *  - `minDanger` / `price`: the station danger tier a blueprint is sold from, and its base price (the sale price grows with danger).
 *  - `tint`: the placeholder outline colour (see `ModuleDef.tierArt`, render/tierArt.ts); unused by tiers with their own art (reactor, shield generator); only the engine tiers are placeholders now.
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

/** Shield generator: |power| x layersPerPower = 2 / 4 / 7 layers (2x2 / 2x3 / 3x3), one back every 10 / 8 / 6 s. */
const SHIELD: Record<2 | 3, Tier & { layersPerPower: number; rechargeSec: number }> = {
  2: { footprint: [2, 3], power: -11, layersPerPower: 0.37, rechargeSec: 8, maxHp: 130, buildWork: 320, minDanger: 3, price: 700, tint: MK2_TINT,
    cost: [{ item: 'item.metal', count: 22 }, { item: 'item.electronics', count: 24 }] },
  3: { footprint: [3, 3], power: -18, layersPerPower: 0.4, rechargeSec: 6, maxHp: 180, buildWork: 460, minDanger: 6, price: 1700, tint: MK3_TINT,
    cost: [{ item: 'item.metal', count: 36 }, { item: 'item.electronics', count: 44 }, { item: 'item.polymer', count: 10 }] },
};

/**
 * Engine: |power| x evasionPerPower = about 12% (Mk I) / 25% / 45% evasion; Mk II burns 15% and Mk III 30% less fuel per jump.
 * `hullCapacity`: hull tiles one engine can push (Mk I is 700 in modules.ts): 700 / 980 / 1400.
 */
const ENGINE: Record<2 | 3, Tier & { evasionPerPower: number; fuelFactor: number; hullCapacity: number }> = {
  2: { footprint: [4, 6], power: -10, evasionPerPower: 0.025, fuelFactor: 0.85, hullCapacity: 980, maxHp: 210, buildWork: 440, minDanger: 3, price: 800, tint: MK2_TINT,
    cost: [{ item: 'item.metal', count: 42 }, { item: 'item.electronics', count: 18 }] },
  3: { footprint: [4, 7], power: -15, evasionPerPower: 0.03, fuelFactor: 0.7, hullCapacity: 1400, maxHp: 270, buildWork: 600, minDanger: 6, price: 1900, tint: MK3_TINT,
    cost: [{ item: 'item.metal', count: 66 }, { item: 'item.electronics', count: 32 }, { item: 'item.polymer', count: 14 }] },
};

const NAME = { 2: 'Mk II', 3: 'Mk III' } as const;

/**
 * `art` is true for a tier with sprites of its own: `extra` then names its asset, roof and deploy time. Otherwise the tier is a
 * placeholder (`tierArt`: the Mk I's art, outlined), without the Mk I's roof part.
 */
function tiered<T extends Tier>(id: keyof typeof base, tiers: Record<2 | 3, T>, extra: (t: T, n: 2 | 3) => Partial<ModuleDef>, art = false): Record<string, ModuleDef> {
  const mk1 = base[id] as ModuleDef;
  const out: Record<string, ModuleDef> = {};
  for (const n of [2, 3] as const) {
    const t = tiers[n];
    // A placeholder tier goes without the Mk I's roof part (its footprint) until it has art.
    const rest: ModuleDef = { ...mk1 };
    if (!art) {
      delete rest.roofAsset;
      delete rest.deploySec;
    }
    out[`${id}.mk${n}`] = {
      ...rest, name: `${mk1.name.replace('Shield generator', 'Shield gen')} ${NAME[n]}`, footprint: t.footprint, power: t.power, maxHp: t.maxHp, buildWork: t.buildWork, cost: t.cost,
      blueprint: { tier: n, minDanger: t.minDanger, price: t.price }, ...(art ? {} : { tierArt: { base: mk1.footprint, tint: t.tint } }), ...extra(t, n),
    };
  }
  return out;
}

export const tierModules: Record<string, ModuleDef> = {
  // Mk II (2x3) and Mk III (2x4) have their own sprites (`module.reactor_2x3`, `module.reactor_2x4`); the reactor has no roof part.
  ...tiered('module.reactor', REACTOR, (t, n) => ({ asset: n === 2 ? 'module.reactor_2x3' : 'module.reactor_2x4', heatPerSec: t.heatPerSec }), true),
  // Mk I is 2x2 (small art), Mk II 2x3 and Mk III 3x3, each with its own body and roof sprites and a deployable roof part.
  ...tiered('module.shieldGen', SHIELD, (t, n) => {
    const stem = n === 2 ? 'shield_gen' : 'shield_gen_3x3';
    return { asset: `module.${stem}`, roofAsset: `roof.${stem}`, deploySec: 2, shieldGen: { layersPerPower: t.layersPerPower, rechargeSec: t.rechargeSec } };
  }, true),
  ...tiered('module.engine', ENGINE, (t) => ({ engine: { evasionPerPower: t.evasionPerPower, fuelFactor: t.fuelFactor, hullCapacity: t.hullCapacity } })),
};
