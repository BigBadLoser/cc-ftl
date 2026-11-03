import { describe, expect, it } from 'vitest';
import { CrewC, DraftedC, NeedsC, PathC, PositionC, ShipC, VehicleC, createCrew, type Sim } from '../../sim';
import { AirlockC } from '../../sim/modules/airlock';
import { content } from '../index';
import { placementError, shipGrid, spawnModule } from '../../sim';
import { nearestExterior } from '../../sim/eva/shuttle';
import { boardCrew, occupants, vehicleDefOf } from '../../sim/vehicles/lifecycle';
import { AwayC, AwaySiteC, SiteRunC } from '../../sim/away/components';
import { SuitC } from '../../sim/eva/components';
import { shipIdOf } from '../../sim/regions';
import { crewOn, landed, siteWork } from './awayFixture';
import { shuttleOf } from './ferryFixture';
import { of, play, setup } from './salvageEvaFixture';

/** A working airlock on the wreck's hull. */
function wreckAirlock(sim: Sim, wreck: number): number {
  const g = shipGrid(sim, wreck)!;
  for (let rot = 0; rot < 4; rot++) {
    for (let y = g.y0; y < g.y0 + g.height; y++) {
      for (let x = g.x0; x < g.x0 + g.width; x++) if (!placementError(sim, wreck, 'module.airlock', x, y, rot)) return spawnModule(sim, 'module.airlock', x, y, rot);
    }
  }
  throw new Error('no room for an airlock');
}

/** A crew member out on the home ship's hull in a suit under the refill line, with no airlock holding air: out of air reach. */
function outOfReach(): { sim: Sim; home: number; shuttle: number; c: number } {
  const { sim, home } = setup();
  const shuttle = shuttleOf(sim);
  const [c] = crewOn(sim, home) as [number];
  for (const id of sim.world.query(AirlockC)) sim.world.get(id, AirlockC)!.air = 0;
  const s = sim.world.get(home, ShipC)!;
  const spot = nearestExterior(sim, home, { x: s.x + s.width / 2, y: s.y - 1 }, 1)[0]!;
  Object.assign(sim.world.get(c, PositionC)!, { x: spot.x, y: spot.y, toX: spot.x, toY: spot.y, progress: 0 });
  sim.world.get(c, PathC)!.steps = [];
  sim.world.add(c, SuitC, { worn: true, air: 150 });
  return { sim, home, shuttle, c };
}

/** Fill the shuttle's seats with new crew embarked by hand. */
function fill(sim: Sim, home: number, shuttle: number, c: number): void {
  const v = sim.world.get(shuttle, VehicleC)!;
  const at = sim.world.get(crewOn(sim, home).find((o) => o !== c)!, PositionC)!;
  while (occupants(v).length < (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) boardCrew(sim, createCrew(sim, home, 'role.engineer', { x: at.x, y: at.y }, { faction: 'player', rest: 100 }), shuttle);
}

const isRobot = (sim: Sim, c: number): boolean => sim.world.get(c, CrewC)?.species === 'species.robot';

describe('away sites: who goes (#286 slice 2b)', () => {
  it('a robot takes a seat like anyone, floats out without a suit and works on the site (#284)', () => {
    const { sim, home, wreck } = setup();
    siteWork(sim, wreck, 2);
    const shuttle = shuttleOf(sim);
    for (const c of crewOn(sim, home)) sim.world.add(c, DraftedC, { target: null }); // the humans are busy: only the robot is free
    const at = sim.world.get(crewOn(sim, home)[0]!, PositionC)!;
    const bot = createCrew(sim, home, 'role.robot_worker', { x: at.x, y: at.y }, { faction: 'player', rest: 100 });
    expect(bot).toBeGreaterThan(0);
    sim.enqueue({ type: 'away.open', ship: wreck });
    const all = play(sim, 20 * 600, (a) => a.some((e) => e.type === 'crew.jobDone' && e.ship === wreck && e.crew === bot));
    expect(sim.world.get(bot, AwayC)).toMatchObject({ site: wreck, vehicle: shuttle });
    expect(sim.world.has(bot, SuitC)).toBe(false); // suits are for those who breathe
    expect(all.some((e) => e.type === 'crew.jobDone' && e.ship === wreck && e.crew === bot)).toBe(true);
    // The seat it took was beyond the suits or a suited one, it needs none either way: the shuttle's suits are all still aboard.
    expect(sim.world.get(shuttle, VehicleC)?.suits ?? 3).toBe(3);
    expect(isRobot(sim, bot)).toBe(true);
  });

  it('a crew member out of air reach on the home ship is fetched by a pickup run and brought in', () => {
    const { sim, home, shuttle, c } = outOfReach();
    const all = play(sim, 20 * 300, (a) => of(a, 'away.pickup').length > 0 && !sim.world.has(shuttle, SiteRunC));
    expect(of(all, 'crew.airUnreachable').map((e) => e.crew)).toContain(c);
    expect(of(all, 'away.pickup')).toMatchObject([{ ship: home, vehicle: shuttle, crew: [c] }]);
    expect(sim.world.has(shuttle, SiteRunC)).toBe(false); // the run is over: the crew member is home
    expect(sim.world.has(c, AwayC)).toBe(false);
    expect(sim.world.get(shuttle, VehicleC)).toMatchObject({ state: 'stowed', autopilot: false });
    expect(shipIdOf(sim, sim.world.get(c, PositionC)!)).toBe(home);
    expect(sim.world.has(c, SuitC)).toBe(false); // came in through the shuttle: the suit is in its stock
  });

  it('a shuttle full of crew embarked by hand is not sent on a pickup (Codex 4449367460)', () => {
    const { sim, home, shuttle, c } = outOfReach();
    fill(sim, home, shuttle, c);
    const all = play(sim, 20 * 30);
    expect(of(all, 'crew.airUnreachable').map((e) => e.crew)).toContain(c);
    expect(of(all, 'away.pickup')).toEqual([]); // no seat for them: the request stays open for another shuttle
    expect(sim.world.has(c, AwayC)).toBe(false);
  });

  it('a pickup shuttle filled on the way gives the request up, so another can take it (Codex 4449367460)', () => {
    const { sim, home, shuttle, c } = outOfReach();
    const all = play(sim, 20 * 30, (a) => of(a, 'away.pickup').length > 0);
    expect(of(all, 'away.pickup')).toHaveLength(1);
    fill(sim, home, shuttle, c);
    play(sim, 20 * 120, () => sim.world.get(shuttle, SiteRunC)?.phase === 'home' || !sim.world.has(shuttle, SiteRunC));
    expect(sim.world.has(c, AwayC)).toBe(false);
    expect(sim.world.get(shuttle, SiteRunC)?.ending ?? true).toBe(true);
  });

  it('a site whose shuttle run is gone takes another free shuttle, which brings the party on', () => {
    const { sim, wreck, shuttle, party } = landed();
    const [tired] = party as [number];
    sim.world.get(tired, NeedsC)!.rest = 5;
    play(sim, 20 * 300, () => sim.world.get(shuttle, SiteRunC)?.phase === 'board');
    sim.world.remove(shuttle, SiteRunC); // the run is gone with part of the party out on the site
    const all = play(sim, 2);
    expect(of(all, 'away.pickup')).toMatchObject([{ ship: wreck, vehicle: shuttle }]);
    expect(sim.world.get(wreck, AwaySiteC)?.vehicle).toBe(shuttle);
    expect(sim.world.get(shuttle, SiteRunC)).toMatchObject({ site: wreck, phase: 'board' });
    for (const c of party.filter((c) => sim.world.has(c, AwayC))) expect(sim.world.get(c, AwayC)?.vehicle).toBe(shuttle);
  });

  it('a site whose shuttle is lost gets another free shuttle; with none its party is stranded', () => {
    const { sim, wreck, shuttle, party } = landed();
    // The shuttle is destroyed while the party works.
    sim.world.destroyEntity(shuttle);
    const all = play(sim, 20 * 5);
    expect(of(all, 'away.stranded')).toMatchObject([{ ship: wreck }]);
    expect(sim.world.get(wreck, AwaySiteC)?.block).toBe('stranded');
    for (const c of party) expect(sim.world.get(c, AwayC)?.site).toBe(wreck); // still the site's party
    expect(sim.world.query(SiteRunC)).toEqual([]);
  });

  it('docks at a working airlock of the site: the party steps out there and back in to go home', () => {
    // Airlocks that need no power: the site's works though nothing on the wreck makes power.
    const { sim, home, wreck } = setup(3, { ...content, modules: { ...content.modules, 'module.airlock': { ...content.modules['module.airlock']!, power: 0 } } });
    siteWork(sim, wreck, 2);
    const shuttle = shuttleOf(sim);
    const lock = wreckAirlock(sim, wreck);
    sim.enqueue({ type: 'away.open', ship: wreck });
    let docked = false;
    let worked = false;
    for (let i = 0; i < 20 * 400 && !(docked && worked); i++) {
      const ev = play(sim, 1);
      const v = sim.world.get(shuttle, VehicleC)!;
      if (v.state === 'docked' && v.dock === lock && sim.world.get(shuttle, SiteRunC)?.phase === 'stay') docked = true;
      if (ev.some((e) => e.type === 'crew.jobDone' && e.ship === wreck)) worked = true;
    }
    expect(docked).toBe(true);
    expect(worked).toBe(true);
    const party = crewOn(sim, wreck).filter((c) => sim.world.has(c, AwayC));
    expect(party.length).toBeGreaterThan(0);
    // The wreck's air came through the working airlock: they step out breathing, no suits needed.
    for (const c of party) expect(sim.world.has(c, SuitC)).toBe(false);
    // One of them is tired: they walk to the airlock, step in, and the trip takes them home.
    const [tired] = party as [number];
    sim.world.get(tired, NeedsC)!.rest = 5;
    let back = false;
    for (let i = 0; i < 20 * 300 && !back; i++) {
      back = of(play(sim, 1), 'away.returned').some((e) => e.crew.includes(tired));
    }
    expect(back).toBe(true);
    expect(shipIdOf(sim, sim.world.get(tired, PositionC)!)).toBe(home);
  });
});
