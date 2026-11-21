import { describe, expect, it } from 'vitest';
import { changedSrc, jscpdArgs, report } from './dupSemantic.mjs';

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

describe('dup:semantic on a change (PR scan)', () => {
  const at = (first: string, second: string, isNew = true) => ({
    ...pair(10, isNew), firstFile: { name: first, start: 1, end: 10 }, secondFile: { name: second, start: 5, end: 14 },
  });
  const json = { duplicates: [at('sim/a.ts', 'render/b.ts'), at('ui/c.ts', 'sim/a.ts'), at('ui/c.ts', 'ui/d.ts'), at('sim/a.ts', 'ui/e.ts', false)] };

  it('keeps only new pairs with a side in a changed file, and says so', () => {
    const md = report(json, { only: new Set(['src/render/b.ts', 'src/ui/d.ts']) });
    expect(md).toMatch(/^2 new semantic duplicate pairs touching this change/);
    expect(md).toContain('**src/sim/a.ts:1-10** and **src/render/b.ts:5-14**');
    expect(md).toContain('**src/ui/c.ts:1-10** and **src/ui/d.ts:5-14**');
    expect(md).not.toContain('src/ui/e.ts');
    expect(report(json, { only: new Set(['src/other.ts']) })).toBe('');
  });
  it('reads the changed src files from git against the merge base, skipping deletions', () => {
    const calls: string[][] = [];
    const files = changedSrc('HEAD^1', (args) => { calls.push(args); return 'src/sim/a.ts\nsrc/ui/c.ts\n'; });
    expect([...files]).toEqual(['src/sim/a.ts', 'src/ui/c.ts']);
    expect(calls[0]).toEqual(['diff', '--name-only', '--diff-filter=d', 'HEAD^1...HEAD', '--', 'src']);
    expect(changedSrc('x', () => '').size).toBe(0);
  });
});

describe('dup:semantic jscpd arguments', () => {
  it('uses the local model unless an embeddings URL is given, and names the model for the URL', () => {
    expect(jscpdArgs({ out: 'o', url: '' })).toContain('--semantic-download');
    const http = jscpdArgs({ out: 'o', url: 'http://127.0.0.1:8792/v1' });
    expect(http).toEqual(expect.arrayContaining(['--semantic-url', 'http://127.0.0.1:8792/v1', '--semantic-model', 'nomic-ai/CodeRankEmbed']));
    expect(http).not.toContain('--semantic-download');
  });
  it('rewrites the baseline only when accepting', () => {
    expect(jscpdArgs({ out: 'o', url: '' })).not.toContain('--update-baseline');
    expect(jscpdArgs({ out: 'o', url: '', accept: true })).toContain('--update-baseline');
  });
});
