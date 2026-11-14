import { describe, expect, it } from 'vitest';
import { CrewC, ModuleC, NeedsC, ShipC, VehicleC, homeShip, newGame, placementError, spawnModule, stampShip, type Sim, type SimEvent } from '../../sim';
import { AwaySiteC, SiteRunC } from '../../sim/away/components';
import { PrisonerC } from '../../sim/fight/components';
import { accessTile, footprintTiles } from '../../sim/modules/footprint';
import { footprintBlockedByCrew } from '../../sim/modules/spawn';
import { isTileWalkable } from '../../sim/modules/walk';
import { shipGrid } from '../../sim/regions';
import { deserialize, serialize } from '../../sim/save';
import { StasisC } from '../../sim/stasis/components';
import { destroyVehicle } from '../../sim/vehicles/lifecycle';
import { sealRefusal, sealWait } from '../../sim/stasis/order';
import { slabPlace, wheelSlots } from '../../sim/stasis/query';
import { rackEmpty, rackFull } from '../../sim/stasis/rack';
import { shuttleWork } from '../../sim/stasis/shuttle';
import { playerCrew } from '../../sim/story/world';
import { reputationOf } from '../../sim/story/state';
import { RELEASE_REPUTATION } from '../../sim/galaxy/tuning';
import { repKey } from '../../sim/galaxy/standing';
import { Struct } from '../../sim/structure';
import { content } from '../index';
import { shuttleOf } from './ferryFixture';

/** Slabs by shuttle (#116): prisoners marked on a prize with no wheel are sealed there and their slabs ride home in a shuttle's rack. */

type Ev = SimEvent['type'];
const of = <T extends Ev>(all: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] => all.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

/** Step until `done` holds (at most `max` ticks); every event seen. */
function until(sim: Sim, done: (all: SimEvent[]) => boolean, max: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < max && !done(all); i++) {
    sim.step();
    all.push(...sim.events.drain());
  }
  return all;
}

/** A free spot for the wheel on the home ship, off every other module's access tile. */
function placeWheel(sim: Sim): number {
  const ship = homeShip(sim);
  const at = sim.world.get(ship, ShipC)!;
  const def = content.modules['module.stasis_wheel'];
  const access = new Set(sim.world.query(ModuleC).map((id) => {
    const m = sim.world.get(id, ModuleC)!;
    const a = accessTile(content.modules[m.def as 'module.stasis_wheel'], m.x, m.y, m.rot);
    return a ? `${a.x},${a.y}` : '';
  }));
  for (let y = at.y; y < at.y + at.height; y++) {
    for (let x = at.x; x < at.x + at.width; x++) {
      if (placementError(sim, ship, 'module.stasis_wheel', x, y, 0) !== null || footprintBlockedByCrew(sim, ship, 'module.stasis_wheel', x, y, 0)) continue;
      if (footprintTiles(def, x, y, 0).some((t) => access.has(`${t.x},${t.y}`))) continue;
      const id = spawnModule(sim, 'module.stasis_wheel', x, y, 0);
      sim.world.get(id, ModuleC)!.powered = true;
      return id;
    }
  }
  throw new Error('no room for a wheel');
}

/** A working (powered) airlock on the prize's hull, as the boarders came in by: the shuttle docks there. */
function airlockOn(sim: Sim, ship: number): number {
  const g = shipGrid(sim, ship)!;
  let power = 0;
  for (let y = g.y0; y < g.y0 + g.height && !power; y++) {
    for (let x = g.x0; x < g.x0 + g.width && !power; x++) if (!placementError(sim, ship, 'module.reactor', x, y, 0)) power = spawnModule(sim, 'module.reactor', x, y, 0);
  }
  if (!power) throw new Error('no room for a reactor');
  for (let rot = 0; rot < 4; rot++) {
    for (let y = g.y0; y < g.y0 + g.height; y++) {
      for (let x = g.x0; x < g.x0 + g.width; x++) {
        if (placementError(sim, ship, 'module.airlock', x, y, rot)) continue;
        const lock = spawnModule(sim, 'module.airlock', x, y, rot);
        sim.world.get(lock, ModuleC)!.powered = true;
        return lock;
      }
    }
  }
  throw new Error('no room for an airlock');
}

/**
 * The starter game with a stasis wheel at home and a captured prize 16 tiles east (a sealed 8x5 hull with air and a working airlock, no wheel) holding
 * `n` prisoners, every crew member fed and rested.
 */
function prizeGame(n = 1, wheel = true): { sim: Sim; home: number; prize: number; wheel: number; prisoners: number[]; shuttle: number } {
  const sim = newGame(3, content);
  const home = homeShip(sim);
  const h = sim.world.get(home, ShipC)!;
  const rows = ['..........', '.########.', '.#______#.', '.#______#.', '.#______#.', '.########.', '..........'];
  const prize = stampShip(sim, { name: 'Taken', rows, modules: [] }, { faction: 'hostile', state: 'active', x: h.x + h.width + 16, y: h.y + 2 });
  const g = shipGrid(sim, prize)!;
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Floor) g.set('o2', x, y, 21);
  airlockOn(sim, prize);
  for (let i = 0; i < 5; i++) sim.step();
  const w = wheel ? placeWheel(sim) : 0;
  for (const c of playerCrew(sim)) Object.assign(sim.world.get(c, NeedsC)!, { hunger: 100, rest: 100 });
  const free: { x: number; y: number }[] = [];
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Floor && isTileWalkable(sim, g, x, y)) free.push({ x, y });
  for (let i = 0; i < n; i++) sim.enqueue({ type: 'debug.spawnCrew', ship: prize, x: free[free.length - 1 - i]!.x, y: free[free.length - 1 - i]!.y, role: 'role.security', faction: 'hostile' });
  sim.step();
  sim.enqueue({ type: 'debug.capture', ship: prize });
  sim.step();
  sim.events.drain();
  const prisoners = [...sim.world.query(PrisonerC)].sort((a, b) => a - b);
  return { sim, home, prize, wheel: w, prisoners, shuttle: shuttleOf(sim) };
}

describe('slabs by shuttle', () => {
  it('marking a prisoner on a prize with no wheel sends a shuttle: sealed there, carried home in the rack, stowed in the home wheel', () => {
    const { sim, home, prize, wheel, prisoners, shuttle } = prizeGame(1);
    const [p] = prisoners as [number];
    expect(sim.world.get(prize, ShipC)?.state).toBe('prize');
    expect(sealRefusal(sim, p)).toBeNull(); // not refused for want of a wheel on the prize: the home wheel is reached by shuttle
    sim.enqueue({ type: 'prisoner.seal', crew: p, on: true });
    const opened = until(sim, (a) => of(a, 'away.opened').length > 0, 200);
    expect(of(opened, 'away.opened')).toMatchObject([{ ship: prize, vehicle: shuttle }]);
    expect(sim.world.get(prize, AwaySiteC)).toMatchObject({ owner: 'stasis', demand: { hauling: 1 } });
    // At home the rack takes one empty slab from the wheel before the run leaves.
    until(sim, () => sim.world.get(shuttle, SiteRunC)?.phase === 'fly', 20 * 300);
    expect(rackEmpty(sim, shuttle)).toBe(1);
    const sealed = until(sim, (a) => of(a, 'stasis.shipped').length > 0, 20 * 150);
    expect(of(sealed, 'stasis.sealed')).toMatchObject([{ crew: p, ship: prize }]);
    expect(rackFull(sim, shuttle)).toEqual([p]);
    expect(slabPlace(sim, p)?.kind).toBe('shuttle');
    expect(shuttleWork(sim, prize)).toBe(0);
    // In the rack the slab keeps its charge; the site closes, the party and the slab ride home, and the crew cart it to the wheel.
    const reserve = sim.world.get(p, StasisC)!.reserve;
    const home2 = until(sim, (a) => of(a, 'stasis.stowed').length > 0, 20 * 150);
    expect(of(home2, 'stasis.unloaded')).toMatchObject([{ vehicle: shuttle, ship: home, crew: [p] }]);
    expect(of(home2, 'stasis.stowed')).toMatchObject([{ crew: p, wheel, ship: home }]);
    expect(sim.world.get(p, StasisC)!.reserve).toBeGreaterThanOrEqual(reserve - 20 * 60); // only the short wait on the floor by the bay drained it
    until(sim, () => !sim.world.has(prize, AwaySiteC), 20 * 300);
    expect(sim.world.has(prize, AwaySiteC)).toBe(false);
    expect(rackEmpty(sim, shuttle)).toBe(0);
  });

  it('two prisoners go in one run: two empty slabs out, two full ones home', () => {
    const { sim, prize, wheel, prisoners, shuttle } = prizeGame(2);
    expect(prisoners).toHaveLength(2);
    for (const p of prisoners) sim.enqueue({ type: 'prisoner.seal', crew: p, on: true });
    until(sim, () => sim.world.get(shuttle, SiteRunC)?.phase === 'fly', 20 * 300);
    expect(rackEmpty(sim, shuttle)).toBe(2);
    const all = until(sim, (a) => of(a, 'stasis.stowed').length === 2, 20 * 300);
    expect(of(all, 'stasis.shipped').map((e) => e.crew).sort()).toEqual([...prisoners]);
    expect(of(all, 'stasis.stowed').every((e) => e.wheel === wheel)).toBe(true);
    expect(sim.world.get(prize, AwaySiteC)?.status ?? 'gone').not.toBe('open');
  });

  it('with no free shuttle the mark stands and waits (noShuttle), and is refused only when the player has no shuttle at all', () => {
    const { sim, prisoners, shuttle } = prizeGame(1);
    const [p] = prisoners as [number];
    sim.world.get(shuttle, VehicleC)!.state = 'flying'; // out on other business: not free to serve a site
    sim.enqueue({ type: 'prisoner.seal', crew: p, on: true });
    until(sim, () => false, 40);
    expect(sim.world.get(p, PrisonerC)?.seal).toBe(true);
    expect(sealWait(sim, p)).toBe('noShuttle');
    destroyVehicle(sim, shuttle);
    expect(sealRefusal(sim, p)).toBe('noShuttle');
  });

  it('a prize prisoner is refused when no ship of the player has a wheel with room', () => {
    const { sim, prisoners } = prizeGame(1, false);
    expect(sealRefusal(sim, prisoners[0]!)).toBe('noWheel');
  });

  it('a slab in a shuttle that is destroyed is lost with it', () => {
    const { sim, prisoners, shuttle } = prizeGame(1);
    const [p] = prisoners as [number];
    sim.enqueue({ type: 'prisoner.seal', crew: p, on: true });
    until(sim, (a) => of(a, 'stasis.shipped').length > 0, 20 * 150);
    expect(rackFull(sim, shuttle)).toEqual([p]);
    const saved = deserialize(serialize(sim), content); // the rack and the slab in it survive a save
    expect(rackFull(saved, shuttle)).toEqual([p]);
    destroyVehicle(sim, shuttle);
    const lost = until(sim, (a) => of(a, 'stasis.lost').length > 0, 5);
    expect(of(lost, 'stasis.lost')).toMatchObject([{ crew: p, vehicle: shuttle }]);
    expect(sim.world.has(p, CrewC)).toBe(false);
  });
});

describe('releasing a frozen prisoner', () => {
  it('opens the slab (the empty slab stays in the wheel slot) and gives the standing of the faction they were taken from', () => {
    const { sim, prisoners, wheel } = prizeGame(1);
    const [p] = prisoners as [number];
    const from = sim.world.get(p, PrisonerC)?.from;
    sim.enqueue({ type: 'prisoner.seal', crew: p, on: true });
    until(sim, (a) => of(a, 'stasis.stowed').length > 0, 20 * 300);
    expect(slabPlace(sim, p)?.kind).toBe('wheel');
    const key = from ? repKey(sim, from) : '';
    const before = key ? reputationOf(sim.story, key) : 0;
    sim.enqueue({ type: 'prisoner.release', crew: p });
    const all = until(sim, (a) => of(a, 'crew.released').length > 0, 3);
    expect(of(all, 'crew.released')).toMatchObject([{ crew: p }]);
    expect(sim.world.has(p, CrewC)).toBe(false);
    expect(wheelSlots(sim.world, wheel).some((sl) => sl.kind === 'full')).toBe(false); // the slot holds an empty slab again
    if (key) expect(reputationOf(sim.story, key)).toBe(before + RELEASE_REPUTATION);
  });

  it('refuses a slab on its way (in the shuttle) as inTransit', () => {
    const { sim, prisoners } = prizeGame(1);
    const [p] = prisoners as [number];
    sim.enqueue({ type: 'prisoner.seal', crew: p, on: true });
    until(sim, (a) => of(a, 'stasis.shipped').length > 0, 20 * 150);
    sim.enqueue({ type: 'prisoner.release', crew: p });
    const all = until(sim, () => false, 2);
    expect(of(all, 'command.rejected')).toMatchObject([{ command: 'prisoner.release', reason: 'inTransit' }]);
  });
});
