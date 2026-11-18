import type { Rng } from '../rng';
import type { ModuleDef, ShipTemplate } from '../registry';
import { lightRoom, placeOne, rotsOf } from './fit';
import { RECIPES, drawRoom, hostCompanions, reserveWalkway, furnish, placeStep, specStep, type RoomDraw } from './rooms';
import { furnishByRule, placeFeed } from './rooms/rules/place';
import { RULES } from './rooms/rules/rules';
import { Layout } from './layout';
import type { Fitted } from './fitted';
import { placeGroundTurrets, type GroundPlan } from './groundTurrets';
import { accepts } from '../items/storage';
import { ENGINE_TIERS, enginesIn, type RoomSpec } from './plan';
import { equipKind, type EquipKind } from './equipment';
import type { FactionDef, RoomRole } from './types';

/** The fit-out: every room's planned modules placed in it, then lights and extra reactors (split from generate.ts). */

/** Extra validation of a finished template (stations add their own rules), returning problems. */
export type ExtraCheck = (t: ShipTemplate, defs: Record<string, ModuleDef>) => string[];
export interface FinishOpts {
  immobile?: boolean;
  check?: ExtraCheck;
  /** Airlocks may face any way (the station assembly; the arranger's hulls keep theirs off the stern). */
  airlocksAnyWay?: boolean;
  /** Guns may stand anywhere in their bay, as the game allows (the arranger's hulls keep theirs beside the hull). */
  gunsAnywhere?: boolean;
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
  recipes = RECIPES, o: Pick<FinishOpts, 'airlocksAnyWay' | 'gunsAnywhere' | 'immobile' | 'ground' | 'entries'> = {},
): Fitted {
  const lay = new Layout(rows, roomOf, roles, defs);
  lay.gunsOnHull = !o.gunsAnywhere;
  for (const e of o.entries ?? []) lay.entries.add(e);
  const out: Fitted = { lay, stock: new Map(), vehicles: new Map(), drones: new Map() };
  const jobs: { room: number; def: string; spec: RoomSpec }[] = [];
  specs.forEach((spec, room) => { for (const def of spec?.mods ?? []) jobs.push({ room, def, spec: spec as RoomSpec }); });
  jobs.sort((a, b) => (a.spec.sealed ? 0 : 1) - (b.spec.sealed ? 0 : 1) || rank(a.def, defs[a.def] as ModuleDef) - rank(b.def, defs[b.def] as ModuleDef));
  const placed: Record<string, number> = {};
  const wanted: Record<string, number> = {};
  // Rooms with a recipe draw their arrangement once; their planned modules go where the recipe says.
  const draws = new Map<number, RoomDraw>();
  // Station rooms furnished by rule (rooms/rules), and those no rule fits, which get their planned modules plainly.
  const ruled = new Set<number>(), furnished = new Set<number>();
  const drawOf = (room: number): RoomDraw | null => {
    const recipe = recipes[roles[room] as RoomRole];
    if (!recipe || specs[room]?.sealed || ruled.has(room)) return null;
    if (!draws.has(room)) {
      const d = drawRoom(rng, recipe);
      draws.set(room, d);
      reserveWalkway(lay, room, d);
    }
    return draws.get(room) as RoomDraw;
  };
  // Equipment its own room has no space for stands in another room where it still belongs: the plan's equipment is required (#577).
  const elsewhere = (id: string, room: number): number[] => {
    const k = equipKind(defs[id]);
    return (k ? ELSEWHERE[k] : []).flatMap((r) => roles.flatMap((x, i) => (x === r && i !== room && !specs[i]?.sealed ? [i] : [])));
  };
  const rots = (id: string): number[] => (o.airlocksAnyWay && defs[id]?.airlock ? [0, 1, 2, 3] : rotsOf(id, defs[id] as ModuleDef));
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
  // Planned modules per room and def, for steps that place only a share of them.
  const planned = new Map<string, number>();
  for (const j of jobs) planned.set(`${j.room} ${j.def}`, (planned.get(`${j.room} ${j.def}`) ?? 0) + 1);
  const done = new Map<string, number>();
  if (o.immobile) {
    // Stations are furnished by rule alone: no room recipe runs. A room no rule fits gets its planned modules set plainly.
    // Halls and plazas have no spec (nothing planned in them): a rule may still dress them.
    roles.forEach((role, room) => {
      const spec = specs[room], mods = spec?.mods ?? [];
      ruled.add(room);
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
    const d = drawOf(j.room);
    const si = d ? specStep(d, j.def) : -1;
    const share = d && si >= 0 ? d.arr.steps[si]?.share : undefined;
    const k = `${j.room} ${j.def}`;
    if (share !== undefined && (done.get(k) ?? 0) >= Math.max(1, Math.ceil((planned.get(k) ?? 0) * share))) { wanted[j.def] = (wanted[j.def] ?? 1) - 1; continue; }
    done.set(k, (done.get(k) ?? 0) + 1);
    const pm = (d && si >= 0 ? placeStep(lay, rng, j.room, d, si, rots(j.def)) : null)
      ?? placeOne(lay, rng, j.def, [j.room], { rots: rots(j.def), spread: !!defs[j.def]?.weapon, ...(j.spec.sealed ? { sealed: true } : {}) })
      ?? (j.spec.sealed ? null : placeOne(lay, rng, j.def, elsewhere(j.def, j.room), { rots: rots(j.def), spread: !!defs[j.def]?.weapon }));
    if (!pm) continue;
    placed[j.def] = (placed[j.def] ?? 0) + 1;
    const idx = lay.modules.length - 1;
    stockUp(idx, j.spec);
    if (d && si >= 0) {
      const n = lay.modules.length;
      hostCompanions(lay, rng, j.room, d, si, pm);
      for (let i = n; i < lay.modules.length; i++) stockUp(i, j.spec);
    }
    // A station room no rule fit: what the module feeds from goes flush against it all the same (a refinery's ore bin).
    if (o.immobile && !d) {
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
  const missing = (id: string): boolean => (id === 'module.engine' ? enginesIn(wanted) > 0 && enginesIn(placed) === 0 : (wanted[id] ?? 0) > 0 && (placed[id] ?? 0) === 0);
  for (const id of ['module.engine', 'module.helm', 'module.airlock', 'module.reactor', 'module.weaponsConsole', 'module.aiCore', 'module.vehicle_bay']) {
    if (missing(id)) return { ...out, error: `no ${id.replace('module.', '')} fits` };
  }
  const guns = (m: Record<string, number>): number => Object.entries(m).filter(([id]) => defs[id]?.weapon).reduce((t, [, n]) => t + n, 0);
  // Only a fit that wanted guns (or point defence) can fail for them: an unarmed recipe wants none.
  if (guns(wanted) > 0 && (guns(placed) === 0 || guns(placed) * 4 < guns(wanted) * 3)) return { ...out, error: 'weapons do not fit' };
  const pd = (m: Record<string, number>): number => Object.entries(m).filter(([id]) => defs[id]?.pointDefense).reduce((t, [, n]) => t + n, 0);
  if (o.ground && pd(wanted) > 0 && pd(placed) < pd(wanted)) return { ...out, error: 'point defence does not fit' };
  if ((placed['module.reactor'] ?? 0) < (wanted['module.reactor'] ?? 0)) return { ...out, error: 'reactors do not fit' };
  // Rooms with a recipe are lit after they are furnished, so lamps take the walkways the furniture leaves.
  for (let room = 0; room < roles.length; room++) if (!drawOf(room)) lightRoom(lay, rng, room);
  let supply = 0;
  let demand = 0;
  for (const m of lay.modules) { const p = (defs[m.def] as ModuleDef).power; if (p > 0) supply += p; else demand -= p; }
  // Lamps the furnished rooms will need (a trial lighting, taken back: they are lit after furnishing), plus a margin.
  const recipeRooms = roles.map((_, i) => i).filter((i) => drawOf(i));
  let lamps = 0;
  for (const room of recipeRooms) {
    const n = lay.modules.length;
    lightRoom(lay, rng, room);
    lamps += lay.modules.length - n;
    while (lay.modules.length > n) lay.pop();
  }
  const lampPower = -((defs['module.light'] as ModuleDef | undefined)?.power ?? 0);
  demand += lamps * lampPower;
  // Furniture can push a lamp off its first-choice tile: keep a lamp per furnished room in hand.
  const margin = recipeRooms.length * lampPower;
  // Short of power after lighting: squeeze extra reactors into engineering or stores (never a mess or other living room).
  // A station plans its reactors (assembly/program.ts) and squeezes one in only where reactors stand.
  const spare = roles.map((r, i) => (r === 'reactor' || r === 'engine' || (r === 'cargo' && !o.immobile) ? i : -1)).filter((i) => i >= 0);
  // Courts (lit to scale, so lamp-hungry) can take a reactor on their open floor as a last resort; not on a station.
  const courts = o.immobile ? [] : roles.map((r, i) => (r === 'plaza' || r === 'garden' || r === 'drill' ? i : -1)).filter((i) => i >= 0);
  const reactor = defs['module.reactor'];
  for (let k = 0; k < (courts.length > 0 ? 6 : 3) && supply < demand + margin && reactor; k++) {
    if (!(k < 3 && placeOne(lay, rng, 'module.reactor', spare)) && !(courts.length > 0 && placeOne(lay, rng, 'module.reactor', courts))) break;
    supply += reactor.power;
  }
  if (supply < demand) return { ...out, error: 'not enough power' };
  // Furnishing: recipe extras that draw power (a galley) only while the planned reactors cover them, with a margin
  // kept for the lamps those rooms still need.
  const power = { spare: supply - demand - margin };
  for (const room of recipeRooms) {
    const d = drawOf(room) as RoomDraw;
    const before = lay.modules.length;
    furnish(lay, rng, room, d, rots, power);
    for (let i = before; i < lay.modules.length; i++) stockUp(i, specs[room]);
    lightRoom(lay, rng, room);
  }
  let draw = 0;
  for (const m of lay.modules) draw -= Math.min(0, (defs[m.def] as ModuleDef).power);
  if (supply < draw) return { ...out, error: 'not enough power' };
  return out;
}
