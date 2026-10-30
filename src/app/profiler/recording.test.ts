import { describe, expect, it } from 'vitest';
import { analyse, MAX_FRAMES, Recorder } from './recording';
import { Profiler } from './profiler';

const share = (label: string, self: number) => ({ label, total: self, self, calls: 1, isCount: false });

describe('spike detection', () => {
  it('flags the worst frames and the label that dominated them', () => {
    const r = new Recorder(0);
    for (let i = 0; i < 100; i++) {
      const spike = i === 40 || i === 70;
      r.add(i * 16, spike ? 50 : 5, [share('sim/a', 2), share('render/b', spike ? 45 : 3)]);
    }
    const a = analyse(r.frames, 16.67, 2);
    expect(a.frames).toBe(100);
    expect(a.overBudget).toBe(2);
    expect(a.worst.map((w) => w.frame).sort((x, y) => x - y)).toEqual([40, 70]);
    expect(a.worst[0]!.dominant[0]).toEqual({ label: 'render/b', self: 45 });
    expect(a.culprits).toEqual([{ label: 'render/b', frames: 2, meanSelf: 45 }]);
  });

  it('bounds memory', () => {
    const r = new Recorder(0);
    for (let i = 0; i < MAX_FRAMES + 10; i++) r.add(i, 1, []);
    expect(r.frames.length).toBe(MAX_FRAMES);
  });
});

describe('Profiler recording', () => {
  function drive() {
    let t = 0;
    const p = new Profiler(() => t, () => null);
    p.enabled = true;
    const frame = (work: number) => {
      p.begin('loop/frame');
      p.begin('sim/x');
      t += work;
      p.end('sim/x');
      p.end('loop/frame');
    };
    return { p, frame };
  }

  it('records only between start and stop, and keeps the analysis afterwards', () => {
    const { p, frame } = drive();
    frame(1);
    p.startRecording();
    expect(p.recording).toBe(true);
    frame(30);
    frame(2);
    const a = p.stopRecording()!;
    frame(1);
    expect(p.recording).toBe(false);
    expect(a.frames).toBe(2);
    expect(a.worst[0]!.ms).toBe(30);
    expect(p.summary().recording?.frames).toBe(2);
  });

  it('counts budget overruns and reset clears the tally', () => {
    const { p, frame } = drive();
    frame(1);
    frame(20);
    frame(17);
    expect(p.summary().overBudget).toBe(2);
    expect(p.summary().frames).toBe(3);
    p.reset();
    expect(p.summary().frames).toBe(0);
    expect(p.summary().bySelf).toEqual([]);
  });

  it('does nothing while disabled', () => {
    const p = new Profiler(() => 0);
    p.begin('a');
    p.end('a');
    p.count('c');
    expect(p.summary().bySelf).toEqual([]);
  });
});
