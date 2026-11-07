import { describe, expect, it } from 'vitest';
import { CrewC, MoodC, PositionC, PrioritiesC, newGame, type Sim } from '../sim';
import { ConsentC } from '../sim/consent/components';
import { RolledSkillsC } from '../sim/crew/traits';
import { AllegianceC } from '../sim/fight/components';
import { nodesWithin } from '../sim/galaxy/graph';
import { carryOf, JOIN_HAPPY_SEC, JOIN_WAIT_SEC } from '../sim/galaxy/joinOffer';
import { portsAt } from '../sim/galaxy/portIndex';
import { placementGapError } from '../sim/regions';
import { playerCrew } from '../sim/story/world';
import { playerShip } from '../sim/trade/player';
import { content } from '.';

/** A passenger asks to join (#173 step 6, slice 5): on delivery, or while aboard after a good stretch; once per person. */

type Seen = { asks: number[]; sent: number; joined: number[] };
const step = (sim: Sim, seen: Seen, n = 1): void => {
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) {
      if (e.type === 'crew.asksToJoin') seen.asks.push(e.crew);
      if (e.type === 'job.shuttleSent') seen.sent++;
      if (e.type === 'crew.joined') seen.joined.push(e.crew);
    }
  }
};
const fresh = (): Seen => ({ asks: [], sent: 0, joined: [] });

function aboard(seed: number): { sim: Sim; crew: number; seen: Seen } {
  const sim = newGame(seed, content);
  sim.story.goals.skipped = true;
  sim.galaxy.fleets = [];
  let faction = '';
  for (const [node, hops] of nodesWithin(sim, sim.galaxy.current, 3)) {
    const p = hops >= 1 ? portsAt(sim, node).find((x) => ['station', 'depot', 'den'].includes(x.kind) && x.owner !== 'pirates') : undefined;
    if (p) { faction = p.owner; break; }
  }
  const ship = playerShip(sim);
  const at = sim.world.get(playerCrew(sim)[0]!, PositionC)!;
  const before = new Set(sim.world.query(CrewC));
  sim.enqueue({ type: 'debug.spawnCrew', ship, x: at.x, y: at.y, role: 'role.pilot', faction: 'neutral', lodge: true });
  sim.step();
  const crew = sim.world.query(CrewC).find((c) => !before.has(c))!;
  sim.world.get(ship, ConsentC)!.grants.find((x) => x.crew?.includes(crew))!.carry = { event: 'event.medical_emergency', origin: faction, purse: 80, fired: [] };
  sim.events.drain();
  const seen = fresh();
  step(sim, seen, 40);
  return { sim, crew, seen };
}

function visit(sim: Sim, seen: Seen, node: string): void {
  sim.enqueue({ type: 'debug.galaxyTeleport', node });
  step(sim, seen);
  const p = sim.sector.packet!;
  for (let x = 0; x + p.w <= sim.sector.width && sim.sector.state !== 'active'; x += 4) {
    for (let y = 2; y + p.h <= sim.sector.height; y += 4) {
      if (placementGapError(sim, { x, y, w: p.w, h: p.h })) continue;
      sim.enqueue({ type: 'sector.deploy', x, y });
      step(sim, seen);
      break;
    }
  }
}

/** Accepted passage, flown to the destination: they ask there. */
function atDestination(seed: number): { sim: Sim; crew: number; seen: Seen; job: number } {
  const { sim, crew, seen } = aboard(seed);
  const c = sim.galaxy.posted![0]!;
  sim.enqueue({ type: 'jobs.accept', key: c.key });
  step(sim, seen);
  carryOf(sim, crew)!.rolled = true; // no ask on the way (that is the other test)
  visit(sim, seen, c.to!);
  step(sim, seen, 60);
  return { sim, crew, seen, job: c.id };
}

describe('a passenger asks to join', () => {
  it('on delivery: the handover waits; yes makes them crew with their own skills, the passage closed with no fare', () => {
    const { sim, crew, seen, job } = atDestination(7);
    expect(seen.asks).toEqual([crew]);
    expect(seen.sent).toBe(0);
    const skills = JSON.stringify(sim.world.get(crew, RolledSkillsC));
    const credits = sim.trade.credits;
    sim.enqueue({ type: 'jobs.join', crew, accept: true });
    step(sim, seen, 60);
    expect(seen.joined).toEqual([crew]);
    expect(sim.world.get(crew, AllegianceC)?.faction).toBe('player');
    expect(JSON.stringify(sim.world.get(crew, RolledSkillsC))).toBe(skills);
    expect(sim.world.get(crew, PrioritiesC)).toEqual(content.roles['role.pilot']!.priorities);
    expect(sim.galaxy.jobs.some((j) => j.id === job)).toBe(false);
    expect(sim.trade.credits).toBe(credits);
    expect(carryOf(sim, crew)).toBeUndefined();
    expect(playerCrew(sim)).toContain(crew);
  });

  it('on delivery, no: the handover goes on and they are delivered, never asked again', () => {
    const { sim, crew, seen } = atDestination(7);
    sim.enqueue({ type: 'jobs.join', crew, accept: false });
    for (let i = 0; i < 20 * 400 && sim.world.has(crew, CrewC); i++) step(sim, seen);
    expect(sim.world.has(crew, CrewC)).toBe(false);
    expect(seen.sent).toBeGreaterThan(0);
    expect(seen.asks).toEqual([crew]);
  });

  it('left unanswered, the ask lapses as a no', () => {
    const { sim, crew, seen } = atDestination(7);
    step(sim, seen, 20 * (JOIN_WAIT_SEC + 2));
    expect(carryOf(sim, crew)?.asking ?? undefined).toBeUndefined();
    expect(seen.sent).toBeGreaterThan(0);
  });

  it('aboard, after a long good mood: one seeded roll, at most one ask per person', () => {
    let asked = 0;
    for (const seed of [7, 8, 9, 10, 11, 12]) {
      const { sim, crew, seen } = aboard(seed);
      const c = carryOf(sim, crew)!;
      c.happySince = sim.tick - JOIN_HAPPY_SEC * 20;
      for (let i = 0; i < 40; i++) {
        sim.world.get(crew, MoodC)!.value = 90; // a good stretch (the mood system recomputes it now and then)
        step(sim, seen);
      }
      expect(c.rolled).toBe(true);
      if (seen.asks.length) {
        asked++;
        sim.enqueue({ type: 'jobs.join', crew, accept: false });
        step(sim, seen, 200);
        expect(seen.asks).toEqual([crew]);
      }
    }
    expect(asked).toBeGreaterThan(0);
    expect(asked).toBeLessThan(6);
  });
});
