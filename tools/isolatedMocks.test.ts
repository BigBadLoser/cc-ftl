import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ISOLATED } from './isolatedTests';

/**
 * Mocks are isolated. Test files share one module graph (`isolate: false`), so a file that mocks a module, spies on or stubs a
 * global leaks into whatever runs after it in the same worker. Every such file must be in ISOLATED (tools/isolatedTests.ts,
 * the one owner of that list, read by vite.config.ts). EXCEPTIONS lists files that use these calls and are not isolated, each
 * with the reason; it may only shrink.
 */
const MOCKING = /\bvi\.(mock|doMock|spyOn|stubGlobal|stubEnv)\b/;
const EXCEPTIONS: Record<string, string> = {};

const files = execFileSync('git', ['ls-files', 'src', 'tools', 'test'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.test\.ts$/.test(f));
// This file names the calls it looks for.
const SELF = 'tools/isolatedMocks.test.ts';
const users = files.filter((f) => f !== SELF && MOCKING.test(readFileSync(f, 'utf8')));
const unisolated = users.filter((f) => !ISOLATED.includes(f));

describe('mocking tests are isolated', () => {
  it('every test that mocks or stubs is in ISOLATED', () => {
    const bad = unisolated.filter((f) => !(f in EXCEPTIONS));
    expect(bad, 'these tests use vi.mock / vi.doMock / vi.spyOn / vi.stubGlobal / vi.stubEnv: add them to ISOLATED in tools/isolatedTests.ts').toEqual([]);
  });

  it('the exceptions are current (remove one once the file is isolated or stops mocking)', () => {
    expect(Object.keys(EXCEPTIONS).filter((f) => !unisolated.includes(f)), 'delete these entries from EXCEPTIONS in tools/isolatedMocks.test.ts').toEqual([]);
  });

  it('ISOLATED lists only files that exist', () => {
    expect(ISOLATED.filter((f) => !files.includes(f))).toEqual([]);
  });
});
