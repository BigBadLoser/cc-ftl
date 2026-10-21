import { AlienC, EggSacC, NestC, type EggSac } from '../aliens/components';
import { broodRole, laySac, spawnAlien } from '../aliens/spawn';
import { sacAlive, sacTiles } from '../aliens/target';
import { CarriedC, CrewC, DeadC, PositionC, type Position } from '../crew/components';
import { sightLine } from '../fight/los';
import type { Grid } from '../grid';
import { isTileWalkable } from '../modules/walk';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { TICK_HZ } from '../time';
import {
  NEST_LAY_SEC, NEST_MAX_SACS, NEST_RADIUS, SAC_BROOD, SAC_CHAIN_MAX_SEC, SAC_CHAIN_MIN_SEC, SAC_CHAIN_RADIUS,
  SAC_CHECK_TICKS, SAC_FIRE_DAMAGE, SAC_SENSE, SAC_STAGE_SEC,
} from '../tuning';

const STAGE_TICKS = Math.round(SAC_STAGE_SEC * TICK_HZ);

/**
 * Egg sacs and nests on derelicts (aliens/components). A dormant sac starts hatching when it is disturbed: a non-alien
 * within SAC_SENSE tiles with a clear line of sight, any damage (crew attacks, fire), or a neighbour that hatched (a
 * chain, after a random short delay). Hatching plays stages 0, 1, 2; on stage 2 the brood comes out (roles by weight
 * from content `creatures.hatch`); then it bursts. A sac brought to 0 hp before stage 2 bursts with no brood. A nest
 * lays a new dormant sac nearby every NEST_LAY_SEC while a non-alien is aboard, at most NEST_MAX_SACS in all.
 */
export function eggSacSystem(sim: Sim): void {
  const sacs = sim.world.query(EggSacC);
  const nests = sim.world.query(NestC);
  if (sacs.length === 0 && nests.length === 0) return;
  const intruders = intrudersByShip(sim);
  const check = sim.tick % SAC_CHECK_TICKS === 0;
  for (const id of sacs) {
    const sac = sim.world.get(id, EggSacC) as EggSac;
    if (sac.state === 'burst') continue;
    const grid = shipGrid(sim, sac.ship);
    if (!grid) continue;
    burn(grid, sac);
    if (sac.hp <= 0 && (sac.state === 'dormant' || sac.stage < 2)) {
      sac.state = 'burst';
      sac.destroyed = true;
      sim.events.emit({ type: 'eggsac.destroyed', sac: id, ship: sac.ship });
      continue;
    }
    if (sac.state === 'dormant') {
      const cause = sac.hp < sac.max ? 'damage'
        : sac.chain && --sac.timer <= 0 ? 'chain'
          : check && sees(sim, grid, sac, intruders.get(sac.ship)) ? 'proximity' : null;
      if (cause) startHatch(sim, id, sac, cause);
      continue;
    }
    if (--sac.timer > 0) continue;
    sac.stage++;
    sac.timer = STAGE_TICKS;
    if (sac.stage === 2) hatch(sim, grid, id, sac);
    else if (sac.stage > 2) sac.state = 'burst';
  }
  for (const id of nests) {
    const nest = sim.world.get(id, NestC);
    if (!nest || !intruders.get(nest.ship)?.length || nest.laid >= NEST_MAX_SACS) continue;
    if (++nest.timer < NEST_LAY_SEC * TICK_HZ) continue;
    const grid = shipGrid(sim, nest.ship);
    const spot = grid && freeSpot(sim, grid, nest.x, nest.y);
    if (!spot) continue;
    nest.timer = 0;
    nest.laid++;
    const sac = laySac(sim, nest.ship, spot.x, spot.y, 1);
    sim.events.emit({ type: 'nest.laid', nest: id, sac, ship: nest.ship });
  }
}

/** Living non-alien crew on each ship (not carried): what disturbs sacs and keeps nests laying. */
function intrudersByShip(sim: Sim): Map<number, Position[]> {
  const out = new Map<number, Position[]>();
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (sim.world.has(id, AlienC) || sim.world.has(id, DeadC) || sim.world.has(id, CarriedC)) continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const ship = shipIdOf(sim, pos);
    const list = out.get(ship);
    if (list) list.push(pos);
    else out.set(ship, [pos]);
  }
  return out;
}

/** Fire on the sac's tiles hurts it (and so sets it off). */
function burn(grid: Grid, sac: EggSac): void {
  let fire = 0;
  for (const t of sacTiles(sac)) if (grid.inBounds(t.x, t.y)) fire = Math.max(fire, grid.get('fire', t.x, t.y));
  if (fire > 0) sac.hp = Math.max(0, sac.hp - (SAC_FIRE_DAMAGE * fire) / 255 / TICK_HZ);
}

/** True if any intruder stands within SAC_SENSE of a footprint tile with a clear line to it. */
function sees(sim: Sim, grid: Grid, sac: EggSac, who: readonly Position[] | undefined): boolean {
  if (!who?.length) return false;
  for (const p of who) {
    const at = { x: Math.round(p.x), y: Math.round(p.y) };
    for (const t of sacTiles(sac)) {
      const d = Math.hypot(t.x - at.x, t.y - at.y);
      if (d > SAC_SENSE) continue;
      if (d === 0 || sightLine(sim, grid, t, at).visible) return true;
    }
  }
  return false;
}

function startHatch(sim: Sim, id: number, sac: EggSac, cause: 'proximity' | 'damage' | 'chain'): void {
  sac.state = 'hatching';
  sac.stage = 0;
  sac.timer = STAGE_TICKS;
  sac.chain = false;
  sim.events.emit({ type: 'eggsac.disturbed', sac: id, ship: sac.ship, cause });
  // The neighbours wake too, each after its own short delay (ascending ids: one rng draw each, in a fixed order).
  for (const other of sim.world.query(EggSacC)) {
    const o = sim.world.get(other, EggSacC) as EggSac;
    if (other === id || o.ship !== sac.ship || o.state !== 'dormant' || o.chain) continue;
    if (Math.hypot(o.x - sac.x, o.y - sac.y) > SAC_CHAIN_RADIUS) continue;
    o.chain = true;
    o.timer = sim.rng.int(Math.round(SAC_CHAIN_MIN_SEC * TICK_HZ), Math.round(SAC_CHAIN_MAX_SEC * TICK_HZ));
  }
}

/** Stage 2: the brood crawls out onto the sac's walkable footprint tiles. */
function hatch(sim: Sim, grid: Grid, id: number, sac: EggSac): void {
  if (!sacAlive(sac)) return;
  const tiles = sacTiles(sac).filter((t) => isTileWalkable(sim, grid, t.x, t.y));
  const aliens: number[] = [];
  const n = SAC_BROOD[sac.size] ?? 1;
  for (let i = 0; i < n && tiles.length; i++) {
    const role = broodRole(sim);
    const t = tiles[i % tiles.length] as { x: number; y: number };
    const a = role ? spawnAlien(sim, sac.ship, role, t.x, t.y) : 0;
    if (a) aliens.push(a);
  }
  sim.events.emit({ type: 'eggsac.hatched', sac: id, ship: sac.ship, x: sac.x, y: sac.y, aliens });
}

/** A free deck tile within NEST_RADIUS of the nest (floor, no module, no sac, nobody on it), picked at random. */
function freeSpot(sim: Sim, grid: Grid, nx: number, ny: number): { x: number; y: number } | null {
  const taken = new Set<string>();
  for (const id of sim.world.query(EggSacC)) {
    const s = sim.world.get(id, EggSacC) as EggSac;
    if (s.state !== 'burst') for (const t of sacTiles(s)) taken.add(`${t.x},${t.y}`);
  }
  for (const id of sim.world.query(CrewC, PositionC)) {
    const p = sim.world.get(id, PositionC) as Position;
    taken.add(`${p.x},${p.y}`);
  }
  taken.add(`${nx},${ny}`);
  const free: { x: number; y: number }[] = [];
  for (let y = ny - NEST_RADIUS; y <= ny + NEST_RADIUS; y++)
    for (let x = nx - NEST_RADIUS; x <= nx + NEST_RADIUS; x++) {
      if (!grid.inBounds(x, y) || grid.get('struct', x, y) !== Struct.Floor || grid.get('module', x, y) !== 0) continue;
      if (Math.hypot(x - nx, y - ny) <= NEST_RADIUS && !taken.has(`${x},${y}`)) free.push({ x, y });
    }
  return free.length ? sim.rng.pick(free) : null;
}
