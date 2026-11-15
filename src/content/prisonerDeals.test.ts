import { describe, expect, it } from 'vitest';
import { AllegianceC, CrewC, NeedsC, PositionC, ShipC, newGame, placementError, playerShip, spawnModule, type Sim, type SimEvent } from '../sim';
import { heldPrisoners, handOverPrisoner, prisonerOffer, prisonerWorth } from '../sim/capture/offers';
import { PRISONER_DEALS } from '../sim/capture/tuning';
import { PrisonerC } from '../sim/fight/components';
import { repKey } from '../sim/galaxy/standing';
import { SLOT_EMPTY, StasisWheelC } from '../sim/stasis/components';
import { sealPrisoner, stowSlab } from '../sim/stasis/freeze';
import { reputationOf } from '../sim/story/state';
import { playerCrew } from '../sim/story/world';
import { TraderC } from '../sim/trade/types';
import { footprintBlockedByCrew } from '../sim/modules/spawn';
import { content } from '.';

/** Prisoner deals at stations (#116): ransom, bounty, black market; only a sealed slab aboard a ship of the player's (not a prize) is handed over. */

const step = (sim: Sim, n = 1): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};

function wheelOn(sim: Sim): number {
  const ship = playerShip(sim)!;
  const s = sim.world.get(ship, ShipC)!;
  for (let y = s.y; y < s.y + s.height; y++) {
    for (let x = s.x; x < s.x + s.width; x++) {
      if (placementError(sim, ship, 'module.stasis_wheel', x, y, 0) === null && !footprintBlockedByCrew(sim, ship, 'module.stasis_wheel', x, y, 0)) return spawnModule(sim, 'module.stasis_wheel', x, y, 0);
    }
  }
  throw new Error('no room for a wheel');
}

/** The starter game with a station owned by `owner` and one prisoner taken from `from`, frozen in a wheel at home unless `sealed` is false. */
function game(owner: string, from: string, sealed = true, kind = 'station.trading'): { sim: Sim; station: number; prisoner: number; wheel: number } {
  const sim = newGame(3, content);
  step(sim, 2);
  for (const c of playerCrew(sim)) Object.assign(sim.world.get(c, NeedsC)!, { hunger: 100, rest: 100 });
  sim.enqueue({ type: 'debug.spawnStation', kind, size: 'outpost', seed: 4, owner });
  const at = sim.world.get(playerCrew(sim)[0]!, PositionC)!;
  sim.enqueue({ type: 'debug.spawnCrew', ship: playerShip(sim)!, x: at.x, y: at.y, role: 'role.security', faction: 'hostile' });
  step(sim);
  const wheel = wheelOn(sim);
  const station = sim.world.query(TraderC).find((id) => sim.world.get(id, TraderC)?.station)!;
  const prisoner = sim.world.query(CrewC).find((id) => sim.world.get(id, AllegianceC)?.faction === 'hostile')!;
  sim.enqueue({ type: 'debug.imprison', crew: prisoner });
  step(sim);
  sim.world.get(prisoner, PrisonerC)!.from = from;
  if (sealed) {
    sealPrisoner(sim, prisoner, playerCrew(sim)[0]!);
    stowSlab(sim, prisoner, wheel);
  }
  return { sim, station, prisoner, wheel };
}

describe('prisoner deals at stations', () => {
  it('a station of their own faction ransoms them: credits by their worth, standing with that faction', () => {
    const { sim, station, prisoner, wheel } = game('navy', 'navy');
    expect(heldPrisoners(sim)).toEqual([prisoner]);
    const offer = prisonerOffer(sim, station, prisoner);
    const credits = PRISONER_DEALS.ransom.base + PRISONER_DEALS.ransom.perLevel * prisonerWorth(sim, prisoner);
    expect(offer).toEqual({ ok: true, kind: 'ransom', credits, faction: 'navy', standing: PRISONER_DEALS.ransom.standing });
    const before = { credits: sim.trade.credits, rep: reputationOf(sim.story, repKey(sim, 'navy')) };
    sim.enqueue({ type: 'prisoner.handOver', crew: prisoner, station });
    const ev = step(sim);
    expect(ev.find((e) => e.type === 'prisoner.handedOver')).toMatchObject({ crew: prisoner, kind: 'ransom', credits });
    expect(sim.trade.credits).toBe(before.credits + credits);
    expect(reputationOf(sim.story, repKey(sim, 'navy'))).toBe(before.rep + PRISONER_DEALS.ransom.standing);
    expect(sim.world.has(prisoner, CrewC)).toBe(false);
    expect(sim.world.get(wheel, StasisWheelC)!.slots.filter((s) => s === SLOT_EMPTY)).toHaveLength(10); // the empty slab stays in the wheel
  });

  it('a navy station pays a bounty for a pirate, and refuses anyone else\'s', () => {
    const { sim, station, prisoner } = game('navy', 'raiders');
    expect(prisonerOffer(sim, station, prisoner)).toMatchObject({ ok: true, kind: 'bounty', faction: 'navy' });
    sim.world.get(prisoner, PrisonerC)!.from = 'meridian';
    expect(prisonerOffer(sim, station, prisoner)).toEqual({ ok: false, reason: 'noBuyer' });
  });

  it('a pirate at a station that pays no bounty is refused noBounty', () => {
    const { sim, station, prisoner } = game('pirates', 'raiders');
    expect(prisonerOffer(sim, station, prisoner)).toMatchObject({ ok: false, reason: 'noBounty' });
  });

  it('a black market takes anyone, for its owner\'s standing', () => {
    const { sim, station, prisoner } = game('pirates', 'navy');
    sim.world.get(station, TraderC)!.services = ['bm.lesser'];
    expect(prisonerOffer(sim, station, prisoner)).toMatchObject({ ok: true, kind: 'market', faction: 'pirates' });
  });

  it('only a sealed slab is handed over: an unsealed prisoner is refused with the deal they would get', () => {
    const { sim, station, prisoner } = game('navy', 'navy', false);
    expect(prisonerOffer(sim, station, prisoner)).toMatchObject({ ok: false, reason: 'notSealed', kind: 'ransom' });
    sim.enqueue({ type: 'prisoner.handOver', crew: prisoner, station });
    expect(step(sim).find((e) => e.type === 'command.rejected')).toMatchObject({ command: 'prisoner.handOver', reason: 'notSealed' });
    expect(sim.world.has(prisoner, CrewC)).toBe(true);
    expect(handOverPrisoner(sim, prisoner, 0)).toBe('notStation');
  });
});
