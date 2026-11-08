import { describe, expect, it } from 'vitest';
import { AirlockC, CrewC, ShipC, TraderC, contrabandAboard, deserialize, newGame, serialize, storageAdd, type Sim } from '../sim';
import { ModuleC } from '../sim/modules/components';
import { SuitC } from '../sim/eva/components';
import { INSPECT_BAN_TURNS, INSPECT_BRIBE_CHANCE } from '../sim/blackmarket/tuning';
import { scanPending } from '../sim/blackmarket/scan';
import { InspectionC, type Inspection } from '../sim/inspect/types';
import { liveInspection } from '../sim/inspect/start';
import { abortInspections } from '../sim/inspect/flow';
import { CarryingC } from '../sim/items/components';
import { heldItems } from '../sim/items/held';
import { AllegianceC } from '../sim/fight/components';
import { JobC, PositionC } from '../sim/crew/components';
import { VehicleC } from '../sim/vehicles/components';
import { shipIdOf } from '../sim/regions';
import { playerStorages } from '../sim/story/world';
import { reputationOf } from '../sim/story/state';
import { content } from './index';

const STOLEN = 'item.stolen_goods';

function run(sim: Sim, n: number, until?: () => boolean): string[] {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `${e.type}:${e.command}:${e.reason}` : e.type);
    if (until?.()) break;
  }
  return log;
}

/** A new game beside a navy station, contraband in the hold (when `stolen`), the station hailed: its inspectors set off. */
function inspected(stolen = 10, before?: (sim: Sim) => void): { sim: Sim; station: number; id: number; insp: Inspection } {
  const sim = newGame(3, content);
  run(sim, 20);
  before?.(sim);
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
  run(sim, 1);
  const station = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile) as number;
  sim.world.get(station, TraderC)!.owner = 'navy';
  if (stolen) expect(storageAdd(sim, playerStorages(sim)[0] as number, STOLEN, stolen)).toBe(stolen);
  sim.enqueue({ type: 'trade.hail', ship: station });
  run(sim, 1);
  const live = liveInspection(sim);
  expect(live).toBeDefined();
  return { sim, station, id: live![0], insp: live![1] };
}

const phaseIs = (sim: Sim, id: number, p: Inspection['phase']) => () => sim.world.get(id, InspectionC)?.phase === p;

describe('station inspections', () => {
  it('inspectors come aboard, search, carry the contraband to their shuttle and wait; the fine settles it', () => {
    const { sim, id, insp } = inspected();
    expect(scanPending(sim)).toBe(false); // on their way: trade waits only while they search or wait for an answer
    const phases = new Set<string>();
    run(sim, 6000, () => (phases.add(insp.phase), insp.phase === 'settle'));
    expect([...phases]).toEqual(['fly', 'search', 'settle']);
    expect(scanPending(sim)).toBe(true);
    expect(insp.found).toEqual([{ item: STOLEN, count: 10 }]);
    expect(sim.world.get(id, VehicleC)!.cargo).toEqual([{ item: STOLEN, count: 10 }]);
    expect(contrabandAboard(sim)).toEqual([]);
    const lead = insp.crew[0]!;
    expect(shipIdOf(sim, sim.world.get(lead, PositionC)!)).toBe(insp.ship);
    const credits = sim.trade.credits;
    const navy = reputationOf(sim.story, 'navy');
    sim.enqueue({ type: 'inspect.settle', inspection: id, choice: 'fine' });
    run(sim, 1);
    expect(sim.trade.credits).toBe(credits - insp.fine!);
    expect(reputationOf(sim.story, 'navy')).toBeLessThan(navy);
    expect(scanPending(sim)).toBe(false);
    run(sim, 6000, () => !sim.world.has(id, InspectionC));
    expect(sim.world.has(id, InspectionC)).toBe(false);
    expect(sim.world.has(lead, PositionC)).toBe(false);
    expect(sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)!.party === id)).toEqual([]);
  });

  /** Step the rng to the next state where the bribe roll comes out `taken` (the roll is the handler's first draw). */
  function rollBribe(sim: Sim, taken: boolean): void {
    for (let i = 0; i < 100; i++) {
      const at = sim.rng.getState();
      const ok = sim.rng.chance(INSPECT_BRIBE_CHANCE);
      sim.rng.setState(at);
      if (ok === taken) return;
      sim.rng.next();
    }
    throw new Error('no roll');
  }

  it('a bribe taken is paid and the goods are handed back; a bribe turned down costs standing and is not offered again', () => {
    const { sim, id, insp } = inspected();
    run(sim, 6000, phaseIs(sim, id, 'settle'));
    expect(insp.phase).toBe('settle');
    const navy = reputationOf(sim.story, 'navy');
    sim.trade.credits = insp.bribe! - 1;
    sim.enqueue({ type: 'inspect.settle', inspection: id, choice: 'bribe' });
    expect(run(sim, 1)).toContain('command.rejected:inspect.settle:cantAfford');
    sim.trade.credits = insp.bribe! + 5;
    rollBribe(sim, false);
    sim.enqueue({ type: 'inspect.settle', inspection: id, choice: 'bribe' });
    expect(run(sim, 1)).toContain('inspect.bribeRefused');
    expect(sim.trade.credits).toBe(insp.bribe! + 5);
    expect(reputationOf(sim.story, 'navy')).toBeLessThan(navy);
    expect(insp.phase).toBe('settle');
    sim.enqueue({ type: 'inspect.settle', inspection: id, choice: 'bribe' });
    expect(run(sim, 1)).toContain('command.rejected:inspect.settle:bribeRefused');

    const second = inspected();
    run(second.sim, 6000, phaseIs(second.sim, second.id, 'settle'));
    second.sim.trade.credits = second.insp.bribe! + 5;
    const rep = reputationOf(second.sim.story, 'navy');
    rollBribe(second.sim, true);
    second.sim.enqueue({ type: 'inspect.settle', inspection: second.id, choice: 'bribe' });
    run(second.sim, 1);
    expect(second.sim.trade.credits).toBe(5);
    expect(reputationOf(second.sim.story, 'navy')).toBe(rep);
    expect(contrabandAboard(second.sim)).toEqual([{ item: STOLEN, count: 10 }]);
    run(second.sim, 3000, () => !second.sim.world.has(second.id, InspectionC));
    expect(second.sim.world.has(second.id, InspectionC)).toBe(false);
    expect(contrabandAboard(second.sim)).toEqual([{ item: STOLEN, count: 10 }]);
  });

  it('refusing costs standing and the station service; they leave with the goods', () => {
    const { sim, station, id, insp } = inspected();
    run(sim, 6000, phaseIs(sim, id, 'settle'));
    const credits = sim.trade.credits;
    const navy = reputationOf(sim.story, 'navy');
    sim.enqueue({ type: 'inspect.settle', inspection: id, choice: 'refuse' });
    run(sim, 1);
    expect(insp.phase).toBe('leave');
    expect(sim.trade.credits).toBe(credits);
    expect(reputationOf(sim.story, 'navy')).toBeLessThan(navy);
    expect(contrabandAboard(sim)).toEqual([]);
    sim.enqueue({ type: 'trade.hail', ship: station });
    expect(run(sim, 1)).toContain('trade.hailRefused');
    expect(sim.trade.hails.find((h) => h.ship === station)?.reason).toBe('barred');
    sim.galaxy.turn += INSPECT_BAN_TURNS; // the ban lapses (whether they talk now is the standing's say)
    sim.enqueue({ type: 'trade.hail', ship: station });
    run(sim, 1);
    expect(sim.trade.hails.find((h) => h.ship === station)?.reason).not.toBe('barred');
  });

  it('with nothing to find they search every hold and leave clean, and trade opens', () => {
    const { sim, id, insp } = inspected(0);
    const searched = new Set<number>();
    const log = run(sim, 6000, () => {
      for (const j of sim.world.query(JobC)) if (sim.world.get(j, JobC)!.kind === 'search' && sim.world.get(j, JobC)!.progress > 0) searched.add(sim.world.get(j, JobC)!.target!);
      return insp.phase === 'leave';
    });
    expect(log).toContain('inspect.settled');
    expect(insp.outcome).toBe('clean');
    expect(searched.size).toBe(playerStorages(sim).length);
    expect(scanPending(sim)).toBe(false);
    run(sim, 6000, () => !sim.world.has(id, InspectionC));
    expect(sim.world.has(id, InspectionC)).toBe(false);
  });

  it('with no airlock to dock at they board by EVA in suits: blocked while there is no way in, then in through the airlock and search as usual', () => {
    const { sim, id, insp } = inspected(10, (s) => {
      for (const a of s.world.query(AirlockC)) s.world.get(a, ModuleC)!.enabled = false;
    });
    run(sim, 3000, () => !!insp.blocked);
    expect(insp.phase).toBe('search');
    expect(insp.blocked).toBe(true);
    expect(sim.world.get(id, VehicleC)!.state).toBe('flying');
    expect(insp.crew.every((c) => sim.world.has(c, SuitC) && shipIdOf(sim, sim.world.get(c, PositionC)!) === insp.ship)).toBe(true);
    for (const a of sim.world.query(AirlockC)) sim.world.get(a, ModuleC)!.enabled = true;
    run(sim, 8000, phaseIs(sim, id, 'settle'));
    expect(insp.phase).toBe('settle');
    expect(insp.blocked).toBeUndefined();
    expect(insp.found).toEqual([{ item: STOLEN, count: 10 }]);
    // A bribe taken with the shuttle still hovering hands the goods back all the same.
    expect(sim.world.get(id, VehicleC)!.state).toBe('flying');
    sim.trade.credits = insp.bribe! + 5;
    rollBribe(sim, true);
    sim.enqueue({ type: 'inspect.settle', inspection: id, choice: 'bribe' });
    run(sim, 1);
    expect(sim.world.get(id, VehicleC)!.cargo).toEqual([]);
    expect(contrabandAboard(sim)).toEqual([{ item: STOLEN, count: 10 }]);
  });

  it('a fitted contraband upgrade and goods a crew member carries are found and carried off too', () => {
    let mod = 0;
    let crew = 0;
    const { sim, id, insp } = inspected(0, (s) => {
      mod = s.world.query(ModuleC).find((m) => !!s.content.modules[s.world.get(m, ModuleC)!.def]?.upgradeSlot) as number;
      s.world.get(mod, ModuleC)!.upgrade = 'item.upg_nuke';
    });
    run(sim, 6000, () => {
      if (!crew && insp.phase === 'search') {
        // A crew member standing by the first inspector with stolen goods in hand.
        crew = sim.world.query(CrewC).find((c) => sim.world.get(c, AllegianceC)?.faction === 'player') as number;
        sim.world.add(crew, CarryingC, { item: STOLEN, count: 3 });
      }
      return insp.phase === 'settle';
    });
    expect(insp.phase).toBe('settle');
    console.log(JSON.stringify(insp.found), JSON.stringify(sim.world.get(id, VehicleC)!.cargo), JSON.stringify(heldItems(sim).filter((h) => h.item !== 'item.metal').map((h) => [h.item, h.where, h.count])));
    expect(sim.world.get(mod, ModuleC)!.upgrade).toBeUndefined();
    expect(insp.found.find((f) => f.item === 'item.upg_nuke')?.count).toBe(1);
    expect(insp.value).toBeGreaterThanOrEqual(content.items['item.upg_nuke'].price);
    expect(contrabandAboard(sim).filter((l) => l.item === 'item.upg_nuke')).toEqual([]);
  });

  it('leaving the node while they search counts as refusing them', () => {
    const { sim, station, id, insp } = inspected();
    run(sim, 6000, phaseIs(sim, id, 'search'));
    const navy = reputationOf(sim.story, 'navy');
    abortInspections(sim);
    expect(sim.world.has(id, InspectionC)).toBe(false);
    expect(insp.crew.some((c) => sim.world.has(c, PositionC))).toBe(false);
    expect(reputationOf(sim.story, 'navy')).toBeLessThan(navy);
    expect(sim.world.get(station, TraderC)!.barredUntil).toBe(sim.galaxy.turn + INSPECT_BAN_TURNS);
  });

  it('a save in the middle of the search loads and carries on', () => {
    const { sim, id } = inspected();
    run(sim, 6000, () => (sim.world.get(id, InspectionC)?.jobs.length ?? 0) > 0);
    const back = deserialize(serialize(sim), content);
    expect(serialize(back)).toBe(serialize(sim));
    run(back, 6000, phaseIs(back, id, 'settle'));
    expect(back.world.get(id, InspectionC)!.found).toEqual([{ item: STOLEN, count: 10 }]);
  });

  it('more contraband than their hold takes: the hold is filled, the rest impounded where it lies, each unit counted once; a bribe hands it all back', () => {
    const { sim, id, insp } = inspected(60);
    run(sim, 8000, phaseIs(sim, id, 'settle'));
    expect(insp.phase).toBe('settle');
    const hold = content.vehicles['vehicle.shuttle']!.cargo!;
    expect(sim.world.get(id, VehicleC)!.cargo).toEqual([{ item: STOLEN, count: hold }]);
    expect(insp.impounded).toEqual([{ item: STOLEN, count: 60 - hold }]);
    expect(insp.found).toEqual([{ item: STOLEN, count: 60 }]);
    expect(insp.value).toBe(60 * content.items[STOLEN].price);
    expect(contrabandAboard(sim)).toEqual([]);
    sim.trade.credits = insp.bribe! + 5;
    rollBribe(sim, true);
    sim.enqueue({ type: 'inspect.settle', inspection: id, choice: 'bribe' });
    run(sim, 1);
    expect(contrabandAboard(sim)).toEqual([{ item: STOLEN, count: 60 }]);
  });
});
