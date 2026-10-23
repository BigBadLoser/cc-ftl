import { describe, expect, it } from 'vitest';
import {
  AirlockC, CombatC, ModuleC, ShipC, Struct, VehicleC, WeaponC, discoverOutpost, homeShip, isDormant, newGame, shipGrid, type OutpostKind, type Sim,
} from '../../sim';
import { FighterC } from '../../sim/fight/components';
import { StationCrewC } from '../../sim/stations/components';
import { dockError } from '../../sim/vehicles/handlers';
import { stationAirlock } from '../../sim/trade/stationDock';
import { shipIdOf } from '../../sim/regions';
import { content } from '../index';

function run(sim: Sim, n: number, log: string[] = []): string[] {
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `rejected:${e.command}:${e.reason}` : e.type);
  }
  return log;
}

function spawn(style: 'dug' | 'surface', kind: OutpostKind, seed = 1): { sim: Sim; base: number } {
  const sim = newGame(2, content);
  sim.enqueue({ type: 'debug.spawnOutpost', style, seed, kind });
  sim.step();
  sim.events.drain();
  return { sim, base: [...sim.world.query(ShipC)].find((id) => sim.world.get(id, ShipC)?.outpost)! };
}

/** A floor tile of the base in its east half (a spot well inside, clear of the rock). */
function insideTile(sim: Sim, base: number): { x: number; y: number } {
  const g = shipGrid(sim, base)!;
  for (let y = g.y0; y < g.y0 + g.height; y++) {
    for (let x = g.x0 + Math.floor(g.width / 2); x < g.x0 + g.width; x++) if (g.get('ship', x, y) === base && g.get('struct', x, y) === Struct.Floor) return { x, y };
  }
  throw new Error('no floor');
}

describe('a woken hostile outpost defends like a woken pirate den', () => {
  it('aimed at: wakes, the node goes into combat, its turret shoots the aggressor', () => {
    const { sim, base } = spawn('dug', 'pirate');
    expect(sim.world.has(base, CombatC)).toBe(false);
    discoverOutpost(sim, base, 'proximity');
    sim.enqueue({ type: 'combat.setTarget', ship: homeShip(sim), weaponId: null, targetShip: base, targetModuleId: 0 });
    const log = run(sim, 600);
    expect(log).toContain('ship.provoked');
    expect(log).toContain('combat.started');
    expect(isDormant(sim.world.get(base, ShipC))).toBe(false);
    expect(sim.world.get(base, CombatC)!.target?.ship).toBe(homeShip(sim));
    expect(log).toContain('weapon.fired');
    const guns = [...sim.world.query(WeaponC, ModuleC)].filter((w) => shipIdOf(sim, sim.world.get(w, ModuleC)) === base);
    expect(guns.length).toBeGreaterThan(0);
  });

  it('damaged with no aim: wakes the same way', () => {
    const { sim, base } = spawn('dug', 'pirate');
    discoverOutpost(sim, base, 'proximity');
    sim.world.get(base, ShipC)!.integrity -= 0.05;
    const log = run(sim, 5);
    expect(log).toContain('ship.provoked');
    expect(log).toContain('combat.started');
    expect(sim.world.has(base, CombatC)).toBe(true);
  });

  it('boarded: the alarm goes off and its security crew fight the intruder', () => {
    const { sim, base } = spawn('dug', 'pirate');
    const at = insideTile(sim, base);
    sim.enqueue({ type: 'debug.spawnCrew', ship: base, x: at.x, y: at.y, role: 'role.security', faction: 'player' });
    let engaged = false;
    const log: string[] = [];
    for (let i = 0; i < 600; i++) {
      run(sim, 1, log);
      for (const c of sim.world.query(StationCrewC, FighterC)) if (sim.world.get(c, FighterC)!.mode === 'engage') engaged = true;
    }
    expect(log).toContain('ship.provoked');
    expect(log).toContain('station.alarm');
    expect(engaged).toBe(true);
    expect(log).toContain('crew.attacked');
  });

  it('a woken outpost shoots down the player shuttle hovering beside it', () => {
    const { sim, base } = spawn('dug', 'pirate');
    discoverOutpost(sim, base, 'proximity');
    const shuttle = [...sim.world.query(VehicleC)][0]!;
    sim.world.get(shuttle, VehicleC)!.autopilot = true;
    sim.world.get(base, ShipC)!.integrity -= 0.05; // provoked
    sim.enqueue({ type: 'vehicle.hover', vehicle: shuttle, ship: base });
    const log = run(sim, 1500);
    expect(log).toContain('combat.started');
    expect(log).toContain('vehicle.damaged');
  });

  it('sleeping outposts stay quiet: no crew fight, no combat', () => {
    const { sim } = spawn('dug', 'pirate');
    const log = run(sim, 1500);
    expect(log).not.toContain('combat.started');
    expect(log).not.toContain('station.alarm');
    expect(log.filter((e) => e.startsWith('crew.attacked'))).toEqual([]);
  });
});

describe('outpost docks', () => {
  it('records its dock airlock and refuses a shuttle at any other airlock', () => {
    for (const [style, kind, seed] of [['surface', 'trading', 1], ['surface', 'farming', 2], ['surface', 'mining', 3], ['dug', 'pirate', 1]] as const) {
      const { sim, base } = spawn(style, kind, seed);
      const dock = sim.world.get(base, ShipC)!.outpost!.dock!;
      expect(dock, `${style} ${kind}`).toBeGreaterThan(0);
      expect(sim.world.has(dock, AirlockC)).toBe(true);
      const shuttle = [...sim.world.query(VehicleC)][0]!;
      run(sim, 30);
      const locks = [...sim.world.query(AirlockC, ModuleC)].filter((a) => shipIdOf(sim, sim.world.get(a, ModuleC)) === base);
      for (const a of locks) {
        if (a === dock) expect(dockError(sim, shuttle, a)).toBeNull();
        else expect(dockError(sim, shuttle, a)).toBe('notDock');
      }
      expect(stationAirlock(sim, base, shuttle)).toBe(dock);
    }
  });

  it('a player shuttle trades at the dock of a surface outpost like at a station dock', () => {
    const { sim, base } = spawn('surface', 'trading');
    run(sim, 30);
    sim.enqueue({ type: 'trade.hail', ship: base });
    run(sim, 3);
    sim.enqueue({ type: 'trade.offer', ship: base, give: [], get: [{ item: 'item.metal', count: 5 }] });
    run(sim, 3);
    const offer = sim.trade.offers[0]!;
    expect(offer).toBeDefined();
    const dock = sim.world.get(base, ShipC)!.outpost!.dock!;
    sim.enqueue({ type: 'trade.accept', offer: offer.id });
    let dockedAt = 0;
    const log: string[] = [];
    for (let i = 0; i < 3000 && !log.includes('trade.settled'); i++) {
      run(sim, 1, log);
      const v = sim.world.get([...sim.world.query(VehicleC)][0]!, VehicleC)!;
      if (v.state === 'docked' && shipIdOf(sim, sim.world.get(v.dock, ModuleC)) === base) dockedAt = v.dock;
    }
    expect(log).toContain('trade.settled');
    expect(dockedAt).toBe(dock);
    expect(sim.trade.deals.at(-1)).toMatchObject({ via: 'dock', phase: 'done' });
  });
});
