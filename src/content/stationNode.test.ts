import { describe, expect, it } from 'vitest';
import {
  CombatC, CrewC, FTL_CHARGE_SEC, PositionC, SECURITY_ROLE, ShipC, TraderC, VehicleC, deserialize, galaxyIndex, homeShip, isSurplus, newGame, planCourier,
  serialize, unitPrice, type Sim,
} from '../sim';
import { stationAirlock } from '../sim/trade/stationDock';
import { shipIdOf } from '../sim/regions';
import { content } from './index';

function run(sim: Sim, n: number): string[] {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `${e.type}:${e.command}:${e.reason}` : e.type);
  }
  return log;
}

/** A new game with one generated station east of the player ship. */
function withStation(kind = 'station.trading', size: 'outpost' | 'station' | 'hub' = 'outpost', seed = 4, gameSeed = 3): { sim: Sim; station: number } {
  const sim = newGame(gameSeed, content);
  run(sim, 20);
  sim.enqueue({ type: 'debug.spawnStation', kind, size, seed });
  expect(run(sim, 1).filter((e) => e.startsWith('command.rejected'))).toEqual([]);
  const station = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile) as number;
  return { sim, station };
}

const crewOn = (sim: Sim, ship: number): number[] => sim.world.query(CrewC, PositionC).filter((c) => shipIdOf(sim, sim.world.get(c, PositionC)) === ship);

describe('stations in the node', () => {
  it('spawns a generated station as an immobile ship with its crew, security and a trader; it never flees or goes disabled', () => {
    const { sim, station } = withStation('station.trading', 'station');
    const s = sim.world.get(station, ShipC)!;
    expect(s).toMatchObject({ faction: 'neutral', state: 'active', immobile: true, gen: { faction: 'station.trading', role: 'station' } });
    expect(s.dormant).toBeUndefined();
    const crew = crewOn(sim, station);
    expect(crew.length).toBe(content.stations['station.trading'].tiers.station.crew);
    expect(crew.filter((c) => sim.world.get(c, CrewC)?.role === SECURITY_ROLE).length).toBeGreaterThan(0);
    expect(sim.world.get(station, TraderC)).toMatchObject({ profile: 'trader.station.trading', station: true });
    // No FTL: a flee is refused even with a full charge.
    sim.world.get(station, CombatC)!.ftl = FTL_CHARGE_SEC;
    sim.enqueue({ type: 'combat.flee', ship: station });
    expect(run(sim, 1)).toContain('command.rejected:combat.flee:immobile');
    run(sim, 400);
    expect(sim.world.get(station, ShipC)!.state).toBe('active');
  });

  it('the old grid-less trader form still works: it spawns a trading outpost', () => {
    const sim = newGame(7, content);
    sim.enqueue({ type: 'debug.spawnStation', profile: 'trader.station', name: 'Haven' });
    run(sim, 1);
    const st = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
    expect(sim.world.get(st, ShipC)).toMatchObject({ name: 'Haven', gen: { faction: 'station.trading', role: 'outpost' } });
  });

  it('a hub is much bigger than any ship and the node grows to hold it', () => {
    const { sim, station } = withStation('station.trading', 'hub');
    const s = sim.world.get(station, ShipC)!;
    expect(Math.max(s.width, s.height)).toBeGreaterThan(100);
    expect(sim.sector.width).toBeGreaterThanOrEqual(s.x + s.width);
    expect(sim.sector.height).toBeGreaterThanOrEqual(s.y + s.height);
  });

  it('stays in the node archive on a jump and comes back with the node', () => {
    const { sim, station } = withStation();
    const name = sim.world.get(station, ShipC)!.name;
    const home = sim.sector.node;
    const away = (galaxyIndex(sim.galaxy).adjacent.get(home) ?? []).map((e) => (e.a === home ? e.b : e.a)).sort()[0]!;
    sim.enqueue({ type: 'debug.galaxyTeleport', node: away });
    expect(run(sim, 1)).toContain('sector.jumped');
    expect(sim.world.has(station, ShipC)).toBe(false);
    expect(sim.archives.find((a) => a.node === home)!.entities.some((e) => e.id === station)).toBe(true);
    sim.enqueue({ type: 'sector.deploy', x: 40, y: 40 });
    run(sim, 1);
    sim.enqueue({ type: 'debug.galaxyTeleport', node: home });
    expect(run(sim, 1)).toContain('sector.jumped');
    expect(sim.world.get(station, ShipC)).toMatchObject({ name, immobile: true });
  });

  it('trades by shuttle: the instant fallback is gone', () => {
    const { sim, station } = withStation();
    const plan = planCourier(sim, station, [], [{ item: 'item.metal', count: 5 }]);
    expect(plan).toMatchObject({ courier: 'you' });
    expect(planCourier(sim, 99999, [], [{ item: 'item.metal', count: 5 }])).toEqual({ error: 'noTrader' });
  });

  it('a pirate den stays dormant until provoked, then fights', () => {
    const { sim, station } = withStation('station.pirate', 'outpost');
    expect(sim.world.get(station, ShipC)).toMatchObject({ faction: 'hostile' });
    expect(sim.world.get(station, ShipC)!.dormant).toBeDefined();
    const quiet = run(sim, 300);
    expect(quiet).not.toContain('combat.started');
    expect(sim.sector.inCombat).toBe(false);
    expect(sim.world.get(station, CombatC)!.target).toBeNull();
    // The player aims at it: it wakes, the node goes into combat and its guns come round.
    sim.enqueue({ type: 'combat.setTarget', ship: homeShip(sim), weaponId: null, targetShip: station, targetModuleId: 0 });
    const log = run(sim, 60);
    expect(log).toContain('ship.provoked');
    expect(log).toContain('combat.started');
    expect(sim.world.get(station, ShipC)!.dormant).toBeUndefined();
    expect(sim.world.get(station, CombatC)!.target?.ship).toBe(homeShip(sim));
  });

  it('wakes a dormant den when it takes damage', () => {
    const { sim, station } = withStation('station.pirate', 'outpost');
    run(sim, 30);
    sim.world.get(station, ShipC)!.integrity -= 0.05;
    expect(run(sim, 1)).toContain('ship.provoked');
  });

  it('is deterministic and survives a save round trip', () => {
    const play = (): Sim => {
      const { sim } = withStation('station.pirate', 'station', 9);
      run(sim, 120);
      return sim;
    };
    const a = play();
    const b = play();
    expect(serialize(a)).toBe(serialize(b));
    const c = deserialize(serialize(a), content);
    run(a, 200);
    run(c, 200);
    expect(serialize(c)).toBe(serialize(a));
  });
});

describe('station trade details', () => {
  it('reserves a station airlock: one a shuttle is docking at is not offered to another', () => {
    const { sim, station } = withStation('station.trading', 'station');
    const shuttle = sim.world.query(VehicleC)[0] as number;
    const first = stationAirlock(sim, station, shuttle);
    expect(first).toBeGreaterThan(0);
    // Another shuttle (a stand-in) is on its way to dock there: the trade picks a different airlock.
    const other = sim.world.createEntity();
    sim.world.add(other, VehicleC, { ...sim.world.get(shuttle, VehicleC)!, dest: { type: 'dock', airlock: first }, dock: 0 });
    const second = stationAirlock(sim, station, shuttle);
    expect(second).toBeGreaterThan(0);
    expect(second).not.toBe(first);
  });

  it('a military depot sells surplus: basic and middle-grade hand weapons, never its best, at a markup; it still buys them', () => {
    const { sim, station } = withStation('station.military', 'outpost');
    const t = sim.world.get(station, TraderC)!;
    const weapons = t.stock.filter((s) => content.items[s.item as keyof typeof content.items]?.tags.includes('weapon')).map((s) => s.item).sort();
    expect(weapons).toEqual(['item.blade', 'item.ion_pistol', 'item.sidearm']);
    expect(t.stock.some((s) => s.item === 'item.rifle')).toBe(false);
    expect(isSurplus(sim, t.profile, 'item.sidearm')).toBe(true);
    expect(isSurplus(sim, t.profile, 'item.rifle')).toBe(false);
    // The markup: a surplus sidearm costs more than at a trade station; the depot still pays for rifles.
    const trade = withStation('station.trading', 'outpost');
    expect(unitPrice(sim, station, 'item.sidearm', 'sell')).toBeGreaterThan(unitPrice(trade.sim, trade.station, 'item.sidearm', 'sell')!);
    expect(unitPrice(sim, station, 'item.rifle', 'buy')).toBeGreaterThan(0);
  });

});
