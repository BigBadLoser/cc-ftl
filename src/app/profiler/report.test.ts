import { describe, expect, it } from 'vitest';
import { Profiler } from './profiler';
import { formatReport } from './report';

function sample() {
  let t = 0;
  const p = new Profiler(() => t);
  p.enabled = true;
  for (let i = 0; i < 10; i++) {
    p.begin('loop/frame');
    p.begin('render/gl');
    t += 6;
    p.end('render/gl');
    p.begin('sim/tick');
    p.begin('sim/power');
    t += 2;
    p.end('sim/power');
    t += 1;
    p.end('sim/tick');
    p.count('render/drawCalls', 100 + i);
    p.end('loop/frame');
  }
  return p;
}

describe('formatReport', () => {
  it('sorts by self time and aligns columns', () => {
    const lines = formatReport(sample().summary()).split('\n');
    const rows = lines.filter((l) => /^(render|sim|loop)\//.test(l));
    expect(rows.map((l) => l.split(/\s+/)[0])).toEqual(['render/gl', 'sim/power', 'sim/tick', 'loop/frame', 'render/drawCalls']);
    const header = lines.find((l) => l.startsWith('label'))!;
    const gl = lines.find((l) => l.startsWith('render/gl'))!;
    expect(gl.length).toBe(header.length);
  });

  it('shows frame stats, budget and counters', () => {
    const text = formatReport(sample().summary());
    expect(text).toContain('frames 10');
    expect(text).toContain('work/frame  mean 9.00');
    expect(text).toContain('render/drawCalls');
    expect(text.split('\n').length).toBeLessThan(30);
  });

  it('limits rows and lists recorded spikes', () => {
    const p = sample();
    p.startRecording();
    p.begin('loop/frame');
    p.end('loop/frame');
    p.stopRecording();
    const text = formatReport(p.summary(), 2);
    expect(text).toContain('recording 1 frames');
    expect(text).not.toContain('loop/frame  ');
  });
});
