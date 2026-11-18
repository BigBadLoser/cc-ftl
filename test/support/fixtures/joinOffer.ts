/** Shared setups of the join-offer tests (#173 step 6, slice 5) and their slow tier: a guest aboard who carries an offer, and the same flown to the destination. */
import { MoodC, CrewC, PositionC } from '../../../src/sim/crew/components';
import { ConsentC } from '../../../src/sim/consent/components';
import { nodesWithin } from '../../../src/sim/galaxy/graph';
import { carryOf } from '../../../src/sim/galaxy/joinOffer';
import { portsAt } from '../../../src/sim/galaxy/portIndex';
import { newGame } from '../../../src/sim/newGame';
import { placementGapError } from '../../../src/sim/regions';
import type { Sim } from '../../../src/sim/sim';
import { playerCrew } from '../../../src/sim/story/world';
import { playerShip } from '../../../src/sim/trade/player';
import { content } from '../content';
import { fileCache } from '../cache';
import { cachedWorld } from '../world';

export type Seen = { asks: number[]; sent: number; joined: number[]; mood?: { crew: number; value: number } };
export const step = (sim: Sim, seen: Seen, n = 1): void => {
  for (let i = 0; i < n; i++) {
    // A passenger's mood held where the test wants it (the mood system recomputes it now and then).
    const m = seen.mood && sim.world.get(seen.mood.crew, MoodC);
    if (m && seen.mood) m.value = seen.mood.value;
    sim.step();
    for (const e of sim.events.drain()) {
      if (e.type === 'crew.asksToJoin') seen.asks.push(e.crew);
      if (e.type === 'job.shuttleSent') seen.sent++;
      if (e.type === 'crew.joined') seen.joined.push(e.crew);
    }
  }
};
const fresh = (): Seen => ({ asks: [], sent: 0, joined: [] });

function aboardFresh(seed: number): { sim: Sim; crew: number; seen: Seen } {
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

/** Accepted passage, flown to the destination (`glad`: in a good mood, so they ask there). */
function atDestinationFresh(seed: number, glad: boolean): { sim: Sim; crew: number; seen: Seen; job: number } {
  const { sim, crew, seen } = aboardFresh(seed);
  seen.mood = { crew, value: glad ? 90 : 40 };
  const c = sim.galaxy.posted![0]!;
  sim.enqueue({ type: 'jobs.accept', key: c.key });
  step(sim, seen);
  carryOf(sim, crew)!.rolled = true; // no ask on the way (that is the other test)
  visit(sim, seen, c.to!);
  step(sim, seen, 60);
  return { sim, crew, seen, job: c.id };
}

/** What a cached build leaves beside the saved world: the test's own tally of events (`Seen`) and the ids it found. */
const extras = fileCache<string, { seen: Seen; crew: number; job: number }>();
function cached<T extends { sim: Sim; crew: number; seen: Seen; job?: number }>(key: string, build: () => T): { sim: Sim; crew: number; seen: Seen; job: number } {
  const sim = cachedWorld(key, () => {
    const b = build();
    extras.set(key, { seen: structuredClone(b.seen), crew: b.crew, job: b.job ?? 0 });
    return b.sim;
  });
  const e = extras.get(key)!;
  return { sim, crew: e.crew, seen: structuredClone(e.seen), job: e.job };
}
/** A passenger aboard, the starter game with a lodged guest who carries an offer (built once per seed and file). */
export const aboard = (seed: number): { sim: Sim; crew: number; seen: Seen } => cached(`join:aboard:${seed}`, () => aboardFresh(seed));
/** Accepted passage, flown to the destination (`glad`: in a good mood, so they ask there); built once per seed and file. */
export const atDestination = (seed: number, glad = true): { sim: Sim; crew: number; seen: Seen; job: number } => cached(`join:dest:${seed}:${glad}`, () => atDestinationFresh(seed, glad));

