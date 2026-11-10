import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, START_NODE, ShipC, galaxyIndex, newGame, playerShip, type Sim, type SimEvent } from '../sim';
import { DraftedC, PositionC } from '../sim/crew/components';
import { origin } from '../sim/crew/helpers';
import { AboardC, VehicleC } from '../sim/vehicles/components';
import { SuitC } from '../sim/eva/components';
import { hatchSpot } from '../sim/eva/shuttle';
import { planWalk } from '../sim/eva/route';
import { shipIdOf } from '../sim/regions';
import { DoorJam } from '../sim/structure';
import { giveItems } from '../sim/story/effects';
import { playerCrew } from '../sim/story/world';
import { content } from '.';

/**
 * Exploring a scene derelict by hand (#173, user ruling: no explore order): draft crew, take them out in the shuttle, hover beside the wreck,
 * float out, walk them through it, have a jammed door forced, call them back to the shuttle from deep inside, and fly home.
 */
const step = (sim: Sim, n = 1, stop?: () => boolean): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
    if (stop?.()) break;
  }
  return out;
};
const adjacent = (sim: Sim, id: string): string[] => (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();
function inScene(seed: number): { sim: Sim; wreck: number } {
  const sim = newGame(seed, content);
  sim.story.goals.skipped = true;
  sim.galaxy.fleets = [];
  giveItems(sim, 'item.fuel', 80);
  const combat = sim.world.get(playerShip(sim), CombatC);
  if (combat) combat.ftl = FTL_CHARGE_SEC;
  sim.story.queue.push({ event: 'event.derelict_sighting', due: 0, force: true });
  const next = adjacent(sim, START_NODE)[0] as string;
  sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [next, adjacent(sim, next).find((n) => n !== START_NODE) as string] });
  for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'story'; i++) sim.step();
  sim.enqueue({ type: 'story.choose', choice: 'approach' });
  step(sim, 2);
  for (const [x, y] of [[100, 60], [20, 50], [300, 200], [40, 150], [200, 20], [350, 100]] as const) {
    sim.enqueue({ type: 'sector.deploy', x, y });
    step(sim);
    if (sim.sector.state === 'active') break;
  }
  step(sim, 20);
  return { sim, wreck: sim.galaxy.event?.scene.derelicts[0]?.ship as number };
}

describe('exploring a scene derelict by hand', () => {
  it('draft, fly out, float across, walk inside, force a jammed door, walk back aboard and fly home', () => {
    const { sim, wreck } = inScene(8);
    const home = playerShip(sim);
    const shuttle = sim.world.query(VehicleC)[0] as number;
    const crew = playerCrew(sim).slice(0, 3);
    const rejected = (out: SimEvent[]) => out.filter((e) => e.type === 'command.rejected');
    for (const c of crew) sim.enqueue({ type: 'crew.draft', id: c, drafted: true });
    for (const c of crew) sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle: shuttle });
    step(sim, 2000, () => { const v = sim.world.get(shuttle, VehicleC)!; return v.pilot !== 0 && v.passengers.length === 2; });
    const party = [...sim.world.get(shuttle, VehicleC)!.passengers];
    expect(party).toHaveLength(2);

    // Out to the wreck: it holds station within a float of the ragged hull (a hatch spot exists), and the party floats across.
    expect(rejected(step(sim, 1))).toEqual([]);
    sim.enqueue({ type: 'vehicle.hover', vehicle: shuttle, ship: wreck });
    step(sim, 3000, () => !!hatchSpot(sim, shuttle));
    expect(hatchSpot(sim, shuttle)?.shipId).toBe(wreck);
    sim.enqueue({ type: 'eva.out', vehicle: shuttle });
    expect(rejected(step(sim, 600))).toEqual([]);
    for (const c of party) {
      expect(shipIdOf(sim, sim.world.get(c, PositionC)!)).toBe(wreck);
      expect(sim.world.has(c, SuitC)).toBe(true);
      expect(sim.world.has(c, DraftedC)).toBe(true);
    }

    // Walk them deep inside.
    const ship = sim.world.get(wreck, ShipC)!;
    const g = sim.sector.grid;
    const spot = hatchSpot(sim, shuttle)!;
    sim.enqueue({ type: 'crew.moveGroup', ids: party, x: ship.x + Math.floor(ship.width / 2), y: ship.y + Math.floor(ship.height / 2), ship: wreck });
    expect(rejected(step(sim, 1200))).toEqual([]);
    const far = (c: number) => { const p = sim.world.get(c, PositionC)!; return Math.hypot(p.x - spot.x, p.y - spot.y); };
    for (const c of party) expect(far(c)).toBeGreaterThan(10);

    // A jammed door they can get to: forced by the crew once undrafted (the job is ordinary construction work).
    const lead = party[0] as number;
    let door: { x: number; y: number } | null = null;
    for (let y = ship.y; y < ship.y + ship.height && !door; y++) {
      for (let x = ship.x; x < ship.x + ship.width && !door; x++) {
        if (g.get('ship', x, y) !== wreck || g.get('jam', x, y) !== DoorJam.Shut) continue;
        const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !!planWalk(sim, lead, wreck, origin(sim.world.get(lead, PositionC)!), { x: x + dx!, y: y + dy! }));
        if (side) door = { x, y };
      }
    }
    expect(door).not.toBeNull();
    sim.enqueue({ type: 'job.forceDoor', ship: wreck, x: door!.x, y: door!.y });
    for (const c of party) sim.enqueue({ type: 'crew.draft', id: c, drafted: false });
    step(sim, 6000, () => g.get('jam', door!.x, door!.y) === DoorJam.None);
    expect(g.get('jam', door!.x, door!.y)).toBe(DoorJam.None);

    // Called back from wherever they are: they walk to the hatch spot and float aboard.
    for (const c of party) sim.enqueue({ type: 'crew.draft', id: c, drafted: true });
    sim.enqueue({ type: 'crew.moveGroup', ids: party, x: ship.x + Math.floor(ship.width / 2), y: ship.y + Math.floor(ship.height / 2), ship: wreck });
    step(sim, 1200);
    for (const c of party) expect(far(c)).toBeGreaterThan(10);
    for (const c of party) sim.enqueue({ type: 'eva.board', crew: c, vehicle: shuttle });
    expect(rejected(step(sim, 1))).toEqual([]);
    step(sim, 3000, () => party.every((c) => sim.world.has(c, AboardC)));
    for (const c of party) expect(sim.world.has(c, AboardC)).toBe(true);

    // Home: everyone steps out aboard the ship.
    sim.enqueue({ type: 'vehicle.return', vehicle: shuttle });
    step(sim, 4000, () => sim.world.get(shuttle, VehicleC)!.state === 'stowed');
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('stowed');
    for (const c of crew) sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle, crew: c });
    step(sim, 1); // one tick: later, the ship's own cargo ferry may take the shuttle (and its pilot) out on a haul
    for (const c of crew) expect(shipIdOf(sim, sim.world.get(c, PositionC)!)).toBe(home);
  });
});
