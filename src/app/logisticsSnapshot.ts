import {
  AllegianceC, CarryingC, ItemStackC, JobC, ModuleC, ProductionC, ShipC, StorageC, needsMaterials, type ItemQty, type Sim,
} from '../sim';
import { TICK_HZ } from '../sim';
import { shipIdAt, shipIdOf } from '../sim/regions';
import type { UiCost, UiFab, UiItemDef, UiOrder, UiRecipe, UiStock, UiStorage } from '../ui/api';

const nameOf = (sim: Sim, item: string): string => sim.content.items[item]?.name ?? item;
export const costsOf = (sim: Sim, list: readonly ItemQty[] | undefined): UiCost[] =>
  (list ?? []).map((q) => ({ item: q.item, name: nameOf(sim, q.item), count: q.count }));

export function buildItemDefs(sim: Sim): UiItemDef[] {
  return Object.entries(sim.content.items).map(([id, d]) => ({ id, name: d.name, stackSize: d.stackSize, food: !!d.food }));
}

export function buildRecipes(sim: Sim): UiRecipe[] {
  return Object.entries(sim.content.recipes).map(([id, r]) => ({
    id, name: r.name, station: r.station, inputs: costsOf(sim, r.inputs), outputs: costsOf(sim, r.outputs), seconds: r.work / TICK_HZ,
  }));
}

export function buildStructCosts(sim: Sim): Record<string, UiCost[]> {
  return Object.fromEntries(Object.entries(sim.content.structCosts).map(([k, v]) => [k, costsOf(sim, v)]));
}

/** True for a region the player owns (the home ship, claimed bases and prizes): stock elsewhere is not "ours". */
const isPlayerShip = (sim: Sim, shipId: number): boolean => sim.world.get(shipId, ShipC)?.faction === 'player';

/** Totals per item on the player's ships: on the floor, in storage and in crew hands. Items with nothing anywhere are left out. */
export function buildStock(sim: Sim): UiStock[] {
  const by = new Map<string, UiStock>();
  const row = (item: string): UiStock => {
    let r = by.get(item);
    if (!r) by.set(item, (r = { item, name: nameOf(sim, item), floor: 0, stored: 0, carried: 0 }));
    return r;
  };
  for (const id of sim.world.query(ItemStackC)) {
    const s = sim.world.get(id, ItemStackC);
    if (s && isPlayerShip(sim, shipIdAt(sim, s.x, s.y))) row(s.item).floor += s.count;
  }
  for (const id of sim.world.query(StorageC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || !isPlayerShip(sim, shipIdOf(sim, m))) continue;
    for (const st of sim.world.get(id, StorageC)?.stacks ?? []) row(st.item).stored += st.count;
  }
  for (const id of sim.world.query(CarryingC)) {
    const c = sim.world.get(id, CarryingC);
    if (c && sim.world.get(id, AllegianceC)?.faction === 'player') row(c.item).carried += c.count;
  }
  const order = Object.keys(sim.content.items);
  return [...by.values()].filter((r) => r.floor + r.stored + r.carried > 0).sort((a, b) => order.indexOf(a.item) - order.indexOf(b.item));
}

export function buildStorages(sim: Sim): UiStorage[] {
  const out: UiStorage[] = [];
  for (const id of sim.world.query(StorageC)) {
    const s = sim.world.get(id, StorageC);
    if (s) out.push({ id, capacity: s.capacity, filter: s.filter ? [...s.filter] : null, stacks: s.stacks.map((x) => ({ ...x })) });
  }
  return out;
}

export function buildFabs(sim: Sim): UiFab[] {
  // Stock of the player's ships only (a station's crates do not feed our fabricator).
  const held = new Map(buildStock(sim).map((r) => [r.item, r.floor + r.stored]));
  const have = (item: string): number => held.get(item) ?? 0;
  const jobs = new Map<number, number>();
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    if (j?.kind === 'craft' && j.target) jobs.set(j.target, id);
  }
  const out: UiFab[] = [];
  for (const id of sim.world.query(ProductionC)) {
    const prod = sim.world.get(id, ProductionC);
    const m = sim.world.get(id, ModuleC);
    if (!prod || !m) continue;
    const jobId = jobs.get(id);
    const job = jobId ? sim.world.get(jobId, JobC) : undefined;
    const current = job?.craft?.recipe;
    let marked = false;
    const orders: UiOrder[] = prod.orders.map((o) => {
      const recipe = sim.content.recipes[o.recipe];
      const first = recipe?.outputs[0];
      const active = !marked && o.recipe === current;
      if (active) marked = true;
      return {
        recipe: o.recipe, name: recipe?.name ?? o.recipe, mode: o.mode, target: o.target, done: o.done,
        have: first ? have(first.item) : 0, active,
        missing: (recipe?.inputs ?? []).filter((q) => have(q.item) < q.count).map((q) => nameOf(sim, q.item)),
      };
    });
    let state: NonNullable<UiFab['job']> | null = null;
    if (job) {
      const phase = needsMaterials(job) ? 'materials' : !m.powered || !m.enabled ? 'power' : job.progress > 0 ? 'crafting' : 'ready';
      state = { name: sim.content.recipes[current ?? '']?.name ?? 'Crafting', progress: Math.min(1, job.progress / Math.max(1, job.work)), phase };
    }
    out.push({ id, orders, job: state });
  }
  return out;
}
