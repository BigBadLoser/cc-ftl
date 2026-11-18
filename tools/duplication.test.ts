import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Copy-paste ratchet. jscpd (settings in .jscpd.json: 6+ lines and 50+ tokens, non-test src) counts duplicated code blocks.
 * The numbers below are today's: they may only go down. New duplicated code fails here: call the existing function, or fold
 * both copies into one owner ("One answer per question", docs/ARCHITECTURE.md). Removing duplicates fails the "current" test so
 * the baseline comes down with it. `npx jscpd` prints the clones (console reporter: `npx jscpd --reporters console`).
 * jscpd 5 (the Rust engine) takes well under a second, so this runs with the other rule checks (`npm run test:rules`).
 */
const BASELINE = { clones: 71, duplicatedLines: 650 };

const out = mkdtempSync(join(tmpdir(), 'jscpd-'));
let now = { clones: 0, duplicatedLines: 0 };
try {
  execFileSync('node_modules/.bin/jscpd', ['--output', out], { stdio: 'ignore' });
  const total = JSON.parse(readFileSync(join(out, 'jscpd-report.json'), 'utf8')).statistics.total;
  now = { clones: total.clones, duplicatedLines: total.duplicatedLines };
} finally {
  rmSync(out, { recursive: true, force: true });
}

describe('duplicated code in src', () => {
  it('no new duplication', () => {
    expect(now.duplicatedLines, 'more duplicated lines: reuse the existing code (npx jscpd --reporters console lists the clones)').toBeLessThanOrEqual(BASELINE.duplicatedLines);
    expect(now.clones, 'more clones: reuse the existing code (npx jscpd --reporters console lists the clones)').toBeLessThanOrEqual(BASELINE.clones);
  });

  it('the baseline is current (lower it when duplicates are removed)', () => {
    expect(now, 'duplication shrank: lower BASELINE in tools/duplication.test.ts to these numbers').toEqual(BASELINE);
  });
});
