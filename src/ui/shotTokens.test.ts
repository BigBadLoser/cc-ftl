import { describe, expect, it } from 'vitest';
import { SHOT_COLORS, shotColor } from '../sim';

/** Node's fs, loaded by name: the UI tsconfig has no Node types. */
async function readTheme(): Promise<string> {
  const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync(p: URL, enc: string): string };
  return fs.readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
}

describe('shot colour tokens', () => {
  it('wraps slots around the palette', () => {
    expect(shotColor(0)).toBe(SHOT_COLORS[0]);
    expect(shotColor(SHOT_COLORS.length)).toBe(SHOT_COLORS[0]);
    expect(shotColor(-1)).toBe(SHOT_COLORS[1]);
  });

  it('the --shot-N tokens in theme.css match the sim palette (the source)', async () => {
    const css = await readTheme();
    SHOT_COLORS.forEach((c, i) => {
      const m = new RegExp(`--shot-${i}:\\s*#([0-9a-f]{6})`, 'i').exec(css);
      expect(m?.[1] && parseInt(m[1], 16), `--shot-${i}`).toBe(c);
    });
  });
});
