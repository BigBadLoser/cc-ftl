import { AirlockC, SuitC, freeSuits, needsAir, suitAir, suitDef, suitTile, AboardC, AllegianceC, AssignmentC, CarriedC, CarryingC, CrewC, DeadC, DownedC, DraftedC, FighterC, HealthC, InertC, JobC, ModuleC, MoodC, MOOD_LABELS, NeedsC, PositionC, PrioritiesC, PrisonerC, ShipC, StorageC, SurrenderedC, TICK_HZ, VehicleC, WORK_CATEGORIES, sightLine, storageCount, Struct, wielded, EVA_AIR_LOW_FRAC, MOOD_LOW, MOOD_VERY_LOW, MOOD_LOW_WORK_MULT, MOOD_VERY_LOW_WORK_MULT, type Job, type Sim, type WorkCategory } from '../sim';
import type { UiCrew, UiFight } from '../ui/api';
import { localOf } from './moduleSnapshot';
import { shipIdOf, shipGrid } from '../sim/regions';
import { homeShip } from '../sim/index';

const STRUCT_LABEL: Record<number, string> = Object.fromEntries(Object.entries(Struct).map(([k, v]) => [v, k.toLowerCase()]));
const NONE = Object.fromEntries(WORK_CATEGORIES.map((c) => [c, 0])) as Record<WorkCategory, number>;

function jobLabel(sim: Sim, j: Job): string {
  const mod = j.module ? (sim.content.modules[j.module.def]?.name ?? 'module') : 'module';
  switch (j.kind) {
    case 'build': return `Building ${STRUCT_LABEL[j.struct] ?? 'structure'}`;
    case 'deconstruct': return 'Deconstructing';
    case 'module': return `Building ${mod}`;
    case 'moduleDecon': return 'Deconstructing module';
    case 'extinguish': return 'Fighting fire';
    case 'repair': return 'Repairing';
    case 'rescue': return 'Rescuing crew';
    case 'haul': return 'Hauling';
    case 'craft': return 'Crafting';
    default: return j.kind;
  }
}

/** Per-build lookups shared by every crew card. */
interface Ctx {
  ships: Map<number, string>;
  arms: Map<number, { item: string; name: string; count: number }[]>;
}

function makeCtx(sim: Sim): Ctx {
  const ships = new Map<number, string>();
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (s) ships.set(id, s.name);
  }
  return { ships, arms: new Map() };
}

/** Hand weapons sitting in storage on a grid (what a crew member there can fetch). */
function armsOn(sim: Sim, ctx: Ctx, shipId: number) {
  let out = ctx.arms.get(shipId);
  if (out) return out;
  out = [];
  const items = Object.entries(sim.content.items).filter(([, d]) => d.hand);
  for (const [item, def] of items) {
    let count = 0;
    for (const sid of sim.world.query(StorageC, ModuleC)) {
      const m = sim.world.get(sid, ModuleC);
      if (m && shipIdOf(sim, m) === shipId && m.hp > 0) count += storageCount(sim, sid, item);
    }
    if (count > 0) out.push({ item, name: def.name, count });
  }
  ctx.arms.set(shipId, out);
  return out;
}

function whereOf(sim: Sim, ctx: Ctx, id: number): { shipId: number; where: string } {
  const pos = sim.world.get(id, PositionC);
  if (pos) return { shipId: shipIdOf(sim, pos), where: ctx.ships.get(shipIdOf(sim, pos)) ?? 'Ship' };
  const aboard = sim.world.get(id, AboardC);
  const v = aboard && sim.world.get(aboard.vehicle, VehicleC);
  if (!v) return { shipId: 0, where: 'Unknown' };
  const dockShip = v.state === 'docked' ? ctx.ships.get(shipIdOf(sim, sim.world.get(v.dock, ModuleC)) ?? 0) : null;
  return { shipId: 0, where: v.state === 'stowed' ? 'Shuttle (in bay)' : dockShip ? `Shuttle at ${dockShip}` : 'Shuttle (flying)' };
}

function evaShuttleOf(sim: Sim, id: number): number | null {
  const vid = sim.world.get(id, SuitC)?.vehicle;
  const v = vid ? sim.world.get(vid, VehicleC) : undefined;
  const pos = sim.world.get(id, PositionC);
  return vid && v && pos && v.state === 'flying' && !v.dest && !!v.hover && v.hover === (shipIdOf(sim, pos)) ? vid : null;
}

function isOutside(sim: Sim, id: number): boolean {
  const p = sim.world.get(id, PositionC);
  const g = p && shipGrid(sim, shipIdOf(sim, p));
  return !!g && g.inBounds(p.x, p.y) && g.get('struct', p.x, p.y) === Struct.Space;
}

/** The suit tank readout of a suited crew member. */
function suitOf(sim: Sim, id: number): UiCrew['suit'] {
  if (!sim.world.has(id, SuitC)) return null;
  const max = suitDef(sim).airSec;
  const air = suitAir(sim, id);
  return {
    air: Math.round(air), max, low: air <= max * EVA_AIR_LOW_FRAC,
    outside: isOutside(sim, id),
  };
}

/** The airlock on the crew member's grid, nearest by straight line, that has a free suit (null if none, or the body needs none). */
function suitAtOf(sim: Sim, id: number): UiCrew['suitAt'] {
  const pos = sim.world.get(id, PositionC);
  if (!pos || sim.world.has(id, SuitC) || !needsAir(sim, id)) return null;
  let best: { id: number; free: number; d: number } | null = null;
  for (const lock of sim.world.query(AirlockC)) {
    const at = suitTile(sim, lock);
    const free = freeSuits(sim, lock);
    if (!at || free <= 0 || shipIdOf(sim, sim.world.get(lock, ModuleC)) !== shipIdOf(sim, pos)) continue;
    const d = Math.hypot(at.x - pos.x, at.y - pos.y);
    if (!best || d < best.d) best = { id: lock, free, d };
  }
  return best && { id: best.id, free: best.free };
}

function hungerOf(sim: Sim, id: number): number | null {
  const h = sim.world.get(id, NeedsC)?.hunger;
  return h === undefined ? null : Math.round(h);
}

/** The mood score with its factors (largest effect first) and the work speed it costs. */
function moodOf(sim: Sim, id: number): UiCrew['mood'] {
  const m = sim.world.get(id, MoodC);
  if (!m) return null;
  const factors = m.factors.map((f) => ({ label: MOOD_LABELS[f.key] ?? f.key, value: f.value })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return { value: m.value, factors, workMult: m.value < MOOD_VERY_LOW ? MOOD_VERY_LOW_WORK_MULT : m.value < MOOD_LOW ? MOOD_LOW_WORK_MULT : 1 };
}

function fightOf(sim: Sim, id: number): UiFight | null {
  const f = sim.world.get(id, FighterC);
  if (!f) return null;
  const pos = sim.world.get(id, PositionC);
  const tpos = f.target ? sim.world.get(f.target, PositionC) : undefined;
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  let cover: UiFight['cover'] = null;
  if (pos && tpos && grid && shipIdOf(sim, tpos) === shipIdOf(sim, pos)) cover = sightLine(sim, grid, { x: tpos.x, y: tpos.y }, { x: pos.x, y: pos.y }).cover;
  return {
    mode: f.mode, engage: f.engage, target: f.target ? (sim.world.get(f.target, CrewC)?.name ?? null) : null, targetId: f.target,
    ordered: f.ordered !== 0, cooldown: Math.round((f.cooldown / TICK_HZ) * 10) / 10, cooldownMax: wielded(sim, id).def.cooldownSec, cover,
  };
}

function card(sim: Sim, ctx: Ctx, id: number, side: UiCrew['side']): UiCrew | null {
  const crew = sim.world.get(id, CrewC);
  if (!crew) return null;
  const role = sim.content.roles[crew.role];
  let job: string | null = null;
  const a = sim.world.get(id, AssignmentC);
  const j = a && sim.world.get(a.jobId, JobC);
  if (j) {
    const pct = Math.round((j.progress / Math.max(1, j.work)) * 100);
    const at = localOf(sim, shipIdOf(sim, j), j.x, j.y);
    job = `${jobLabel(sim, j)} at ${at.x},${at.y} (${pct}%)`;
  }
  const hp = sim.world.get(id, HealthC);
  const downed = sim.world.get(id, DownedC);
  const carrier = sim.world.get(id, CarriedC);
  const w = wielded(sim, id);
  const loc = whereOf(sim, ctx, id);
  return {
    id,
    name: crew.name,
    role: role?.name ?? crew.role,
    activity: crew.activity,
    rest: Math.round(sim.world.get(id, NeedsC)?.rest ?? 100),
    hunger: hungerOf(sim, id),
    mood: moodOf(sim, id),
    drafted: sim.world.has(id, DraftedC),
    job,
    priorities: { ...(sim.world.get(id, PrioritiesC) ?? NONE) },
    defaults: { ...(role?.priorities ?? NONE) },
    hp: Math.round(hp?.hp ?? 100),
    maxHp: hp?.max ?? 100,
    dead: sim.world.has(id, DeadC),
    downed: downed ? { bleed: Math.round(downed.bleed), stabilized: downed.stabilized } : null,
    carriedBy: carrier ? (sim.world.get(carrier.carrier, CrewC)?.name ?? null) : null,
    carrying: sim.world.get(id, CarryingC) ?? null,
    side,
    ship: loc.shipId,
    where: loc.where,
    away: loc.shipId !== homeShip(sim),
    weapon: w.item === 'unarmed' ? null : { item: w.item, name: sim.content.items[w.item]?.name ?? w.item, ranged: w.def.kind === 'ranged', damage: w.def.damage, range: w.def.range },
    arms: loc.shipId ? armsOn(sim, ctx, loc.shipId) : [],
    surrendered: sim.world.has(id, SurrenderedC),
    prisoner: sim.world.has(id, PrisonerC),
    inert: sim.world.has(id, InertC),
    fight: fightOf(sim, id),
    airless: !needsAir(sim, id),
    evaShuttle: evaShuttleOf(sim, id),
    suit: suitOf(sim, id),
    suitAt: suitAtOf(sim, id),
  };
}

/** Plain-data lists for the UI: all of the player's crew wherever they are, and the hostile crew on the grids they stand on. Reads the sim only. */
export function buildCrewLists(sim: Sim): { crew: UiCrew[]; hostiles: UiCrew[] } {
  const ctx = makeCtx(sim);
  const crew: UiCrew[] = [];
  const hostiles: UiCrew[] = [];
  const occupied = new Set<number>();
  const enemies: number[] = [];
  for (const id of sim.world.query(CrewC)) {
    const side = sim.world.get(id, AllegianceC)?.faction === 'player' ? 'player' : 'enemy';
    if (side === 'player') {
      const c = card(sim, ctx, id, 'player');
      if (!c) continue;
      crew.push(c);
      if (c.ship) occupied.add(c.ship);
    } else enemies.push(id);
  }
  for (const id of enemies) {
    const g = shipIdOf(sim, sim.world.get(id, PositionC));
    if (!g || !occupied.has(g) || sim.world.has(id, DeadC)) continue;
    const c = card(sim, ctx, id, 'enemy');
    if (c) hostiles.push(c);
  }
  return { crew, hostiles };
}
