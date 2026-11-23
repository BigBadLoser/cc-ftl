import { describe, expect, it } from 'vitest';
import { ShipC } from '../sim/combat/components';
import { freeSpot } from '../sim/galaxy/arrivals';
import { npcActivities } from '../sim/galaxy/traffic';
import { shuttleCalls, ShuttleCallC, startCall, stepCall } from '../sim/galaxy/trafficCall';
import { NPC_ACTIVITIES } from '../sim/galaxy/tuningWar';
import { inspectingFleets } from '../sim/inspect/holds';
import { liveInspection } from '../sim/inspect/start';
import { InspectionC, inspections, playerInspections } from '../sim/inspect/types';
import { MiningPodC } from '../sim/mining/components';
import { ModuleC } from '../sim/modules/components';
import { shipIdOf } from '../sim/regions';
import type { Sim } from '../sim/sim';
import type { Deal } from '../sim/trade/types';
import { freeAirlock } from '../sim/trade/player';
import { VehicleC } from '../sim/vehicles/components';
import { vehicleDefOf } from '../sim/vehicles/lifecycle';
import { run, runLog } from '../../test/support/run';
import { cachedScenario } from '../../test/support/scenario';
import { expectReplayable } from '../../test/support/world';

/**
 * NPC ships go about their business in the player's node (#603) through the systems the player's ships use: a station's shuttle calls at a visiting
 * trader (`freeShuttle`, the vehicle commands, `sendHome`), a patrol inspects an NPC ship (`startInspection` with a target), a miner's pod mines.
 * `?scenario=business&patrol&stage=busy`: the shuttle is out and the patrol's inspectors are on their way (seed 1: a trader, a patrol, no miner room).
 */
const busy = (): Sim => cachedScenario('business', { seed: 1, params: { patrol: true, stage: 'busy' } }).sim;

/** The one call under way, its shuttle and the ship it calls at. */
function theCall(sim: Sim): { id: number; ship: number } {
  const [id] = shuttleCalls(sim) as [number];
  return { id, ship: sim.world.get(id, ShuttleCallC)!.ship };
}

/** The NPC inspection under way. */
const theInspection = (sim: Sim): number => inspections(sim).find((id) => sim.world.get(id, InspectionC)?.npc) as number;

describe('NPC traffic in the player\'s node', () => {
  it('the station\'s shuttle calls at the trader, stays a while and flies home; the traffic stays under its cap', () => {
    const sim = busy();
    const { id, ship } = theCall(sim);
    const v = sim.world.get(id, VehicleC)!;
    const home = v.homeShip;
    expect(sim.world.get(ship, ShipC)?.gen?.owner).toBe('traders');
    let over = 0;
    const check = (s: Sim): boolean => {
      if (npcActivities(s) > NPC_ACTIVITIES) over++;
      return false;
    };
    run(sim, 1200, { until: (s) => check(s) || sim.world.get(id, ShuttleCallC)?.phase === 'docked' });
    expect(v.state).toBe('docked');
    expect(shipIdOf(sim, sim.world.get(v.dock, ModuleC)!)).toBe(ship);
    run(sim, 2400, { until: (s) => check(s) || sim.world.get(id, ShuttleCallC)?.phase === 'rest' });
    expect(v.state).toBe('stowed');
    expect(v.homeShip).toBe(home);
    expect(over).toBe(0);
    // Resting, it is free for the player's trade (#613 review): a job that flies it to the player's ship ends the call, and it is not called home.
    const airlock = freeAirlock(sim, id);
    expect(airlock).not.toBe(0);
    v.autopilot = true; // as a deal takes its courier (trade/deals.ts `takeCourier`)
    sim.enqueue({ type: 'vehicle.dock', vehicle: id, airlock });
    run(sim, 3);
    expect(sim.world.has(id, ShuttleCallC)).toBe(false);
    expect(v.dest).toEqual({ type: 'dock', airlock });
  });

  it('a call gives way to the player\'s trade: none starts, and one under way turns home', () => {
    const sim = busy();
    const { id, ship } = theCall(sim);
    const station = sim.world.get(id, VehicleC)!.homeShip;
    sim.trade.deals.push({ phase: 'dispatch' } as unknown as Deal); // a live deal is all the rule reads
    const c = sim.world.get(id, ShuttleCallC)!;
    stepCall(sim, id, c);
    expect(['back', 'rest']).toContain(c.phase); // turned home ('rest' at once if it had not left yet)
    sim.world.remove(id, ShuttleCallC);
    expect(startCall(sim, station, ship)).toBe(false);
  });

  it('a patrol\'s inspection of an NPC ship is not the player\'s, holds the patrol, and leaves when a fight starts', () => {
    const sim = busy();
    const insp = sim.world.get(theInspection(sim), InspectionC)!;
    expect(sim.world.get(insp.ship, ShipC)?.faction).not.toBe('player');
    expect(playerInspections(sim)).toEqual([]);
    expect(liveInspection(sim)).toBeUndefined();
    expect(insp.patrol !== undefined && inspectingFleets(sim).has(insp.patrol)).toBe(true);
    const room = freeSpot(sim, 40, 30)!;
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: room.x, y: room.y });
    const log = runLog(sim, 40, { until: () => insp.phase === 'leave' });
    expect(sim.sector.inCombat).toBe(true);
    expect(insp.phase).toBe('leave');
    expect(insp.outcome).toBe('off');
    expect(log.filter((l) => l.startsWith('inspect.'))).toEqual([]);
  });

  it('a miner whose hull has no pod bay does not mine, and nothing complains', () => {
    const sim = busy();
    const miners = sim.galaxy.fleets.filter((f) => f.node === sim.galaxy.current && f.role === 'miner').flatMap((f) => f.ships.flatMap((c) => (c.ship === undefined ? [] : [c.ship])));
    // Seed 1 has no room for its miner: one of the trader's hulls stands in (a freighter, no pod bay), as a mining fleet's freighter would.
    const fleet = sim.galaxy.fleets.find((f) => f.node === sim.galaxy.current && f.role === 'trader' && f.ships.some((c) => c.ship !== undefined))!;
    const freighter = miners[0] ?? (fleet.ships.find((c) => c.ship !== undefined)!.ship as number);
    fleet.role = 'miner';
    const pods = sim.world.query(VehicleC).filter((v) => sim.world.get(v, VehicleC)?.homeShip === freighter && vehicleDefOf(sim, sim.world.get(v, VehicleC)!)?.mining);
    expect(pods).toEqual([]);
    const log = runLog(sim, 200);
    expect(sim.world.query(MiningPodC).filter((p) => sim.world.get(p, VehicleC)?.homeShip === freighter)).toEqual([]);
    expect(log.filter((l) => l.startsWith('command.rejected:mining'))).toEqual([]);
  });

  it('replays, through a save and load', () => {
    expectReplayable(busy, 600, { saveAt: 300 });
  });
});
