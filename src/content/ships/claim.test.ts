import { describe, expect, it } from 'vitest';
import {
  AboardC, AsteroidC, CrewC, ItemStackC, regionItems, PositionC, ShipC, Struct, SuitC, VehicleC, deserialize, homeShip, newGame, serialize,
  shipGrid, type Sim,
} from '../../sim';
import { shipIdAt } from '../../sim/regions';
import { content } from '../index';

function run(sim: Sim, n: number, until?: (l: string[]) => boolean): string[] {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `rejected:${e.command}:${e.reason}` : e.type);
    if (until?.(log)) break;
  }
  return log;
}

/** The starter plus a mixed big asteroid east of it. */
function setup(): { sim: Sim; asteroid: number } {
  const sim = newGame(3, content);
  sim.enqueue({ type: 'debug.spawnAsteroid', kind: 'big', seed: 4, coverage: 'mixed', x: 62, y: 40 });
  sim.step();
  return { sim, asteroid: [...sim.world.query(AsteroidC)][0]! };
}

/** The asteroid's leftmost columns: a w x h rectangle on its west edge, centred on its middle row. */
function westRect(sim: Sim, asteroid: number, w = 12, h = 10) {
  const a = sim.world.get(asteroid, AsteroidC)!;
  return { x: a.x, y: a.y + Math.floor((a.height - h) / 2), w, h };
}

describe('claiming an asteroid', () => {
  it('validates the rectangle and makes an immobile player base that is never disabled or wrecked', () => {
    const { sim, asteroid } = setup();
    const r = westRect(sim, asteroid);
    sim.enqueue({ type: 'asteroid.claim', asteroid: homeShip(sim), ...r });
    sim.enqueue({ type: 'asteroid.claim', asteroid, ...r, w: 2 });
    sim.enqueue({ type: 'asteroid.claim', asteroid, ...r, x: r.x - 30 });
    sim.enqueue({ type: 'asteroid.claim', asteroid, ...r });
    sim.enqueue({ type: 'asteroid.claim', asteroid, ...r, x: r.x + 4 });
    const log = run(sim, 1);
    expect(log.filter((e) => e.startsWith('rejected'))).toEqual([
      'rejected:asteroid.claim:noAsteroid', 'rejected:asteroid.claim:badSize', 'rejected:asteroid.claim:offAsteroid', 'rejected:asteroid.claim:overlap',
    ]);
    expect(log).toContain('asteroid.claimed');
    const base = [...sim.world.query(ShipC)].find((id) => sim.world.get(id, ShipC)?.base)!;
    run(sim, 200);
    expect(sim.world.get(base, ShipC)).toMatchObject({ faction: 'player', state: 'active', base: { asteroid } });
    const b = deserialize(serialize(sim), content);
    expect(b.world.get(base, ShipC)?.base).toEqual({ asteroid });
  });

  it('crew reach it by shuttle and EVA, land on rock ground and dig into rock mass there', () => {
    const { sim, asteroid } = setup();
    const r = westRect(sim, asteroid);
    sim.enqueue({ type: 'asteroid.claim', asteroid, ...r });
    run(sim, 1);
    const base = [...sim.world.query(ShipC)].find((id) => sim.world.get(id, ShipC)?.base)!;
    const g = shipGrid(sim, base)!;
    const shuttle = [...sim.world.query(VehicleC)].find((v) => sim.content.vehicles?.[sim.world.get(v, VehicleC)!.def]?.class === 'shuttle')!;
    const crew = [...sim.world.query(CrewC)].sort((a, b) => a - b).slice(0, 2);
    for (const c of crew) sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle: shuttle });
    run(sim, 1200, () => crew.every((c) => sim.world.has(c, AboardC)));
    expect(crew.every((c) => sim.world.has(c, AboardC))).toBe(true);
    sim.enqueue({ type: 'vehicle.launch', vehicle: shuttle });
    run(sim, 1);
    sim.enqueue({ type: 'vehicle.hover', vehicle: shuttle, ship: base });
    run(sim, 3000, (l) => l.includes('vehicle.hovering') || sim.world.get(shuttle, VehicleC)!.hover === base);
    expect(sim.world.get(shuttle, VehicleC)!.hover).toBe(base);
    sim.enqueue({ type: 'eva.out', vehicle: shuttle, crew: crew[1]! });
    run(sim, 600);
    const p = sim.world.get(crew[1]!, PositionC);
    expect(p, 'landed on the base').toBeDefined();
    expect(sim.world.has(crew[1]!, SuitC)).toBe(true);
    expect([Struct.Ground, Struct.Space]).toContain(g.get('struct', p!.x, p!.y));
  });

  it('a transfer order bootstraps a fresh claimed base with no storage: everything lands as floor stacks', () => {
    const { sim, asteroid } = setup();
    sim.enqueue({ type: 'asteroid.claim', asteroid, ...westRect(sim, asteroid) });
    run(sim, 1);
    const base = [...sim.world.query(ShipC)].find((id) => sim.world.get(id, ShipC)?.base)!;
    expect(regionItems(sim, base, 'item.metal')).toBe(0);
    sim.enqueue({ type: 'transfer.order', from: homeShip(sim), to: base, items: [{ item: 'item.metal', count: 25 }] });
    const log = run(sim, 12000, (l) => l.includes('ferry.done'));
    expect(log).toContain('ferry.delivered');
    expect(log).not.toContain('transfer.blocked');
    expect(regionItems(sim, base, 'item.metal')).toBe(25);
    const stacks = [...sim.world.query(ItemStackC)].map((i) => sim.world.get(i, ItemStackC)!).filter((st) => st.item === 'item.metal' && shipIdAt(sim, st.x, st.y) === base);
    expect(stacks.reduce((n, st) => n + st.count, 0)).toBe(25);
  });
});
