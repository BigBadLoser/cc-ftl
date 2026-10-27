import { describe, expect, it } from 'vitest';
import py from '../../tools/blender/sprites/roof_livery.py?raw';
import { LIVERIES, SCHEMES } from './roofArt';

// roofArt.ts mirrors tools/blender/sprites/roof_livery.py: its schemes and faction liveries must match the Python ones.
const strs = (s: string): string[] => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1] as string);
const hex = (s: string | undefined): number | undefined => (s ? parseInt(s, 16) : undefined);

function pySchemes(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const re = /"(\w+)": dict\(motifs=\(([^)]*)\),\s*P="#(\w{6})",\s*S="#(\w{6})"(?:,\s*T="#(\w{6})")?(?:,\s*U="#(\w{6})")?(?:,\s*remap=\{([^}]*)\})?\)/g;
  for (const m of py.matchAll(re)) {
    const remap = m[7] ? Object.fromEntries([...m[7].matchAll(/"([^"]+)":\s*\(([^)]*)\)/g)].map((r) => [r[1], strs(r[2] as string)])) : undefined;
    out[m[1] as string] = { motifs: strs(m[2] as string), P: hex(m[3]), S: hex(m[4]), T: hex(m[5]), U: hex(m[6]), remap };
  }
  return out;
}

function pyLiveries(): Record<string, string[]> {
  const classic = strs(/CLASSIC = \(([^)]*)\)/.exec(py)?.[1] ?? '');
  const body = /LIVERIES = \{([\s\S]*?)\n\}/.exec(py)?.[1] ?? '';
  return Object.fromEntries([...body.matchAll(/"(livery\.\w+)": (CLASSIC|\(([^)]*)\))/g)].map((m) => [m[1], m[2] === 'CLASSIC' ? classic : strs(m[3] as string)]));
}

describe('roof livery mirror', () => {
  it('has the same schemes as roof_livery.py', () => {
    const ts = Object.fromEntries(Object.entries(SCHEMES).map(([k, v]) => [k, { motifs: [...v.motifs], P: v.P, S: v.S, T: v.T, U: v.U, remap: v.remap }]));
    const want = pySchemes();
    expect(Object.keys(want).length).toBeGreaterThan(10);
    expect(JSON.parse(JSON.stringify(ts))).toEqual(JSON.parse(JSON.stringify(want)));
  });
  it('has the same faction liveries as roof_livery.py', () => {
    expect(Object.fromEntries(Object.entries(LIVERIES).map(([k, v]) => [k, [...v]]))).toEqual(pyLiveries());
  });
});
