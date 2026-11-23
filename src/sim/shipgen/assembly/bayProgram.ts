import type { ModuleDef } from '../../registry';
import { coreSpec, reactorSpec, unflat, type RoomSpec, type ShipPlan } from '../plan';
import { gunsAndReactors, programPairs } from './pairs';
import type { ProgramRules } from '../outlineRecipe';
import { messFloor } from '../rooms/rules/mess';
import { fillerSpec } from './roomSize';

/** Which rooms a bay ship's plan puts where: the program (`program`) of items to place on the bays (`bayRooms.ts`). */

export type Specs = [RoomSpec | null, RoomSpec | null];
export interface Item { specs: Specs; both: boolean; cabins?: boolean }

/** A bay hull's hold: racks, not crates (a rack two crates' worth, so half as many). */
export const racked = (r: RoomSpec): RoomSpec => {
  const n = r.mods.filter((m) => m === 'module.storage').length;
  return r.role !== 'cargo' || n === 0 ? r : { ...r, mods: [...r.mods.filter((m) => m !== 'module.storage'), ...Array<string>(Math.ceil(n / 2)).fill('module.storage_rack')] };
};

/** All the plan's reactors in one room and all its shield generators in another, a mirrored pair; the rest single. */
export function program(plan: ShipPlan, defs: Record<string, ModuleDef>, inBattery: number, rules: Required<ProgramRules>, blocks = true): Item[] {
  const { mirror, beside, trauma } = rules, hangars = !rules.pods;
  const { gunPairs, cabinPairs } = programPairs(plan, defs);
  const { lone } = gunsAndReactors(plan, defs);
  // (Prototype sizes, here until the plan takes them: a 5x4 brig; the core split into an AI core room and a drone room, 5x4 each.)
  const brig = (r: RoomSpec): RoomSpec => (r.mods.includes('module.stasis_wheel') ? { ...r, w: 5, h: 4 } : r);
  // (A turret pair of the layout's own needs the core to run it, where the plan has none.)
  const core = plan.core ?? (!mirror && rules.pd ? coreSpec() : null);
  const cores: RoomSpec[] = !core ? [] : core.mods.includes('module.droneBay')
    ? [{ ...core, mods: core.mods.filter((m) => m !== 'module.droneBay'), w: 5, h: 4 }, { role: 'core', mods: ['module.droneBay'], w: 5, h: 4, ...(core.drones ? { drones: core.drones } : {}) }]
    : [{ ...core, w: 5, h: 4 }];
  if (core?.drones) delete (cores[0] as RoomSpec).drones;
  // (And a mess of `messFloor` at least: the crew's commons. Mirrored, on a lane hull's side hulls four rows deep.)
  const mess = (r: RoomSpec): RoomSpec => {
    if (!r.mods.includes('module.galley')) return r;
    const f = messFloor(r.mods.filter((m) => m === 'module.mess_table').length, r.mods.filter((m) => m === 'module.galley').length, mirror ? 4 : 0);
    return { ...r, w: Math.max(r.w, f.w), h: mirror ? f.h : Math.max(r.h, f.h) };
  };
  // (A lane hull's escape pods: one room of four, two bays long.)
  const pods: RoomSpec[] = hangars ? [] : [{ ...fillerSpec('pods', 64), mods: Array<string>(4).fill('module.pod_bay'), w: 14, h: 4 }];
  // (Mirrored, the point defence is its pair of turrets only: the plan's own room goes.)
  // (Mirrored, on a lane hull's single-tier side hulls, or on passenger decks (`beside`): an annex (the pantry) is cut
  // three wide from its host's end; the med bay keeps its trauma room behind it, in stores' forward bays, unless the
  // recipe has it beside too (`trauma`), four wide.)
  const own = (r: RoomSpec): RoomSpec => {
    if (!beside || !r.annex || (r.role === 'medbay' && !trauma)) return r;
    // (A trauma room a third of its ward's length, four columns at least, as laid: a larger ward a larger trauma room.)
    const { annex, ...host } = r, w = r.role === 'medbay' ? 4 : 3;
    return { ...host, beside: { ...annex, w, ...(r.role === 'medbay' ? { share: 1 / 3 } : {}) }, w: r.w + w + 1 };
  };
  const singles = [...lone.filter((r) => !(mirror && r.mods.every((m) => m === 'module.pointDefense'))), ...cores, ...plan.quarters.filter((q) => !q.block), ...plan.support.filter((r) => !(mirror && r.role === 'plant')).map(brig).map(mess).map(own), ...plan.cargo.map(brig).map(racked), ...(hangars ? plan.hangars : pods)];
  const items: Item[] = blocks ? cabinPairs.map((p) => ({ specs: [p[0], p[1]], both: true, cabins: true })) : [];
  const reactor = plan.reactors > 0 ? reactorSpec(plan.reactors, plan.kit) : null;
  const shields: RoomSpec | null = plan.shields.length > 0
    ? unflat({ role: 'shields', mods: plan.shields.flatMap((s) => s.mods), w: plan.shields.reduce((t, s) => t + s.w, 0), h: Math.max(...plan.shields.map((s) => s.h)) }) : null;
  // (A point-defence turret a side, a mirrored pair of 4x4 rooms.)
  const pd: RoomSpec = { role: 'weapons', mods: ['module.pointDefense'], w: 4, h: 4 };
  // (Mirrored, the pair is fixed beside the guns.)
  if (!mirror && rules.pd) items.push({ specs: [pd, { ...pd }], both: true });
  // (Mirrored, life support is a room a side: the plan's units shared out, rounded up to a pair, the fabricator to one.)
  const plants = mirror ? plan.support.filter((r) => r.role === 'plant') : [];
  if (plants.length > 0) {
    const units = Math.ceil(plants.length / 2), fab = plants.some((r) => r.mods.includes('module.fabricator'));
    const side = (f: boolean): RoomSpec => ({ role: 'plant', mods: [...Array<string>(units).fill('module.lifeSupport'), ...(f ? ['module.fabricator'] : [])], w: 3 * units + (fab ? 1 : 0), h: 3 });
    items.push({ specs: [side(fab), side(false)], both: true });
  }
  if (reactor && shields) {
    const w = Math.max(reactor.w, shields.w), h = Math.max(reactor.h, shields.h);
    items.push({ specs: [{ ...reactor, w, h }, { ...shields, w, h }], both: true });
  } else for (const r of [reactor, shields]) if (r) items.push({ specs: [r, null], both: false });
  // (Each side on its own, or mirrored: the same gun opposite.)
  for (const p of gunPairs.slice(inBattery)) items.push(...(mirror ? [{ specs: [p[0], p[1]] as Specs, both: true }] : [{ specs: [p[0], null] as Specs, both: false }, { specs: [p[1], null] as Specs, both: false }]));
  const size = (r: RoomSpec): number => r.w * r.h + (r.annex ? r.annex.w * r.annex.h : 0);
  return [...items, ...singles.sort((a, b) => size(b) - size(a)).map((r): Item => ({ specs: [r, null], both: false }))];
}
