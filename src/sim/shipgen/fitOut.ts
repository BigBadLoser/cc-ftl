import type { Rng } from '../rng';
import type { ModuleDef, ShipTemplate } from '../registry';
import { lightRoom, placeOne, rotsOf } from './fit';
import { furnishByRule, placeFeed } from './rooms/rules/place';
import { RULES } from './rooms/rules/rules';
import { Layout } from './layout';
import type { Fitted } from './fitted';
import { placeGroundTurrets, type GroundPlan } from './groundTurrets';
import { accepts } from '../items/storage';
import { ENGINE_TIERS, REACTOR_TIERS, enginesIn, reactorsIn, type RoomSpec } from './plan';
import { equipKind, type EquipKind } from './equipment';
import type { FactionDef, RoomRole } from './types';

/**
 * The fit-out: every room furnished by rule where one fits (rooms/rules), a room no rule fits given its planned modules
 * plainly, then lights and extra reactors (split from generate.ts). Ships and stations alike.
 */

/** Extra validation of a finished template (stations add their own rules), returning problems. */
export type ExtraCheck = (t: ShipTemplate, defs: Record<string, ModuleDef>) => string[];
export interface FinishOpts {
  immobile?: boolean;
  check?: ExtraCheck;
  /** Turrets to stand on open ground outside the hull, cabled to it (a prefab asteroid base's guns and point defence: groundTurrets.ts). */
  ground?: GroundPlan;
  /** Rooms where a module standing apart on open ground is entered: the fit-out checks its walk from there (a prefab farm's greenhouses). */
  entries?: ReadonlySet<number>;
}

/** Rooms, in order, that take a piece of the plan's equipment its own room had no space for (`fitOut`, #577). */
const ELSEWHERE: Record<EquipKind, readonly RoomRole[]> = {
  guns: ['weapons'],
  pointDefense: ['core', 'weapons', 'shields'],
  shieldGens: ['shields', 'reactor', 'engine', 'core'],
  shieldConsoles: ['bridge', 'core', 'shields'],
  droneBays: ['core', 'hangar'],
  vehicleBays: [],
};

/** Placement order: hull-bound and required modules first, stores last. */
const ORDER = [
  ...ENGINE_TIERS, 'module.airlock', 'module.helm', 'module.weaponsConsole', 'module.aiCore', 'module.vehicle_bay', 'module.shieldConsole',
];
const rank = (id: string, d: ModuleDef): number => {
  const i = ORDER.indexOf(id);
  if (i >= 0) return i;
  if (d.weapon) return 10;
  if (d.pointDefense) return 11;
  if (d.shieldGen) return 12;
  if (d.power > 0) return 13;
  if (d.bed) return 14;
  return 15;
};

/** Place every room's planned modules in that room; a reason string when something essential does not fit. */
export function fitOut(
  rng: Rng, f: FactionDef, rows: string[], roomOf: Int16Array, roles: RoomRole[], specs: (RoomSpec | undefined)[], defs: Record<string, ModuleDef>,
  o: Pick<FinishOpts, 'immobile' | 'ground' | 'entries'> = {},
): Fitted {
  const lay = new Layout(rows, roomOf, roles, defs);
  for (const e of o.entries ?? []) lay.entries.add(e);
  const out: Fitted = { lay, stock: new Map(), vehicles: new Map(), drones: new Map() };
  const jobs: { room: number; def: string; spec: RoomSpec }[] = [];
  specs.forEach((spec, room) => { for (const def of spec?.mods ?? []) jobs.push({ room, def, spec: spec as RoomSpec }); });
  jobs.sort((a, b) => (a.spec.sealed ? 0 : 1) - (b.spec.sealed ? 0 : 1) || rank(a.def, defs[a.def] as ModuleDef) - rank(b.def, defs[b.def] as ModuleDef));
  const placed: Record<string, number> = {};
  const wanted: Record<string, number> = {};
  // Rooms a rule furnished: their planned modules are in.
  const furnished = new Set<number>();
  // Equipment its own room has no space for stands in another room where it still belongs: the plan's equipment is required (#577).
  const elsewhere = (id: string, room: number): number[] => {
    const k = equipKind(defs[id]);
    return (k ? ELSEWHERE[k] : []).flatMap((r) => roles.flatMap((x, i) => (x === r && i !== room && !specs[i]?.sealed ? [i] : [])));
  };
  const rots = (id: string): number[] => rotsOf(id, defs[id] as ModuleDef);
  const stockUp = (idx: number, spec: RoomSpec | undefined): void => {
    const id = lay.modules[idx]?.def as string;
    if (spec?.stock && defs[id]?.storage) {
      const items = spec.items ?? f.stock;
      // An ore bin holds one ore (its sprite shows one kind): pick one from the room's stock list.
      const art = defs[id]?.storageArt;
      const ores = art ? items.filter((s) => art[s.item]) : [];
      const pick = ores.length > 0 ? [ores[rng.int(0, ores.length - 1)] as (typeof items)[number]] : items;
      // Each store keeps only what it accepts (a cold store takes no water): rolled for every listed item all the same, so the draws do not shift.
      const filter = defs[id]?.storageAccepts ?? null;
      out.stock.set(idx, pick.map((s) => ({ item: s.item, count: rng.int(s.min, s.max) })).filter((s) => s.count > 0 && accepts(filter, s.item)));
    }
  };
  {
    // Every room is furnished by rule where one fits. Halls and plazas have no spec (nothing planned in them): a rule may
    // still dress them.
    roles.forEach((role, room) => {
      const spec = specs[room], mods = spec?.mods ?? [];
      if (spec?.sealed || (!spec && role !== 'hall' && role !== 'plaza') || !RULES[role]) return;
      const got = furnishByRule(lay, rng, room, role, mods, rots, spec?.bastion ? { bastion: true } : {});
      if (got) furnished.add(room);
      for (const idx of got ?? []) {
        const id = lay.modules[idx]?.def as string;
        placed[id] = (placed[id] ?? 0) + 1;
        stockUp(idx, spec);
        if (spec?.vehicle && defs[id]?.vehicleBay) out.vehicles.set(idx, defs[id]?.vehicleBay?.builtWith ?? 'vehicle.shuttle');
        if (spec?.drones && defs[id]?.droneBay) out.drones.set(idx, Array<string>(Math.min(spec.drones.count, defs[id]?.droneBay?.slots ?? 0)).fill(spec.drones.def));
      }
    });
  }
  for (const j of jobs) {
    wanted[j.def] = (wanted[j.def] ?? 0) + 1;
    if (furnished.has(j.room)) continue;
    const pm = placeOne(lay, rng, j.def, [j.room], { rots: rots(j.def), spread: !!defs[j.def]?.weapon, ...(j.spec.sealed ? { sealed: true } : {}) })
      ?? (j.spec.sealed ? null : placeOne(lay, rng, j.def, elsewhere(j.def, j.room), { rots: rots(j.def), spread: !!defs[j.def]?.weapon }));
    if (!pm) continue;
    placed[j.def] = (placed[j.def] ?? 0) + 1;
    const idx = lay.modules.length - 1;
    stockUp(idx, j.spec);
    // A room no rule fit: what the module feeds from goes flush against it all the same (a refinery's ore bin).
    {
      let fi = placeFeed(lay, j.room, idx);
      // No room for it there: the module tries the room's other spots in turn until its feed fits beside it.
      const was = lay.modules[idx];
      if (fi === null && was && lay.modules.length - 1 === idx) {
        lay.pop();
        for (const t of lay.roomTiles(j.room)) {
          for (const rot of rots(j.def)) {
            const x = t % lay.w, y = Math.floor(t / lay.w);
            if (lay.fitError(j.def, x, y, rot, j.room) !== null) continue;
            lay.push({ def: j.def, x, y, rot });
            fi = placeFeed(lay, j.room, idx);
            if (fi !== null) break;
            lay.pop();
          }
          if (fi !== null) break;
        }
        if (fi === null) lay.push(was);
      }
      if (fi !== null) stockUp(fi, j.spec);
    }
    if (j.spec.vehicle && defs[j.def]?.vehicleBay) out.vehicles.set(idx, defs[j.def]?.vehicleBay?.builtWith ?? 'vehicle.shuttle');
    if (j.spec.drones && defs[j.def]?.droneBay) out.drones.set(idx, Array<string>(Math.min(j.spec.drones.count, defs[j.def]?.droneBay?.slots ?? 0)).fill(j.spec.drones.def));
  }
  if (o.ground) {
    const g = placeGroundTurrets(lay, o.ground);
    for (const id of o.ground.mods) wanted[id] = (wanted[id] ?? 0) + 1;
    for (const pd of g.pads) if (pd.vehicle) out.vehicles.set(pd.index, pd.vehicle); // a pad's home shuttle
    for (const k of g.placed) { const id = lay.modules[k]?.def as string; placed[id] = (placed[id] ?? 0) + 1; }
    out.ground = { placed: new Set(g.placed), cable: g.cable, unwired: g.unwired };
  }
  if (out.ground && out.ground.unwired > 0) return { ...out, error: 'a module standing apart has no cable' };
  const count = (m: Record<string, number>, id: string): number => (id === 'module.engine' ? enginesIn(m) : id === 'module.reactor' ? reactorsIn(m) : (m[id] ?? 0));
  const missing = (id: string): boolean => count(wanted, id) > 0 && count(placed, id) === 0;
  for (const id of ['module.engine', 'module.helm', 'module.airlock', 'module.reactor', 'module.weaponsConsole', 'module.aiCore', 'module.vehicle_bay']) {
    if (missing(id)) return { ...out, error: `no ${id.replace('module.', '')} fits` };
  }
  const guns = (m: Record<string, number>): number => Object.entries(m).filter(([id]) => defs[id]?.weapon).reduce((t, [, n]) => t + n, 0);
  // Only a fit that wanted guns (or point defence) can fail for them: an unarmed recipe wants none.
  if (guns(wanted) > 0 && (guns(placed) === 0 || guns(placed) * 4 < guns(wanted) * 3)) return { ...out, error: 'weapons do not fit' };
  const pd = (m: Record<string, number>): number => Object.entries(m).filter(([id]) => defs[id]?.pointDefense).reduce((t, [, n]) => t + n, 0);
  if (o.ground && pd(wanted) > 0 && pd(placed) < pd(wanted)) return { ...out, error: 'point defence does not fit' };
  if (reactorsIn(placed) < reactorsIn(wanted)) return { ...out, error: 'reactors do not fit' };
  for (let room = 0; room < roles.length; room++) lightRoom(lay, rng, room);
  let supply = 0;
  let demand = 0;
  for (const m of lay.modules) { const p = (defs[m.def] as ModuleDef).power; if (p > 0) supply += p; else demand -= p; }
  // Short of power after lighting: squeeze extra reactors into engineering or stores (never a mess or other living room).
  // A station plans its reactors (assembly/program.ts) and squeezes one in only where reactors stand.
  const spare = roles.map((r, i) => (r === 'reactor' || r === 'engine' || (r === 'cargo' && !o.immobile) ? i : -1)).filter((i) => i >= 0);
  // Courts (lit to scale, so lamp-hungry) can take a reactor on their open floor as a last resort; not on a station.
  const courts = o.immobile ? [] : roles.map((r, i) => (r === 'plaza' || r === 'garden' || r === 'drill' ? i : -1)).filter((i) => i >= 0);
  // An extra reactor: the ship's own tier (the one its plan asked for) where one fits, else the smaller tiers down to Mk I.
  const own = REACTOR_TIERS.findIndex((id) => (wanted[id] ?? 0) > 0);
  const extras = REACTOR_TIERS.slice(0, Math.max(0, own) + 1).reverse().filter((id) => defs[id]);
  for (let k = 0; k < (courts.length > 0 ? 6 : 3) && supply < demand; k++) {
    const id = extras.find((x) => (k < 3 && placeOne(lay, rng, x, spare)) || (courts.length > 0 && placeOne(lay, rng, x, courts)));
    if (!id) break;
    supply += (defs[id] as ModuleDef).power;
  }
  if (supply < demand) return { ...out, error: 'not enough power' };
  return out;
}
