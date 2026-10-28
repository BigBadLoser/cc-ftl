import { describe, expect, it } from 'vitest';
import { buildContext, buildIssueUrl, issueUrl, MAX_URL, reportFileNames, type ReportInfo } from './bugReport';
import { installConsoleRing } from './consoleRing';

const info = (over: Partial<ReportInfo> = {}): ReportInfo => ({
  commit: 'abc1234', url: 'http://localhost:5173/?seed=7&hook', seed: 7, turn: 12, node: 'n3', saveVersion: 64,
  userAgent: 'UA/1.0', viewport: { w: 1280, h: 800 }, dpr: 2, gpu: 'Test GPU', errors: [], ...over,
});
const errs = (n: number, stack = 400) => Array.from({ length: n }, (_, i) => ({ message: `boom ${i}`, stack: `Error: boom ${i}\n${'    at fn (file.js:1:1)\n'.repeat(Math.ceil(stack / 28))}` }));
const draft = { title: 'Crew stuck & "weird" #1', what: 'It broke? <yes> & more\nline two', expected: 'Not that' };

describe('buildContext', () => {
  it('lists the facts', () => {
    const c = buildContext(info());
    for (const s of ['abc1234', 'seed=7, hook', 'Seed: 7', 'Turn: 12', '`n3`', 'Save version: 64', 'UA/1.0', '1280x800 @ 2x', 'Test GPU', 'drag the downloaded save']) expect(c).toContain(s);
  });
  it('limits errors and stacks', () => {
    const c = buildContext(info({ errors: errs(10) }), { errors: 2, stack: 0 });
    expect(c).toContain('boom 1');
    expect(c).not.toContain('boom 2');
    expect(c).not.toContain('at fn');
    expect(c).toContain('(2 of 10)');
  });
});

describe('buildIssueUrl', () => {
  it('encodes every field', () => {
    const { url } = buildIssueUrl(draft, info());
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://github.com/BigBadLoser/cc-ftl/issues/new');
    expect(u.searchParams.get('title')).toBe(draft.title);
    expect(u.searchParams.get('labels')).toBe('bug');
    const body = u.searchParams.get('body') ?? '';
    expect(body).toContain('It broke? <yes> & more\nline two');
    expect(body).toContain('### What did you expect?');
    expect(url).not.toMatch(/[ <>"\n]/);
  });
  it('omits the expectation section when empty', () => {
    expect(buildIssueUrl({ ...draft, expected: ' ' }, info()).body).not.toContain('expect');
  });
  it('keeps a short report whole', () => {
    const r = buildIssueUrl(draft, info({ errors: errs(3) }));
    expect(r.trimmed).toBe(false);
    expect(r.body).toContain('boom 2');
  });
  it('trims errors before stacks, and stays under the cap', () => {
    const r = buildIssueUrl(draft, info({ errors: errs(10, 1500) }));
    expect(r.url.length).toBeLessThanOrEqual(MAX_URL);
    expect(r.trimmed).toBe(true);
    expect(r.body).toContain('boom 0');
    expect(r.body).not.toContain('boom 9');
  });
  it('drops stacks then errors when still too long', () => {
    const r = buildIssueUrl(draft, info({ errors: errs(10, 1500) }), 2600);
    expect(r.url.length).toBeLessThanOrEqual(2600);
  });
  it('cuts the reporter text as a last resort', () => {
    const big = { title: 'T'.repeat(500), what: 'é'.repeat(5000), expected: 'ü'.repeat(5000) };
    const r = buildIssueUrl(big, info({ errors: errs(10) }));
    expect(r.url.length).toBeLessThanOrEqual(MAX_URL);
    expect(r.url).toContain('labels=bug');
    expect(new URL(r.url).searchParams.get('title')?.length).toBeLessThanOrEqual(200);
  });
  it('encodes a title with unicode', () => {
    expect(new URL(issueUrl('日本語 ✓', 'b')).searchParams.get('title')).toBe('日本語 ✓');
  });
});

describe('reportFileNames', () => {
  it('pairs the names with one stamp', () => {
    expect(reportFileNames(new Date(2026, 9, 28, 7, 5, 9))).toEqual({ save: 'cc-ftl-save-20261028-070509.json', shot: 'cc-ftl-shot-20261028-070509.png' });
  });
});

describe('installConsoleRing', () => {
  it('keeps the last 10 console errors, newest first, and restores console', () => {
    const target = new EventTarget() as unknown as Window;
    const seen: unknown[][] = [];
    const con = { error: (...a: unknown[]) => void seen.push(a) };
    const orig = con.error;
    const ring = installConsoleRing(target, con);
    for (let i = 0; i < 12; i++) con.error(`e${i}`, { a: i });
    expect(seen).toHaveLength(12);
    expect(ring.get()).toHaveLength(10);
    expect(ring.get()[0]?.message).toBe('e11 {"a":11}');
    ring.dispose();
    expect(con.error).toBe(orig);
  });
});
