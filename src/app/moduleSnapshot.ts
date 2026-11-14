import { CrewC, DeadC, blueprintVenue, hullLoad, isBlueprintKnown, ModuleC, PositionC, roomTiles, type ModuleDef, type Sim } from '../sim';
import { moduleNameOf } from '../sim/upgrades/stats';
import { buildRobotBay } from './robotSnapshot';
import { buildDroneBay } from './droneSnapshot';
import { costsOf } from './logisticsSnapshot';
import { buildFood } from './foodSnapshot';
import { buildPlot } from './plotSnapshot';
import { buildReserve, buildReserves } from './reserveSnapshot';
import { buildWheel } from './stasisSnapshot';
import { hasFuel } from '../sim/modules/energy';
import { isIdle } from '../sim/modules/draw';
import { buildHeat } from './heatSnapshot';
import { buildStock } from './logisticsSnapshot';
import { fitJobOf, fittingChoices } from '../sim/upgrades/fit';
import { shipStoreCount } from '../sim/items/stock';
import { upgradeEffects } from './upgradeText';
import type { UiUpgradeItem, UiUpgradeSlot, UiModule, UiModuleDef, UiStats } from '../ui/api';
import { shipIdOf, shipGrid } from '../sim/regions';
import { homeShip } from '../sim/index';


/** A sector tile in its grid's local tiles (from the grid's top-left), for readouts. */
export function localOf(sim: Sim, shipId: number, x: number, y: number): { x: number; y: number } {
  const g = shipGrid(sim, shipId);
  return { x: x - (g?.x0 ?? 0), y: y - (g?.y0 ?? 0) };
}

/** Plain-data module list for the UI. Reads the sim, never mutates it. */
export function buildModuleList(sim: Sim): UiModule[] {
  const out: UiModule[] = [];
  const GRID = homeShip(sim);
  const home = homeShip(sim);
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || shipIdOf(sim, m) !== GRID) continue;
    out.push({
      id, ship: home, def: m.def, name: moduleNameOf(sim, id), x: m.x, y: m.y, local: localOf(sim, shipIdOf(sim, m), m.x, m.y), hp: Math.round(m.hp), maxHp: def.maxHp, repairFirst: !!m.repairFirst,
      powerPriority: m.powerPriority, enabled: m.enabled, powered: m.powered && m.enabled && m.hp > 0, power: def.power,
      reserve: buildReserve(sim, id), wheel: def.stasisWheel ? buildWheel(sim, id) : null, storage: !!def.storage, crafting: !!def.crafting, research: !!def.research, plot: def.plot ? buildPlot(sim, id) : null, idle: isIdle(sim, id, def), bay: def.robotBay ? buildRobotBay(sim, id) : null, droneBay: def.droneBay ? buildDroneBay(sim, id) : null,
      upgradeSlot: def.upgradeSlot ? upgradeSlotOf(sim, id) : null,
    });
  }
  return out;
}

/** Popover facts of a module def: power, who operates it, then its own stats. */
function moduleFacts(d: ModuleDef): UiModuleDef['facts'] {
  const f: UiModuleDef['facts'] = [{ label: 'Power', value: d.power > 0 ? `+${d.power} ⚡` : d.power < 0 ? `−${-d.power} ⚡` : 'none', ...(d.power < 0 ? { tone: 'warn' as const } : {}) }];
  const op = d.console ? `crew (${d.console})` : d.engine ? 'pilot' : d.crafting ? 'crew (crafting)' : d.galley ? 'crew (eats here)' : d.bed ? 'sleeper' : d.workstation ? 'crew' : null;
  f.push({ label: 'Operator', value: op ?? 'none' });
  if (d.shieldGen) f.push({ label: 'Shield layers', value: `${Math.floor(Math.abs(d.power) * d.shieldGen.layersPerPower)}, 1 per ${d.shieldGen.rechargeSec}s` });
  if (d.storage) f.push({ label: 'Capacity', value: `${d.storage.capacity} stacks` });
  if (d.o2PerSec) f.push({ label: 'Oxygen', value: `+${d.o2PerSec}/s` });
  if (d.light) f.push({ label: 'Light radius', value: `${d.light.radius} tiles` });
  if (d.engine) f.push({ label: 'Evasion', value: `+${d.engine.evasionPerPower} per power` });
  if (d.airlock) f.push({ label: 'Cycle', value: `${d.airlock.cycleSec}s` });
  f.push({ label: 'Hull points', value: String(d.maxHp) });
  return f;
}

const TIER_NAME: Record<number, string> = { 1: 'Mk I', 2: 'Mk II', 3: 'Mk III' };
const familyOf = (id: string): string => id.replace(/\.mk\d$/, '');

export function buildModuleDefs(sim: Sim): UiModuleDef[] {
  const mods = sim.content.modules;
  return Object.entries(mods).map(([id, d]) => {
    const family = familyOf(id);
    const tiered = !!d.blueprint || Object.keys(mods).some((o) => o !== id && familyOf(o) === id);
    return {
      id,
      name: d.name,
      w: d.footprint[0],
      h: d.footprint[1],
      power: d.power,
      cost: costsOf(sim, d.cost),
      category: d.category ?? 'utility',
      description: d.description ?? '',
      access: d.access ? [d.access, ...(d.extraAccess ?? [])].map(([x, y]) => [x, y] as [number, number]) : [],
      facts: moduleFacts(d),
      tier: tiered ? TIER_NAME[d.blueprint?.tier ?? 1] ?? null : null,
      family: tiered ? family : null,
      locked: !isBlueprintKnown(sim, id),
      lockHint: d.blueprint ? `Blueprint: ${blueprintVenue(d) === 'military' ? 'military' : 'research'} stations` : null,
    };
  });
}

/** Power supply/demand of the ship and the average O2 of the rooms crew stand in. */
export function buildStats(sim: Sim): UiStats {
  const GRID = homeShip(sim);
  let supply = 0;
  let demand = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || shipIdOf(sim, m) !== GRID || !m.enabled || m.hp <= 0) continue;
    if (def.power > 0) supply += hasFuel(m, def) ? def.power : 0; // an empty reactor supplies nothing
    else demand -= def.power;
  }
  let o2: number | null = null;
  const grid = shipGrid(sim, GRID);
  if (grid) {
    const rooms = new Set<number>();
    for (const id of sim.world.query(CrewC, PositionC)) {
      const p = sim.world.get(id, PositionC);
      if (!p || shipIdOf(sim, p) !== GRID || sim.world.has(id, DeadC) || !grid.inBounds(p.x, p.y)) continue;
      const r = grid.get('room', p.x, p.y);
      if (r) rooms.add(r);
    }
    let sum = 0;
    for (const r of rooms) {
      const tiles = roomTiles(grid).get(r) ?? [];
      // roomTiles indices run from the grid's top-left (x0, y0).
      const o2At = (i: number) => grid.get('o2', grid.x0 + (i % grid.width), grid.y0 + Math.floor(i / grid.width));
      sum += tiles.reduce((a, i) => a + o2At(i), 0) / Math.max(1, tiles.length);
    }
    if (rooms.size) o2 = sum / rooms.size;
  }
  const load = hullLoad(sim, GRID);
  return { supply, demand, ...buildReserves(sim, GRID), food: buildFood(sim, buildStock(sim)), heat: buildHeat(sim), o2, hull: { tiles: load.tiles, capacity: load.capacity } };
}

function upgradeItem(sim: Sim, item: string, shipId: number): UiUpgradeItem {
  const d = sim.content.items[item];
  return { item, name: d?.name ?? item, effects: d?.upgrade ? upgradeEffects(d.upgrade) : [], count: shipStoreCount(sim, shipId, item) };
}

/** The slot panel's data for a module with an upgrade slot. */
function upgradeSlotOf(sim: Sim, id: number): UiUpgradeSlot {
  const m = sim.world.get(id, ModuleC);
  const ship = shipIdOf(sim, m);
  const job = fitJobOf(sim, id)?.[1];
  return {
    fitted: m?.upgrade ? upgradeItem(sim, m.upgrade, ship) : null,
    job: job ? { item: job.fit?.item ? upgradeItem(sim, job.fit.item, ship) : null, working: job.progress > 0 } : null,
    options: fittingChoices(sim, id).map((i) => upgradeItem(sim, i, ship)),
  };
}
