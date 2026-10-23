import { ModuleC } from '../modules/components';
import type { ShipTemplate } from '../registry';
import type { Sim } from '../sim';
import { spillItems } from '../items/stacks';
import type { RuinMeta } from '../shipgen/ruinTypes';
import { placeAt, placementGapError, shipGrid, shipIdOf, type Place } from '../regions';
import { generateShip } from '../shipgen/generate';
import { ruin } from '../shipgen/ruin';
import type { RuinCause } from '../shipgen/ruinTypes';
import { shipById, stampShip } from './ships';
import { DoorJam } from '../structure';
import { ShipC, type ShipRuin } from './components';
import { spawnDriftingContainer } from '../containers/detach';
import { ContainerC } from '../containers/components';
import { spawnInfestation } from '../aliens/spawn';

/**
 * Apply a ruin pass's meta to a freshly stamped derelict (`stampShip`, so no crew, combat or AI): module hp, power,
 * jammed doors (`jam`), starting air and fires, loose loot and caches. The ship becomes an inert wreck. Alien hooks become egg sac and
 * nest entities; data the sim has no state for (dressing art, robot spawns) stays in the meta for the renderer.
 */
export function applyRuin(sim: Sim, shipId: number, template: ShipTemplate, meta: RuinMeta): void {
  const grid = shipGrid(sim, shipId);
  if (!grid) return;
  const ox = grid.x0, oy = grid.y0;
  const byTile = new Map<string, number>();
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (m && shipIdOf(sim, m) === shipId) byTile.set(`${m.def}@${m.x},${m.y}`, id);
  }
  let hp = 0;
  for (const r of meta.modules) {
    const t = template.modules?.[r.index];
    const id = t ? byTile.get(`${t.def}@${ox + t.x},${oy + t.y}`) : undefined;
    const m = id ? sim.world.get(id, ModuleC) : undefined;
    const def = m && sim.content.modules[m.def];
    if (!m || !def) continue;
    m.hp = Math.round(def.maxHp * r.hp);
    const box = sim.world.get(id as number, ContainerC);
    if (box) box.hp = m.hp;
    hp += r.hp;
    // Power off: every source is shut down. Emergency: sources run, but only lights and life support stay switched on.
    if (def.power > 0) m.enabled = meta.power === 'emergency' && r.state !== 'destroyed';
    else if (def.power < 0) m.enabled = meta.power === 'emergency' && (m.def === 'module.light' || m.def === 'module.lifeSupport');
  }
  const w = Math.max(1, ...template.rows.map((r) => r.length));
  for (const room of meta.rooms) {
    for (const i of room.tiles) {
      const x = ox + (i % w), y = oy + Math.floor(i / w);
      grid.set('o2', x, y, room.o2);
      grid.set('co2', x, y, room.co2);
      grid.set('temp', x, y, room.temp);
    }
  }
  for (const f of meta.fires) grid.set('fire', ox + f.x, oy + f.y, f.level);
  for (const d of meta.doors) {
    if (d.state === 'free') continue;
    grid.set('jam', ox + d.x, oy + d.y, d.state === 'stuckOpen' ? DoorJam.Open : DoorJam.Shut);
    grid.set('door', ox + d.x, oy + d.y, d.state === 'stuckOpen' ? 255 : 0);
  }
  for (const it of [...meta.items, ...meta.caches.flatMap((k) => k.items)]) spillItems(sim, shipId, ox + it.x, oy + it.y, it.item, it.count);
  // Torn-off containers drift near the wreck as free bodies with what stock they kept.
  for (const k of meta.containers ?? []) {
    if (k.fate !== 'torn' || !sim.content.modules[k.def]?.container) continue;
    spawnDriftingContainer(sim, { def: k.def, rot: k.rot, clamp: k.clamp, x: ox + k.x, y: oy + k.y, vx: k.vx, vy: k.vy, spin: k.spin, hp: k.hp, ship: shipId, stock: k.stock });
  }
  // Alien hooks become egg sac and nest entities (aliens/components); the robot spawns stay data for later.
  spawnInfestation(sim, shipId, meta.hooks, ox, oy);
  const ship = sim.world.get(shipId, ShipC);
  if (ship) {
    ship.state = 'wreck';
    ship.integrity = meta.modules.length ? hp / meta.modules.length : 0;
    ship.ruin = renderRuin(template, meta);
  }
}

/** The renderer's share of the meta: dressing per tile and per module (no loot, rooms or air, which live in the sim). */
function renderRuin(template: ShipTemplate, meta: RuinMeta): ShipRuin {
  const modules: ShipRuin['modules'] = [];
  for (const r of meta.modules) {
    const t = template.modules?.[r.index];
    if (!t || (r.state === 'intact' && !r.art)) continue;
    modules.push({ x: t.x, y: t.y, state: r.state, ...(r.art ? { art: r.art } : {}), ...(r.flicker ? { flicker: true } : {}) });
  }
  return {
    cause: meta.cause,
    impacts: meta.impacts.map((p) => ({ ...p })),
    breaches: meta.breaches.map((b) => ({ ...b })),
    decals: meta.decals.map((d) => ({ ...d })),
    // Egg sacs are entities with their own state (drawn from EggSacC); nests and AI spawns stay static dressing.
    hooks: meta.hooks.filter((h) => h.art && h.kind !== 'eggsac').map((h) => ({ x: h.x, y: h.y, size: h.size, art: h.art })),
    modules,
  };
}

/** What `spawnDerelict` takes: the generator faction (`faction.*`) and seed that make the hull, its depth, where it goes, and how ruined it is. */
export interface DerelictSpec {
  faction: string;
  depth: number;
  seed: number;
  at: Place;
  intensity?: number;
  cause?: RuinCause;
  /** The wreck's name (default: the generator's). */
  name?: string;
  /** Who moves in: aliens or robots by the faction (default), or nobody (a fresh battle wreck). */
  infest?: 'none';
}

/**
 * Generate a hull, ruin it and stamp it as a neutral wreck (`debug.spawnDerelict`, and the galaxy's derelicts and battle wrecks). Wrecks of a living faction are
 * infested with aliens, the rest with robots. Returns the ship id, or the reason it could not be made or placed.
 */
export function spawnDerelict(sim: Sim, spec: DerelictSpec): number | string {
  const faction = sim.content.factions?.[spec.faction];
  if (!faction) return 'badFaction';
  const gen = generateShip(faction, spec.faction, spec.seed, spec.depth, sim.content.modules);
  if (gen.problems.length > 0) return 'noLayout';
  const infest = spec.infest ?? (faction.living ? 'alien' : 'robot');
  const { template, meta } = ruin(gen.template, spec.seed, { defs: sim.content.modules, intensity: spec.intensity ?? 0.5, infest, origin: spec.faction, ...(spec.cause ? { cause: spec.cause } : {}) });
  const { x, y } = placeAt(spec.at, gen.width, gen.height);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return 'badValue';
  const gap = placementGapError(sim, { x, y, w: gen.width, h: gen.height });
  if (gap) return gap;
  sim.sector.width = Math.max(sim.sector.width, x + gen.width + 8);
  sim.sector.height = Math.max(sim.sector.height, y + gen.height + 8);
  const shipId = stampShip(sim, spec.name ? { ...template, name: spec.name } : template, { faction: 'neutral', x, y, state: 'wreck' });
  applyRuin(sim, shipId, template, meta);
  const ship = shipById(sim, shipId);
  if (ship) ship.gen = { faction: spec.faction, seed: spec.seed, depth: spec.depth, role: gen.role };
  return shipId;
}
