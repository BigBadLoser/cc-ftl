import type { ModuleDef, ShipTemplate } from '../registry';
import { allRooms, type ShipPlan } from './plan';

/** What a ship fights and works with: the modules a plan asks for that a generated ship must carry (#577). */
export type EquipKind = 'guns' | 'pointDefense' | 'shieldGens' | 'shieldConsoles' | 'droneBays' | 'vehicleBays';
export type Equipment = Record<EquipKind, number>;

const KINDS: readonly EquipKind[] = ['guns', 'pointDefense', 'shieldGens', 'shieldConsoles', 'droneBays', 'vehicleBays'];

/** The kind of equipment a module def is, or null for anything else. */
export function equipKind(d: ModuleDef | undefined): EquipKind | null {
  if (!d) return null;
  if (d.pointDefense) return 'pointDefense';
  if (d.weapon) return 'guns';
  if (d.shieldGen) return 'shieldGens';
  if (d.console === 'shields') return 'shieldConsoles';
  if (d.droneBay) return 'droneBays';
  if (d.vehicleBay) return 'vehicleBays';
  return null;
}

/** The equipment among these module defs. */
export function equipmentOf(defs: Readonly<Record<string, ModuleDef>>, mods: readonly string[]): Equipment {
  const out = Object.fromEntries(KINDS.map((k) => [k, 0])) as Equipment;
  for (const m of mods) {
    const k = equipKind(defs[m]);
    if (k) out[k]++;
  }
  return out;
}

/** What a plan asks for, after its own power budget (`planShip`), before any grammar moves it between rooms. */
export const plannedEquipment = (defs: Readonly<Record<string, ModuleDef>>, plan: ShipPlan): Equipment =>
  equipmentOf(defs, allRooms(plan).flatMap((r) => r.mods));

/** What a finished template carries short of the plan, as a problem ("short of 3 guns, 1 shieldGens"), or null when it carries it all. */
export function equipmentShort(defs: Readonly<Record<string, ModuleDef>>, planned: Equipment, t: Pick<ShipTemplate, 'modules'>): string | null {
  const got = equipmentOf(defs, (t.modules ?? []).map((m) => m.def));
  const short = KINDS.filter((k) => got[k] < planned[k]).map((k) => `${planned[k] - got[k]} ${k}`);
  return short.length > 0 ? `short of ${short.join(', ')}` : null;
}
