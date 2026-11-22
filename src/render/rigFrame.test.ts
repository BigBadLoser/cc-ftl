import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../sim/time';
import { RIG_FPS, rigFrame, rigTick, type RigCounts, type RigFrame } from './rigFrame';

const counts: RigCounts = { deploy: 18, cut: 8, 'swap.cut': 14, open: 8, 'swap.open': 14, close: 8, stow: 18 };
/** Frames in a job of `total` frame-clock ticks, one per tick. */
const play = (total: number, c: RigCounts = counts): RigFrame[] => {
  const work = (total / RIG_FPS) * TICK_HZ;
  return Array.from({ length: total }, (_, t) => rigFrame(((t + 0.5) / RIG_FPS) * TICK_HZ, work, c));
};
const phases = (fs: RigFrame[]): string[] => fs.map((f) => f.phase).filter((p, i, a) => a[i - 1] !== p);

describe('rig operation timeline (#311)', () => {
  it('is idle before any progress, and the clock runs 8 frames per second of work', () => {
    expect(rigFrame(0, 400, counts)).toEqual({ phase: 'idle', frame: 0 });
    expect(rigTick(TICK_HZ)).toBe(RIG_FPS);
  });

  it('plays deploy first and stow last, with the stages between in order', () => {
    const fs = play(200);
    expect(fs.slice(0, 18).map((f) => f.frame)).toEqual(Array.from({ length: 18 }, (_, i) => i));
    expect(fs.slice(0, 18).every((f) => f.phase === 'deploy')).toBe(true);
    expect(fs.slice(-18).map((f) => f.frame)).toEqual(Array.from({ length: 18 }, (_, i) => i));
    expect(phases(fs)).toEqual(['deploy', 'cut', 'swap.cut', 'open', 'swap.open', 'close', 'stow']);
  });

  it('repeats a stage loop in its share, then holds frame 0 just before the swap', () => {
    // 200 - 64 = 136 stage frames: share 45 = 5 loops of 8 + 5 held.
    const fs = play(200);
    const cut = fs.filter((f) => f.phase === 'cut');
    expect(cut).toHaveLength(45);
    expect(cut.slice(0, 16).map((f) => f.frame)).toEqual([...Array(8).keys(), ...Array(8).keys()]);
    expect(cut.slice(-5).map((f) => f.frame)).toEqual([0, 0, 0, 0, 0]);
    const close = fs.filter((f) => f.phase === 'close');
    expect(close).toHaveLength(46);
    expect(close.slice(-6).map((f) => f.frame)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(fs.filter((f) => f.phase === 'swap.cut').map((f) => f.frame)).toEqual(Array.from({ length: 14 }, (_, i) => i));
  });

  it('plays every phase of a long job, ending on the last stow frame', () => {
    const fs = play(2000);
    expect(phases(fs)).toEqual(['deploy', 'cut', 'swap.cut', 'open', 'swap.open', 'close', 'stow']);
    expect(fs.at(-1)).toEqual({ phase: 'stow', frame: 17 });
    expect(rigFrame(1e9, 2000 / RIG_FPS * TICK_HZ, counts)).toEqual({ phase: 'stow', frame: 17 });
  });

  it('compresses a job too short for the one-shots and a loop of each stage, still in order and in range', () => {
    const fs = play(50);
    expect(phases(fs)).toEqual(['deploy', 'cut', 'swap.cut', 'open', 'swap.open', 'close', 'stow']);
    for (const f of fs) expect(f.frame).toBeLessThan(counts[f.phase as keyof RigCounts]);
    expect(fs[0]).toEqual({ phase: 'deploy', frame: 0 });
    expect(fs.at(-1)?.phase).toBe('stow');
    expect(phases(play(3)).length).toBeGreaterThan(0);
  });
});
