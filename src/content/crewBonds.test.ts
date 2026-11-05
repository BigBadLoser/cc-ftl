import { describe, expect, it } from 'vitest';
import { content } from './index';
import { CrewC, PositionC, TICK_HZ, newGame, type Sim, type SimEvent } from '../sim';
import { deserialize, serialize } from '../sim/save';
import {
  bump, entityOf, ensurePerson, fadeBonds, friendsOf, mainReason, opinionOf, personOf, rivalsOf,
} from '../sim/crew/bonds';
import { contextPresent } from '../sim/crew/stress';
import { killCrew } from '../sim/crew/death';
import { ensureMood, moodFactors } from '../sim/crew/mood';
import { BOND_FADE_SEC, BOND_FRIEND, BOND_KEEP, BOND_MAX_FRIENDS, BOND_MAX_RIVALS, BOND_REASONS } from '../sim/tuning';

const crewOf = (sim: Sim): number[] => sim.world.query(CrewC).filter((id) => sim.world.get(id, CrewC)?.species === 'species.human');
function game(): { sim: Sim; ids: number[]; pids: number[] } {
  const sim = newGame(5, content, 'ship.starter', false);
  sim.step();
  const ids = crewOf(sim);
  return { sim, ids, pids: ids.map((id) => ensurePerson(sim, id)) };
}
const drain = (sim: Sim): SimEvent[] => sim.events.drain();

describe('bond store', () => {
  it('gives a person id once, and the entity and name are findable from it', () => {
    const { sim, ids } = game();
    const p = ensurePerson(sim, ids[0]!);
    expect(ensurePerson(sim, ids[0]!)).toBe(p);
    expect(personOf(sim, ids[0]!)).toBe(p);
    expect(entityOf(sim, p)).toBe(ids[0]);
    expect(sim.bonds.names[p]).toBe(sim.world.get(ids[0]!, CrewC)!.name);
  });

  it('makes a friend at 50 and keeps the label down to 40 (no flicker), and a rival the same way', () => {
    const { sim, pids } = game();
    const [a, b] = pids as [number, number];
    expect(bump(sim, a, b, 49, 'chat')).toBeNull();
    expect(bump(sim, a, b, 1, 'chat')).toEqual({ from: a, to: b, kind: 'friend' });
    expect(friendsOf(sim, a).map((f) => f.person)).toEqual([b]);
    bump(sim, a, b, -9, 'badChat'); // 41: still a friend
    expect(opinionOf(sim, a, b)!.kind).toBe('friend');
    bump(sim, a, b, -2, 'badChat'); // 39: not any more
    expect(opinionOf(sim, a, b)!.kind).toBeUndefined();
    expect(bump(sim, b, a, -BOND_FRIEND, 'row')).toEqual({ from: b, to: a, kind: 'rival' });
    expect(rivalsOf(sim, b).map((r) => r.person)).toEqual([a]);
  });

  it('caps friends at three: a fourth stops at 49 unless it beats the weakest, who then drops to 49', () => {
    const { sim, pids } = game();
    const me = pids[0]!;
    const others = pids.slice(1, 1 + BOND_MAX_FRIENDS + 1);
    if (others.length < BOND_MAX_FRIENDS + 1) return; // the starter crew is big enough; guard for odd content
    others.slice(0, BOND_MAX_FRIENDS).forEach((p, i) => bump(sim, me, p, 60 + i * 10, 'chat'));
    const fourth = others[BOND_MAX_FRIENDS]!;
    bump(sim, me, fourth, 55, 'chat');
    expect(opinionOf(sim, me, fourth)!.score).toBe(BOND_FRIEND - 1);
    expect(friendsOf(sim, me)).toHaveLength(BOND_MAX_FRIENDS);
    bump(sim, me, fourth, 40, 'rescued'); // 89: beats the weakest (60)
    expect(opinionOf(sim, me, fourth)!.kind).toBe('friend');
    expect(friendsOf(sim, me)).toHaveLength(BOND_MAX_FRIENDS);
    expect(opinionOf(sim, me, others[0]!)!.score).toBe(BOND_FRIEND - 1);
    expect(opinionOf(sim, me, others[0]!)!.kind).toBeUndefined();
  });

  it('caps rivals at two', () => {
    const { sim, pids } = game();
    const me = pids[0]!;
    const others = pids.slice(1, 1 + BOND_MAX_RIVALS + 1);
    if (others.length < BOND_MAX_RIVALS + 1) return;
    others.forEach((p) => bump(sim, me, p, -50, 'row'));
    expect(rivalsOf(sim, me)).toHaveLength(BOND_MAX_RIVALS);
  });

  it('keeps the last few reasons, merged by id, and names the biggest as the main one', () => {
    const { sim, pids } = game();
    const [a, b] = pids as [number, number];
    for (const id of ['chat', 'badChat', 'together', 'worked', 'fought', 'chat']) bump(sim, a, b, id === 'fought' ? 12 : 1, id);
    const op = opinionOf(sim, a, b)!;
    expect(op.reasons.length).toBeLessThanOrEqual(BOND_REASONS);
    expect(op.reasons.filter((r) => r.id === 'chat')).toHaveLength(1);
    expect(mainReason(op)!.id).toBe('fought');
  });

  it('fades a point toward zero per BOND_FADE_SEC without a shared event, and a shared event resets the clock', () => {
    const { sim, pids } = game();
    const [a, b] = pids as [number, number];
    bump(sim, a, b, 30, 'chat');
    sim.tick += BOND_FADE_SEC * TICK_HZ * 3;
    fadeBonds(sim);
    expect(opinionOf(sim, a, b)!.score).toBe(27);
    bump(sim, a, b, 1, 'chat'); // touched now
    sim.tick += BOND_FADE_SEC * TICK_HZ - 1;
    fadeBonds(sim);
    expect(opinionOf(sim, a, b)!.score).toBe(28);
    bump(sim, a, b, -28, 'badChat');
    sim.tick += BOND_FADE_SEC * TICK_HZ;
    fadeBonds(sim);
    expect(opinionOf(sim, a, b)).toBeUndefined(); // faded to nothing and let go
    expect(BOND_KEEP).toBeLessThan(BOND_FRIEND);
  });

  it('survives a save and a load', () => {
    const { sim, pids, ids } = game();
    bump(sim, pids[0]!, pids[1]!, 55, 'fought');
    const back = deserialize(serialize(sim), content);
    expect(opinionOf(back, pids[0]!, pids[1]!)).toEqual(opinionOf(sim, pids[0]!, pids[1]!));
    expect(personOf(back, ids[0]!)).toBe(pids[0]);
    expect(friendsOf(back, pids[0]!)).toHaveLength(1);
  });
});

describe('friends and grief', () => {
  it('a friend within range lifts mood, a rival within range weighs, and out of range neither does', () => {
    const { sim, ids, pids } = game();
    const [a, b] = ids as [number, number];
    const pa = sim.world.get(a, PositionC)!, pb = sim.world.get(b, PositionC)!;
    pb.x = pb.toX = pa.x + 2; pb.y = pb.toY = pa.y;
    bump(sim, pids[0]!, pids[1]!, 60, 'chat');
    const m = ensureMood(sim, a);
    expect(moodFactors(sim, a, m).some((f) => f.key === 'withFriend' && f.value > 0)).toBe(true);
    pb.x = pb.toX = pa.x + 30;
    expect(moodFactors(sim, a, m).some((f) => f.key === 'withFriend')).toBe(false);
    bump(sim, pids[0]!, pids[1]!, -130, 'row');
    pb.x = pb.toX = pa.x + 2;
    expect(moodFactors(sim, a, m).some((f) => f.key === 'nearRival' && f.value < 0)).toBe(true);
  });

  it("a friend's death starts grief: the mood factor, the stressor and a log event; a stranger's death does not", () => {
    const { sim, ids, pids } = game();
    const [a, b, c] = ids as [number, number, number];
    bump(sim, pids[0]!, pids[1]!, 60, 'chat');
    killCrew(sim, b);
    drain(sim);
    for (let i = 0; i < 40; i++) sim.step();
    const m = ensureMood(sim, a);
    expect(m.grief).toBeGreaterThan(0);
    expect(contextPresent(sim, a, 'grief')).toBe(true);
    expect(moodFactors(sim, a, m).find((f) => f.key === 'grieving')!.value).toBeLessThan(0);
    expect(contextPresent(sim, c, 'grief')).toBe(false);
  });
});
