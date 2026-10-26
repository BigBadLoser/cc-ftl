import { describe, expect, it } from 'vitest';
import {
  CombatC, CrewC, DeadC, deserialize, IonC, ModuleC, newGame, PositionC, ProjectileC, serialize, ShipC, shipIds, Struct, TICK_HZ, pipeline,
  type Command, type Module, type ModuleDef, type Sim,
} from '../../sim';
import { mannedConsole, operatorOf, skillOf, type ConsoleKind } from '../../sim/combat/operators';
import { shieldCapacity, shieldRechargeSec } from '../../sim/combat/ships';
import { isIncapacitated } from '../../sim/crew/helpers';
import { settleOrder } from '../../sim/ftl/order';
import { AirlockC } from '../../sim/modules/airlock';
import { isDeployed } from '../../sim/modules/deploy';
import { footprintTiles } from '../../sim/modules/footprint';
import { networkOf } from '../../sim/modules/network';
import { regions, shipGrid, shipIdOf } from '../../sim/regions';
import { roomTiles } from '../../sim/roomIndex';
import { DoorJam } from '../../sim/structure';
import { doorsSystem } from '../../sim/systems/doors';
import { helmSystem } from '../../sim/systems/helm';
import { modulesSystem } from '../../sim/systems/modules';
import { powerSystem } from '../../sim/systems/power';
import {
  DOOR_CLOSE_PER_TICK, EVASION_CAP, FTL_CHARGE_SEC, GAS_EPSILON, NORMAL_O2, SKILL_STEP,
} from '../../sim/tuning';
import { content } from '../index';

/**
 * The tick-cost work (doors visit only door tiles while nothing else changed; ship, console and shield helpers test the
 * module's content before looking up its ship; power and modules look the ship up once, and only for modules that act)
 * must not change a single value. A run of the real pipeline is compared, tick by tick and byte for byte, with a run in
 * which those four systems are the code as it was before (kept verbatim below), through combat in a populated node and
 * scripted door edits. The helpers are compared with their old versions on every ship, every tick.
 */

// --- The previous code, verbatim apart from names ---------------------------------------------------------------------

function refMannedConsole(sim: Sim, shipId: number, kind: ConsoleKind): { module: number; crew: number } | null {
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) !== shipId || sim.content.modules[m.def]?.console !== kind) continue;
    if (!m.powered || m.hp <= 0 || sim.world.has(id, IonC)) continue;
    const crew = operatorOf(sim, id);
    if (crew) return { module: id, crew };
  }
  return null;
}

function refShieldCapacity(sim: Sim, shipId: number, powered: boolean): number {
  let layers = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const gen = m && shipIdOf(sim, m) === shipId ? sim.content.modules[m.def]?.shieldGen : undefined;
    if (!m || !gen || m.hp <= 0 || !m.enabled || (powered && !m.powered)) continue;
    if (powered && (sim.world.has(id, IonC) || !isDeployed(sim, id))) continue;
    layers += Math.floor(Math.abs(sim.content.modules[m.def]?.power ?? 0) * gen.layersPerPower);
  }
  return layers;
}

function refShieldRechargeSec(sim: Sim, shipId: number): number {
  let best = Infinity;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const gen = m && shipIdOf(sim, m) === shipId ? sim.content.modules[m.def]?.shieldGen : undefined;
    if (m && gen && m.powered && m.hp > 0 && !sim.world.has(id, IonC)) best = Math.min(best, gen.rechargeSec);
  }
  return best;
}

function refDoors(sim: Sim): void {
  for (const { grid } of regions(sim)) {
    if (!grid.has('door') || !grid.has('struct')) continue;
    const { width } = grid;
    const struct = grid.load('struct');
    const door = grid.load('door');
    const modules = grid.has('module') ? grid.load('module') : null;
    const jam = grid.has('jam') ? grid.load('jam') : null;
    const used = new Set<number>();
    for (const id of sim.world.query(CrewC, PositionC)) {
      const p = sim.world.get(id, PositionC);
      if (!p || shipIdOf(sim, p) !== grid.id || sim.world.has(id, DeadC)) continue;
      used.add((p.y - grid.y0) * width + (p.x - grid.x0));
      used.add((p.toY - grid.y0) * width + (p.toX - grid.x0));
    }
    for (let i = 0; i < struct.length; i++) {
      const cur = door[i] as number;
      const id = modules ? (modules[i] as number) : 0;
      if (struct[i] === Struct.Door && id !== 0 && sim.world.has(id, AirlockC)) continue;
      let next = cur;
      if (struct[i] !== Struct.Door) next = 0;
      else if (jam && jam[i] === DoorJam.Open) next = 255;
      else if (jam && jam[i] === DoorJam.Shut) next = 0;
      else if (used.has(i)) next = 255;
      else if (cur > 0) next = Math.max(0, cur - DOOR_CLOSE_PER_TICK);
      if (next !== cur) {
        const x = i % width;
        grid.set('door', grid.x0 + x, grid.y0 + (i - x) / width, next);
      }
    }
  }
}

function refHelm(sim: Sim): void {
  for (const id of sim.world.query(ShipC, CombatC)) {
    const ship = sim.world.get(id, ShipC);
    const combat = sim.world.get(id, CombatC);
    if (!ship || !combat) continue;
    const pilot = ship.state === 'active' ? refMannedConsole(sim, id, 'helm') : null;
    let engines = 0;
    if (pilot) {
      for (const mid of sim.world.query(ModuleC)) {
        const m = sim.world.get(mid, ModuleC);
        const eng = m && shipIdOf(sim, m) === id ? sim.content.modules[m.def]?.engine : undefined;
        if (!m || !eng || !m.powered || m.hp <= 0 || sim.world.has(mid, IonC)) continue;
        engines += Math.abs(sim.content.modules[m.def]?.power ?? 0) * eng.evasionPerPower;
      }
    }
    const skill = pilot ? Math.max(0, skillOf(sim, pilot.crew, 'piloting')) : 0;
    const boost = pilot ? 1 + SKILL_STEP * skill : 0;
    combat.pilot = skill;
    combat.evasion = Math.min(EVASION_CAP, engines * boost);
    if (ship.faction === 'player' && sim.tick % 10 === 0) refCruise(sim, id, combat);
    if (pilot && engines > 0) combat.ftl = Math.min(FTL_CHARGE_SEC, combat.ftl + boost / TICK_HZ);
    if (combat.ftlOrder) settleOrder(sim, id);
  }
}

function refCruise(sim: Sim, id: number, combat: { cruisePilot: number; cruiseEvasion: number }): void {
  combat.cruisePilot = 0;
  combat.cruiseEvasion = 0;
  if (sim.world.get(id, ShipC)?.state !== 'active') return;
  let helm = false;
  let engines = 0;
  for (const mid of sim.world.query(ModuleC)) {
    const m = sim.world.get(mid, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || !m.powered || m.hp <= 0 || sim.world.has(mid, IonC) || shipIdOf(sim, m) !== id) continue;
    if (def.console === 'helm') helm = true;
    if (def.engine) engines += Math.abs(def.power ?? 0) * def.engine.evasionPerPower;
  }
  if (!helm || engines <= 0) return;
  let best = 0;
  for (const cid of sim.world.query(CrewC)) {
    const pos = sim.world.get(cid, PositionC);
    if (!pos || shipIdOf(sim, pos) !== id || isIncapacitated(sim, cid)) continue;
    if (sim.world.get(cid, CrewC)?.activity === 'sleeping') continue;
    best = Math.max(best, skillOf(sim, cid, 'piloting'));
  }
  combat.cruisePilot = best;
  combat.cruiseEvasion = Math.min(EVASION_CAP, engines * (1 + SKILL_STEP * best));
}

interface Member { id: number; m: Module; def: ModuleDef }

function refPower(sim: Sim): void {
  const networks = new Map<number, Member[]>();
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC) as Module;
    const def = sim.content.modules[m.def];
    const grid = shipGrid(sim, shipIdOf(sim, m));
    if (!def || !grid) continue;
    const key = shipIdOf(sim, m) * 65536 + networkOf(grid, m.x, m.y);
    const list = networks.get(key);
    if (list) list.push({ id, m, def });
    else networks.set(key, [{ id, m, def }]);
  }
  for (const members of networks.values()) refAllocate(sim, members);
}

function refAllocate(sim: Sim, members: Member[]): void {
  let supply = 0;
  let demand = 0;
  const consumers: Member[] = [];
  for (const mem of members) {
    const live = mem.m.enabled && mem.m.hp > 0 && !sim.world.has(mem.id, IonC);
    if (!live) mem.m.powered = false;
    else if (mem.def.power > 0) {
      supply += mem.def.power;
      mem.m.powered = true;
    } else if (mem.def.power < 0) {
      demand -= mem.def.power;
      consumers.push(mem);
    } else mem.m.powered = true;
  }
  consumers.sort((a, b) => a.m.powerPriority - b.m.powerPriority || a.id - b.id);
  let remaining = supply;
  let cut = false;
  let lostPower = false;
  for (const c of consumers) {
    const draw = -c.def.power;
    if (!cut && draw <= remaining) {
      remaining -= draw;
      c.m.powered = true;
    } else {
      cut = true;
      if (c.m.powered) lostPower = true;
      c.m.powered = false;
    }
  }
  const first = members[0];
  if (lostPower && first) sim.events.emit({ type: 'power.shortage', ship: shipIdOf(sim, first.m), supply, demand });
}

function refModules(sim: Sim): void {
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    const grid = m && shipGrid(sim, shipIdOf(sim, m));
    if (!m || !def || !grid?.has('o2') || !m.powered || m.hp <= 0) continue;
    if (def.o2PerSec || def.co2ScrubPerSec) {
      const room = grid.get('room', m.x, m.y);
      const tiles = room ? roomTiles(grid).get(room) : undefined;
      const idx = tiles ?? [(m.y - grid.y0) * grid.width + (m.x - grid.x0)];
      const addO2 = ((def.o2PerSec ?? 0) / TICK_HZ) / idx.length;
      const scrub = ((def.co2ScrubPerSec ?? 0) / TICK_HZ) / idx.length;
      for (const i of idx) {
        const x = grid.x0 + (i % grid.width);
        const y = grid.y0 + Math.floor(i / grid.width);
        const cur = grid.get('o2', x, y);
        if (addO2 > 0 && cur < NORMAL_O2 - GAS_EPSILON) grid.set('o2', x, y, Math.min(NORMAL_O2, cur + addO2));
        const c = grid.get('co2', x, y);
        if (scrub > 0 && c > GAS_EPSILON) grid.set('co2', x, y, Math.max(0, c - scrub));
      }
    }
    if (def.heatPerSec) {
      const tiles = footprintTiles(def, m.x, m.y, m.rot);
      const heat = def.heatPerSec / TICK_HZ / tiles.length;
      for (const t of tiles) grid.set('temp', t.x, t.y, grid.get('temp', t.x, t.y) + heat);
    }
  }
}

// --- The comparison -----------------------------------------------------------------------------------------------------

const REF = new Map<unknown, (sim: Sim) => void>([[doorsSystem, refDoors], [helmSystem, refHelm], [powerSystem, refPower], [modulesSystem, refModules]]);

/** One tick as `Sim.step` runs it, with the previous systems swapped in. */
function refStep(sim: Sim): void {
  const apply = (sim as unknown as { apply(cmd: Command): void }).apply.bind(sim);
  sim.commands.drain(sim.tick, apply);
  expect(sim.sector.state).toBe('active');
  for (const system of pipeline) (REF.get(system) ?? system)(sim);
  sim.tick++;
}

/** Door tiles of the home ship, row-major. */
function doorTiles(sim: Sim, ship: number): { x: number; y: number }[] {
  const g = shipGrid(sim, ship);
  const out: { x: number; y: number }[] = [];
  if (!g) return out;
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Door) out.push({ x, y });
  return out;
}

/** Door edits by tick: jams open and shut, a stray openness value on a floor tile, a door deconstructed while open. */
function script(sim: Sim, ship: number, t0: number): void {
  const s = sim.sector.grid;
  const doors = doorTiles(sim, ship);
  const [a, b, c] = doors as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
  const t = sim.tick - t0;
  if (t === 20) s.set('jam', a.x, a.y, DoorJam.Open);
  if (t === 40) s.set('jam', b.x, b.y, DoorJam.Shut);
  if (t === 60) {
    s.set('door', c.x, c.y, 255);
    s.set('struct', c.x, c.y, Struct.Floor);
  }
  if (t === 80) {
    const g = shipGrid(sim, ship);
    for (let y = g!.y0; y < g!.y0 + g!.height; y++) {
      for (let x = g!.x0; x < g!.x0 + g!.width; x++) {
        if (s.get('struct', x, y) === Struct.Floor && s.get('door', x, y) === 0) {
          s.set('door', x, y, 150);
          return;
        }
      }
    }
  }
  if (t === 110) {
    s.set('jam', a.x, a.y, DoorJam.None);
    s.set('jam', b.x, b.y, DoorJam.None);
  }
}

describe('tick-cost changes are exact', () => {
  it('matches the previous doors, helm, power and modules code byte for byte through combat in a populated node', () => {
    const sim = newGame(1, content, 'ship.starter', true);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 5, y: 90 });
    sim.step();
    const ships = shipIds(sim);
    expect(ships.length).toBe(3);
    const home = ships[0] as number;
    expect(doorTiles(sim, home).length).toBeGreaterThanOrEqual(3);
    const ref = deserialize(serialize(sim), content);
    const t0 = sim.tick;
    let shots = 0;
    for (let i = 0; i < 400; i++) {
      script(sim, home, t0);
      script(ref, home, t0);
      sim.step();
      refStep(ref);
      shots += sim.world.query(ProjectileC).length;
      expect(serialize(sim) === serialize(ref), `tick ${sim.tick}`).toBe(true);
      for (const id of ships) {
        for (const powered of [true, false]) expect(shieldCapacity(sim, id, powered)).toBe(refShieldCapacity(sim, id, powered));
        expect(shieldRechargeSec(sim, id)).toBe(refShieldRechargeSec(sim, id));
        for (const kind of ['weapons', 'shields', 'helm'] as const) expect(mannedConsole(sim, id, kind)).toEqual(refMannedConsole(sim, id, kind));
      }
    }
    // Combat really ran: shots were in flight.
    expect(shots).toBeGreaterThan(0);
  }, 120_000); // a long scripted run: under parallel load it outlasts the 30 s default
});
