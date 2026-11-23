import { describe, expect, it } from 'vitest';
import { jscpdArgs, report, THRESHOLD } from './dupSemantic.mjs';

const pair = (lines: number, isNew: boolean, kind = 'semantic') => ({
  kind, isNew, lines, fragment: Array.from({ length: lines }, (_, i) => `line ${i}`).join('\n'),
  firstFile: { name: 'sim/a.ts', start: 1, end: lines }, secondFile: { name: 'render/b.ts', start: 10, end: 9 + lines },
});

describe('dup:semantic report', () => {
  it('is empty when every pair is in the baseline', () => {
    expect(report({ duplicates: [pair(8, false), pair(20, false)] })).toBe('');
    expect(report({})).toBe('');
  });
  it('lists only new semantic pairs, largest first, with src paths and a trimmed snippet', () => {
    const md = report({ duplicates: [pair(8, true), pair(30, true), pair(40, false), pair(50, true, 'exact')] });
    expect(md).toMatch(/^2 new semantic duplicate pairs/);
    expect(md.indexOf('(30 lines)')).toBeLessThan(md.indexOf('(8 lines)'));
    expect(md).toContain('**src/sim/a.ts:1-30** and **src/render/b.ts:10-39**');
    expect(md).toContain('line 11\n  …');
    expect(md).not.toContain('line 12');
    expect(md).not.toContain('(40 lines)');
  });
});

describe('dup:semantic jscpd arguments', () => {
  it('asks embeddinggemma at a local Ollama unless an embeddings URL is given, with the bench cutoff', () => {
    expect(jscpdArgs({ out: 'o', url: '' })).toEqual(expect.arrayContaining(['--semantic-url', 'http://127.0.0.1:11434/v1', '--semantic-model', 'embeddinggemma']));
    const npu = jscpdArgs({ out: 'o', url: 'http://127.0.0.1:8794/v1' });
    expect(npu).toEqual(expect.arrayContaining(['--semantic-url', 'http://127.0.0.1:8794/v1', '--semantic-same-threshold', THRESHOLD]));
    expect(npu).not.toContain('--semantic-download');
  });
  it('rewrites the baseline only when accepting', () => {
    expect(jscpdArgs({ out: 'o', url: '' })).not.toContain('--update-baseline');
    expect(jscpdArgs({ out: 'o', url: '', accept: true })).toContain('--update-baseline');
  });
});
