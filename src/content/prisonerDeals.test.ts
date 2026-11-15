import { describe, expect, it } from 'vitest';
import { AllegianceC, CrewC, NeedsC, PositionC, ShipC, newGame, placementError, playerShip, spawnModule, type Sim, type SimEvent } from '../sim';
import { heldPrisoners, handOverPrisoner, prisonerOffer, prisonerWorth, stationWants } from '../sim/capture/offers';
import { PRISONER_DEALS } from '../sim/capture/tuning';
import { PrisonerC } from '../sim/fight/components';
import { repKey } from '../sim/galaxy/standing';
import { SLOT_EMPTY, SLOT_NONE, StasisWheelC } from '../sim/stasis/components';
import { stowStage } from '../sim/stasis/query';
import { stasisRoom } from '../sim/stasis/jobs';
import { TURN_STEP_WORK, UNSTOW_LIFT, UNSTOW_WORK } from '../sim/stasis/tuning';
import { sealPrisoner, stowSlab } from '../sim/stasis/freeze';
import { reputationOf } from '../sim/story/state';
import { playerCrew } from '../sim/story/world';
import { TraderC } from '../sim/trade/types';
import { footprintBlockedByCrew } from '../sim/modules/spawn';
import { content } from '.';
import { prisonerRun } from '../sim/capture/delivery';
import { StasisC } from '../sim/stasis/components';
import { thawPrisoner } from '../sim/stasis/freeze';
import { TICK_HZ } from '../sim/time';
import type { Deal } from '../sim/trade/types';
import { VehicleC } from '../sim/vehicles/components';
import { deserialize, serialize } from '../sim/save';

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
    const { sim, station, prisoner } = game('navy', 'navy');
    expect(heldPrisoners(sim)).toEqual([prisoner]);
    const credits = PRISONER_DEALS.ransom.base + PRISONER_DEALS.ransom.perLevel * prisonerWorth(sim, prisoner);
    expect(prisonerOffer(sim, station, prisoner)).toEqual({ ok: true, kind: 'ransom', credits, faction: 'navy', standing: PRISONER_DEALS.ransom.standing });
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

/** Step until `ok` holds, at most `sec` game seconds; the events seen on the way. */
function until(sim: Sim, ok: () => boolean, sec: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < sec * TICK_HZ && !ok(); i++) out.push(...step(sim));
  expect(ok()).toBe(true);
  return out;
}

/** Accept the station's offer: the run it opened. */
function accept(sim: Sim, station: number, prisoner: number): Deal {
  sim.enqueue({ type: 'prisoner.handOver', crew: prisoner, station });
  const ev = step(sim);
  expect(ev.find((e) => e.type === 'command.rejected')).toBeUndefined();
  expect(ev.find((e) => e.type === 'prisoner.collecting')).toMatchObject({ crew: prisoner, station });
  return prisonerRun(sim, prisoner)!;
}

const inShuttle = (sim: Sim, prisoner: number): boolean => sim.world.get(prisoner, StasisC)?.at === 'vehicle';
const failed = (ev: SimEvent[]): string | undefined => (ev.find((e) => e.type === 'trade.failed') as { reason?: string } | undefined)?.reason;

describe('prisoner deals: the slab is delivered for real', () => {
  it('your shuttle takes the slab over: nothing is paid at the click, all of it when the slab reaches the station', () => {
    const { sim, station, prisoner, wheel } = game('navy', 'navy');
    const credits = PRISONER_DEALS.ransom.base + PRISONER_DEALS.ransom.perLevel * prisonerWorth(sim, prisoner);
    const before = { credits: sim.trade.credits, rep: reputationOf(sim.story, repKey(sim, 'navy')) };
    const run = accept(sim, station, prisoner);
    expect(run.handover).toMatchObject({ via: 'own', prisoner: { crew: prisoner, credits, kind: 'ransom' } });
    expect(sim.trade.credits).toBe(before.credits);
    expect(prisonerOffer(sim, station, prisoner)).toMatchObject({ ok: false, reason: 'underWay', run: { deal: run.id, stage: 'collecting', cancel: true } });
    until(sim, () => inShuttle(sim, prisoner), 120); // crew take it out of the wheel and cart it into the shuttle
    expect(sim.world.get(wheel, StasisWheelC)!.slots).not.toContain(prisoner);
    until(sim, () => run.phase === 'out', 30);
    expect(prisonerOffer(sim, station, prisoner)).toMatchObject({ reason: 'underWay', run: { stage: 'toStation', cancel: false } });
    expect(sim.trade.credits).toBe(before.credits);
    sim.enqueue({ type: 'trade.cancel', id: run.id });
    expect(step(sim).find((e) => e.type === 'command.rejected')).toMatchObject({ command: 'trade.cancel', reason: 'inTransit' });
    const ev = until(sim, () => run.phase === 'done', 120);
    expect(ev.find((e) => e.type === 'prisoner.handedOver')).toMatchObject({ crew: prisoner, kind: 'ransom', credits, station });
    expect(sim.trade.credits).toBe(before.credits + credits);
    expect(reputationOf(sim.story, repKey(sim, 'navy'))).toBe(before.rep + PRISONER_DEALS.ransom.standing);
    expect(sim.world.has(prisoner, CrewC)).toBe(false);
    // The station keeps the slab: the wheel has nine empty slabs and one free slot.
    expect(sim.world.get(wheel, StasisWheelC)!.slots.filter((x) => x === SLOT_EMPTY)).toHaveLength(9);
  });

  it("a station with a shuttle of its own sends it, and pays once it is home with the slab", () => {
    const { sim, station, prisoner } = game('navy', 'navy');
    sim.world.get(station, TraderC)!.profile = 'trader.freighter'; // a trader kind that sends a shuttle
    const before = sim.trade.credits;
    const run = accept(sim, station, prisoner);
    expect(run.handover?.via).toBe('station');
    until(sim, () => inShuttle(sim, prisoner), 240);
    const shuttle = run.vehicle;
    until(sim, () => run.phase === 'out', 30);
    expect(sim.trade.credits).toBe(before);
    const ev = until(sim, () => run.phase === 'done', 240);
    expect(ev.some((e) => e.type === 'prisoner.handedOver')).toBe(true);
    expect(sim.world.get(shuttle, VehicleC)?.hover).toBe(station); // paid at its station
    expect(sim.trade.credits).toBeGreaterThan(before);
    step(sim, 2);
    expect(sim.world.has(shuttle, VehicleC)).toBe(false); // gone home, slab and all
    expect(ev.some((e) => e.type === 'stasis.lost')).toBe(false);
  });

  it('the wheel turns the slot to the hatch and the slab comes out over the unload (the load backwards), onto the cart before the hatch shuts', () => {
    const { sim, station, prisoner, wheel } = game('navy', 'navy');
    accept(sim, station, prisoner);
    until(sim, () => stowStage(sim.world, wheel)?.out === true, 120);
    const start = sim.tick;
    const turns = stowStage(sim.world, wheel)!.turns;
    expect(turns).toBeGreaterThan(0); // stowSlab left the prisoner one step past the hatch
    until(sim, () => sim.world.get(prisoner, StasisC)?.at === 'carried', 30);
    const lifted = sim.tick - start;
    expect(lifted).toBeGreaterThanOrEqual(turns * TURN_STEP_WORK + Math.floor(UNSTOW_LIFT * UNSTOW_WORK) - 2);
    expect(sim.world.get(wheel, StasisWheelC)!.slots[0]).toBe(SLOT_NONE); // the ring stands turned, the slot at the hatch emptied
    expect(stowStage(sim.world, wheel)).toMatchObject({ out: true, turns: 0 }); // the hatch still shutting
    until(sim, () => stowStage(sim.world, wheel) === null, 10);
    expect(sim.tick - start).toBeGreaterThanOrEqual(turns * TURN_STEP_WORK + UNSTOW_WORK - 2);
    expect(sim.world.get(prisoner, StasisC)?.at).toBe('carried');
  });

  it("a slab on its way out to a station takes no wheel room: neither on the cart nor in your shuttle's rack (not inbound)", () => {
    const { sim, station, prisoner, wheel } = game('navy', 'navy');
    const ship = playerShip(sim)!;
    const free = (): number => sim.world.get(wheel, StasisWheelC)!.slots.filter((x) => x <= 0).length;
    accept(sim, station, prisoner);
    until(sim, () => sim.world.get(prisoner, StasisC)?.at === 'carried', 120);
    expect(stasisRoom(sim, ship)).toBe(free());
    until(sim, () => inShuttle(sim, prisoner), 120);
    expect(stasisRoom(sim, ship)).toBe(free());
  });

  it('cancelled while collecting: the slab comes back out and goes back into a wheel, nothing paid', () => {
    const { sim, station, prisoner } = game('navy', 'navy');
    const before = sim.trade.credits;
    const run = accept(sim, station, prisoner);
    until(sim, () => inShuttle(sim, prisoner), 120);
    sim.enqueue({ type: 'trade.cancel', id: run.id });
    const ev = step(sim);
    expect(failed(ev)).toBe('cancelled');
    expect(sim.world.get(prisoner, StasisC)?.at).toBe('floor'); // set down by the airlock
    until(sim, () => sim.world.get(prisoner, StasisC)?.at === 'wheel', 120);
    expect(sim.trade.credits).toBe(before);
    expect(prisonerOffer(sim, station, prisoner).ok).toBe(true); // it can be accepted again
  });

  it('a fight calls the run off; the slab is never lost', () => {
    const { sim, station, prisoner } = game('navy', 'navy');
    const run = accept(sim, station, prisoner);
    until(sim, () => inShuttle(sim, prisoner), 120);
    sim.sector.inCombat = true; // read by the trade system before the combat state is worked out again this tick
    expect(failed(step(sim))).toBe('combat');
    expect(sim.world.has(prisoner, StasisC)).toBe(true);
    expect(run.phase).toBe('failed');
    until(sim, () => sim.world.get(prisoner, StasisC)?.at === 'wheel', 240);
  });

  it('a fight with the slab out in your shuttle: it flies home and sets the slab down by its bay', () => {
    const { sim, station, prisoner } = game('navy', 'navy');
    const run = accept(sim, station, prisoner);
    until(sim, () => run.phase === 'out', 180);
    step(sim, 20); // away from the airlock
    sim.sector.inCombat = true;
    expect(failed(step(sim))).toBe('combat');
    expect(inShuttle(sim, prisoner)).toBe(true); // rides home
    const ev = until(sim, () => !inShuttle(sim, prisoner), 240);
    expect(ev.some((e) => e.type === 'stasis.unloaded')).toBe(true);
    until(sim, () => sim.world.get(prisoner, StasisC)?.at === 'wheel', 240);
  });

  it('a prisoner who thaws before the hand-over calls it off; a shuttle lost with the slab loses them, logged', () => {
    const a = game('navy', 'navy');
    const run = accept(a.sim, a.station, a.prisoner);
    thawPrisoner(a.sim, a.prisoner);
    expect(failed(step(a.sim))).toBe('prisonerGone');
    expect(run.phase).toBe('failed');
    const b = game('navy', 'navy');
    const run2 = accept(b.sim, b.station, b.prisoner);
    until(b.sim, () => run2.phase === 'out', 180);
    const before = b.sim.trade.credits;
    b.sim.world.destroyEntity(run2.vehicle);
    const ev = step(b.sim, 2);
    expect(ev.find((e) => e.type === 'stasis.lost')).toMatchObject({ crew: b.prisoner });
    expect(failed(ev)).toBeDefined();
    expect(b.sim.trade.credits).toBe(before);
  });

  it('no shuttle at all: no deal is offered to accept, and the click is refused', () => {
    const { sim, station, prisoner } = game('navy', 'navy');
    for (const v of sim.world.query(VehicleC)) sim.world.destroyEntity(v);
    expect(prisonerOffer(sim, station, prisoner)).toMatchObject({ ok: false, reason: 'noWay', kind: 'ransom' });
    expect(handOverPrisoner(sim, prisoner, station)).toBe('noWay');
  });

  it('a save mid-delivery loads and the delivery finishes and pays', () => {
    const { sim, station, prisoner } = game('navy', 'navy');
    const run = accept(sim, station, prisoner);
    until(sim, () => inShuttle(sim, prisoner), 120);
    const back = deserialize(serialize(sim), content);
    const run2 = prisonerRun(back, prisoner)!;
    expect(run2.handover?.prisoner).toEqual(run.handover?.prisoner);
    const before = back.trade.credits;
    const ev = until(back, () => run2.phase === 'done', 240);
    expect(ev.some((e) => e.type === 'prisoner.handedOver')).toBe(true);
    expect(back.trade.credits).toBe(before + run.handover!.prisoner!.credits);
    // Saved while the crew were still loading: they carry on.
    const c = game('navy', 'navy');
    accept(c.sim, c.station, c.prisoner);
    step(c.sim, 30);
    const back2 = deserialize(serialize(c.sim), content);
    until(back2, () => !back2.world.has(c.prisoner, CrewC), 360);
  });
});

describe('prisoner deals: the Prisoners service', () => {
  it('shows only where this station has a deal for a prisoner held, ready or not', () => {
    const { sim, station, prisoner } = game('navy', 'meridian', false);
    expect(stationWants(sim, station, prisoner)).toBe(false); // nothing for a Meridian prisoner at a navy station
    sim.world.get(prisoner, PrisonerC)!.from = 'navy';
    expect(stationWants(sim, station, prisoner)).toBe(true); // a ransom once they are sealed
    expect(prisonerOffer(sim, station, prisoner).ok).toBe(false);
  });
});
