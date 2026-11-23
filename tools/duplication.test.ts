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
const BASELINE = { clones: 70, duplicatedLines: 643 };
/**
 * Near-copies: jscpd's AST mode (`--kind ast --similarity 0.8`) also matches a function copied with renamed variables or a few
 * edited statements, which token matching misses. On the labelled set in tools/dupBench it found every renamed copy and almost
 * no false pairs (#610). `npx jscpd --kind ast --similarity 0.8 --reporters console` lists them.
 */
const AST_BASELINE = { clones: 11, duplicatedLines: 99 };

function scan(args: string[]) {
  const out = mkdtempSync(join(tmpdir(), 'jscpd-'));
  try {
    execFileSync('node_modules/.bin/jscpd', [...args, '--output', out], { stdio: 'ignore' });
    const total = JSON.parse(readFileSync(join(out, 'jscpd-report.json'), 'utf8')).statistics.total;
    return { clones: total.clones as number, duplicatedLines: total.duplicatedLines as number };
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
const now = scan([]);
const ast = scan(['--kind', 'ast', '--similarity', '0.8']);

describe('duplicated code in src', () => {
  it('no new duplication', () => {
    expect(now.duplicatedLines, 'more duplicated lines: reuse the existing code (npx jscpd --reporters console lists the clones)').toBeLessThanOrEqual(BASELINE.duplicatedLines);
    expect(now.clones, 'more clones: reuse the existing code (npx jscpd --reporters console lists the clones)').toBeLessThanOrEqual(BASELINE.clones);
  });

  it('the baseline is current (lower it when duplicates are removed)', () => {
    expect(now, 'duplication shrank: lower BASELINE in tools/duplication.test.ts to these numbers').toEqual(BASELINE);
  });

  it('no new near-copies', () => {
    const hint = 'more near-copies: reuse the existing code (npx jscpd --kind ast --similarity 0.8 --reporters console lists them)';
    expect(ast.duplicatedLines, hint).toBeLessThanOrEqual(AST_BASELINE.duplicatedLines);
    expect(ast.clones, hint).toBeLessThanOrEqual(AST_BASELINE.clones);
  });

  it('the near-copy baseline is current (lower it when they are removed)', () => {
    expect(ast, 'near-copies shrank: lower AST_BASELINE in tools/duplication.test.ts to these numbers').toEqual(AST_BASELINE);
  });
});
