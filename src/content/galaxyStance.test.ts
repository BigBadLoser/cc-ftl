import { describe, expect, it } from 'vitest';
import { cachedWorld } from '../../test/support/world';
import { stepCoarse } from '../sim/galaxy/coarse';
import { sectorOwners, simulatedSectors } from '../sim/galaxy/control';
import { wouldFight } from '../sim/galaxy/clash';
import { fightPressure } from '../sim/galaxy/pressure';
import { atWar, baselineStance, mayChange, pairKey, stanceOf } from '../sim/galaxy/relations';
import { ensureChunk, galaxyIndex, START_NODE } from '../sim/galaxy/state';
import { COARSE_TURNS, SIM_RING } from '../sim/galaxy/tuningCoarse';
import { STANCE_COOLDOWN, STANCE_EPS, STANCE_PER_TICK } from '../sim/galaxy/tuningStance';
import { warmGalaxy } from '../sim/galaxy/warmup';
import { strain } from '../sim/galaxy/war';
import type { Fleet } from '../sim/galaxy/types';
import { newGame } from '../sim/newGame';
import { deserialize, serialize } from '../sim/save';
import type { Sim } from '../sim/sim';
import { content } from '.';

/** A world with the area around the start generated (11 x 11 chunks), no warm-up. */
function world(): Sim {
  const sim = newGame(3, content);
  for (let cy = -SIM_RING; cy <= SIM_RING; cy++) for (let cx = -SIM_RING; cx <= SIM_RING; cx++) ensureChunk(sim, cx, cy);
  return sim;
}
const base = (): Sim => cachedWorld('stance.world', world);
const galaxyOf = (sim: Sim): NonNullable<Sim['content']['galaxy']> => sim.content.galaxy as NonNullable<Sim['content']['galaxy']>;
const ids = (sim: Sim): string[] => Object.keys(galaxyOf(sim).factions).sort();
const stances = (sim: Sim): Record<string, string> => Object.fromEntries(ids(sim).flatMap((a) => ids(sim).filter((b) => a < b).map((b) => [`${a}|${b}`, stanceOf(sim, a, b)])));

/** Run `ticks` coarse ticks from tick `from`, recording each tick's stance changes. */
function play(sim: Sim, from: number, ticks: number): { tick: number; pair: string; to: string }[] {
  const changes: { tick: number; pair: string; to: string }[] = [];
  let before = stances(sim);
  for (let n = from; n < from + ticks; n++) {
    sim.galaxy.turn = n * COARSE_TURNS;
    stepCoarse(sim, sim.galaxy.turn);
    const after = stances(sim);
    for (const [pair, s] of Object.entries(after)) if (before[pair] !== s) changes.push({ tick: n, pair, to: s });
    before = after;
  }
  return changes;
}

describe('the stance of a pair: the table is the baseline, the saved state the difference', () => {
  it('reads the table until something moves it', () => {
    const sim = base();
    expect(sim.galaxy.war).toEqual({});
    for (const a of ids(sim)) for (const b of ids(sim)) expect(stanceOf(sim, a, b), `${a} ${b}`).toBe(baselineStance(galaxyOf(sim), a, b));
    expect(atWar(sim, 'navy', 'pirates')).toBe(true);
    expect(atWar(sim, 'meridian', 'helix')).toBe(true);
    expect(atWar(sim, 'helix', 'vantor')).toBe(false);
    expect(atWar(sim, 'navy', 'navy')).toBe(false);
  });

  it('is what every reader asks: a changed stance moves fleets, and a fixed pair does not move', () => {
    const sim = base();
    const fleet = (faction: string): Fleet => ({ ...sim.galaxy.fleets.find((f) => f.role === 'patrol') as Fleet, faction, role: 'patrol' });
    expect(wouldFight(sim, fleet('navy'), fleet('meridian'))).toBe(false);
    sim.galaxy.war[pairKey('navy', 'meridian')] = { stance: 'war', since: -8, tired: 0, heat: 0 };
    expect(atWar(sim, 'meridian', 'navy')).toBe(true);
    expect(wouldFight(sim, fleet('navy'), fleet('meridian'))).toBe(true);
    // The navy and the pirates are fixed at war, the zealots and the rogue AI allied: an entry for them changes nothing.
    sim.galaxy.war[pairKey('navy', 'pirates')] = { stance: 'neutral', since: -8, tired: 0, heat: 0 };
    sim.galaxy.war[pairKey('zealots', 'rogue')] = { stance: 'war', since: -8, tired: 0, heat: 0 };
    expect(atWar(sim, 'navy', 'pirates')).toBe(true);
    expect(stanceOf(sim, 'zealots', 'rogue')).toBe('allied');
    expect(mayChange(galaxyOf(sim), 'navy', 'pirates')).toBe(false);
    expect(mayChange(galaxyOf(sim), 'navy', 'meridian')).toBe(true);
    expect(mayChange(galaxyOf(sim), 'rogue', 'meridian')).toBe(false);
  });

  it('fights wear a war down and heat the border; a fixed pair feels nothing', () => {
    const sim = base();
    strain(sim, 'meridian', 'helix', 1, 3);
    const war = sim.galaxy.war[pairKey('meridian', 'helix')];
    expect(war?.tired).toBeGreaterThan(0);
    expect(war?.heat).toBeGreaterThan(0);
    strain(sim, 'helix', 'vantor', 0, 5);
    const peace = sim.galaxy.war[pairKey('helix', 'vantor')];
    expect(peace?.tired).toBe(0);
    expect(peace?.heat).toBeGreaterThan(0);
    strain(sim, 'navy', 'pirates', 1, 5);
    expect(sim.galaxy.war[pairKey('navy', 'pirates')]).toBeUndefined();
    const before = sim.galaxy.war[pairKey('meridian', 'helix')]?.tired ?? 0;
    fightPressure(sim, START_NODE, 'meridian', 'helix', 2, false);
    expect(sim.galaxy.war[pairKey('meridian', 'helix')]?.tired).toBeGreaterThan(before);
  });
});

describe('wars start and end on the coarse tick', () => {
  const run = (): { sim: Sim; changes: ReturnType<typeof play> } => {
    const sim = base();
    return { sim, changes: play(sim, 1, 400) };
  };

  it('moves wars now and then, never twice in a tick, and rests a pair after a change', () => {
    const { sim, changes } = run();
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.some((c) => c.to === 'war')).toBe(true);
    expect(changes.some((c) => c.to !== 'war')).toBe(true);
    const perTick = new Map<number, number>();
    const last = new Map<string, number>();
    for (const c of changes) {
      perTick.set(c.tick, (perTick.get(c.tick) ?? 0) + 1);
      expect(c.tick - (last.get(c.pair) ?? -Infinity), c.pair).toBeGreaterThanOrEqual(STANCE_COOLDOWN);
      last.set(c.pair, c.tick);
    }
    expect(Math.max(...perTick.values())).toBeLessThanOrEqual(STANCE_PER_TICK);
    // A handful per day of play (60 ticks a day): not churn.
    expect(changes.length / (400 / 60)).toBeLessThan(10);
    const news = sim.galaxy.news.filter((n) => n.kind === 'war' || n.kind === 'peace');
    expect(news.length).toBeGreaterThan(0);
    expect(news.every((n) => n.faction && n.foeFaction)).toBe(true);
  });

  it('never moves a fixed pair', () => {
    const { sim, changes } = run();
    for (const c of changes) {
      const [a, b] = c.pair.split('|') as [string, string];
      expect(mayChange(galaxyOf(sim), a, b), c.pair).toBe(true);
    }
    expect(atWar(sim, 'navy', 'pirates')).toBe(true);
    expect(stanceOf(sim, 'zealots', 'rogue')).toBe('allied');
  });

  it('keeps only what differs: entries say something the table does not', () => {
    const { sim } = run();
    const now = sim.galaxy.turn;
    for (const [key, e] of Object.entries(sim.galaxy.war)) {
      const [a, b] = key.split('|') as [string, string];
      const rested = e.since === 0 || now - e.since >= STANCE_COOLDOWN * COARSE_TURNS;
      expect(e.stance !== baselineStance(galaxyOf(sim), a, b) || e.tired >= STANCE_EPS || e.heat >= STANCE_EPS || !rested, key).toBe(true);
    }
  });

  it('is deterministic and survives a save', () => {
    const a = run().sim;
    const b = run().sim;
    expect(a.galaxy.war).toEqual(b.galaxy.war);
    const back = deserialize(serialize(a), content);
    expect(back.galaxy.war).toEqual(a.galaxy.war);
    expect(stances(back)).toEqual(stances(a));
    expect(play(back, 401, 30)).toEqual(play(a, 401, 30));
  });
});

describe('the simulated area and the warm-up', () => {
  it('is a function of where the player is, not of where they have been', () => {
    const a = base();
    const b = base();
    for (let cy = 6; cy <= 9; cy++) for (let cx = -3; cx <= 3; cx++) ensureChunk(b, cx, cy);
    expect([...simulatedSectors(b)].sort()).toEqual([...simulatedSectors(a)].sort());
    expect(galaxyIndex(b.galaxy).sectors.size).toBeGreaterThan(galaxyIndex(a.galaxy).sectors.size);
  });

  it('is generated by the coarse tick when the player has moved on', () => {
    const sim = newGame(3, content);
    expect(Object.keys(sim.galaxy.chunks).length).toBe(9);
    stepCoarse(sim, COARSE_TURNS);
    expect(Object.keys(sim.galaxy.chunks).length).toBe((2 * SIM_RING + 1) ** 2);
  });

  it('warms a new game: borders have moved, the log is clean, the clock is at zero, and it is the same every time', () => {
    const a = newGame(3, content);
    warmGalaxy(a, 120);
    const b = newGame(3, content);
    warmGalaxy(b, 120);
    expect(serialize(a)).toBe(serialize(b));
    expect(a.galaxy.turn).toBe(0);
    expect(a.galaxy.news).toEqual([]);
    const moved = [...sectorOwners(a)].filter(([id, o]) => galaxyIndex(a.galaxy).sectors.get(id)?.genFaction !== o);
    expect(moved.length).toBeGreaterThan(0);
    for (const c of Object.values(a.galaxy.control)) expect(c.since).toBeLessThanOrEqual(0);
    // Nothing is owed in the future: history ends at the first turn.
    expect(Math.max(0, ...Object.values(a.galaxy.ports).map((p) => p.next))).toBeLessThanOrEqual(a.galaxy.turn + 60);
  });
});
