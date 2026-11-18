import { describe, expect, it } from 'vitest';
import { CombatC, ShipC } from '../sim/combat/components';
import { TraderC } from '../sim/trade/types';
import { galaxyIndex } from '../sim/galaxy/state';
import { newGame } from '../sim/newGame';
import { storageAdd } from '../sim/items/storage';
import { type Sim } from '../sim/sim';
import { InspectionC } from '../sim/inspect/types';
import { liveInspection } from '../sim/inspect/start';
import { inspectorsAboard } from '../sim/inspect/aboard';
import { jumpWarnings } from '../sim/sector/members';
import { AllegianceC } from '../sim/fight/components';
import { playerStorages } from '../sim/story/world';
import { reputationOf } from '../sim/story/state';
import { FTL_CHARGE_SEC } from '../sim/tuning';
import { INSPECT_FIGHT_HIT } from '../sim/blackmarket/tuning';
import { content } from './index';

/**
 * #541: a jump queued with "Charge and jump" fired on its own once the drive was full, with a navy inspection party searching the ship. Leaving with
 * inspectors aboard counts as attacking them, so the player arrived at the next node with two hostile inspectors aboard and the navy hostile (#542).
 */

function run(sim: Sim, n: number, until?: () => boolean): string[] {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `${e.type}:${e.command}:${e.reason}` : e.type);
    if (until?.()) break;
  }
  return log;
}

/** A new game beside a navy station with contraband in the hold, its inspectors searching the player's ship. */
function searched(): { sim: Sim; ship: number; insp: number; next: string } {
  const sim = newGame(3, content);
  run(sim, 20);
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
  run(sim, 1);
  const station = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
  sim.world.get(station, TraderC)!.owner = 'navy';
  storageAdd(sim, playerStorages(sim)[0]!, 'item.stolen_goods', 10);
  sim.enqueue({ type: 'trade.hail', ship: station });
  run(sim, 1);
  const insp = liveInspection(sim)![0];
  const ship = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.faction === 'player')!;
  run(sim, 6000, () => sim.world.get(insp, InspectionC)?.phase === 'search');
  const here = sim.galaxy.current;
  const e = galaxyIndex(sim.galaxy).adjacent.get(here)![0]!;
  return { sim, ship, insp, next: e.a === here ? e.b : e.a };
}

describe('inspectors aboard when the ship leaves (#541)', () => {
  it('the jump warning names them; before they board it does not', () => {
    const sim = newGame(3, content);
    const ship = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.faction === 'player')!;
    expect(jumpWarnings(sim, ship).inspectors).toEqual([]);
    const s = searched();
    const aboard = inspectorsAboard(s.sim, s.ship);
    expect(aboard.length).toBeGreaterThan(0);
    expect(jumpWarnings(s.sim, s.ship).inspectors).toEqual(aboard);
  });

  it('a queued jump that comes due with inspectors aboard is called off: no fight, no standing lost, the search goes on', () => {
    const { sim, ship, insp, next } = searched();
    const navy = reputationOf(sim.story, 'navy');
    sim.world.get(ship, CombatC)!.ftl = FTL_CHARGE_SEC;
    sim.enqueue({ type: 'ftl.charge', ship, jump: [next] });
    const log = run(sim, 40);
    expect(log).toContain('command.rejected:ftl.charge:inspectorsAboard');
    expect(sim.sector.state).toBe('active');
    expect(sim.world.get(ship, CombatC)!.ftlOrder).toBeNull();
    expect(reputationOf(sim.story, 'navy')).toBe(navy);
    expect(sim.world.get(insp, InspectionC)?.phase).toBe('search');
    for (const c of inspectorsAboard(sim, ship)) expect(sim.world.get(c, AllegianceC)!.faction).not.toBe('hostile');
  });

  it('a jump the player commits still carries them off, as the #138 ruling has it', () => {
    const { sim, ship, next } = searched();
    const navy = reputationOf(sim.story, 'navy');
    sim.world.get(ship, CombatC)!.ftl = FTL_CHARGE_SEC;
    sim.enqueue({ type: 'galaxy.jump', ship, route: [next] });
    const log = run(sim, 2);
    expect(log).toContain('inspect.fought');
    expect(sim.sector.state).toBe('hyperspace');
    expect(reputationOf(sim.story, 'navy')).toBe(navy - INSPECT_FIGHT_HIT);
  });
});
