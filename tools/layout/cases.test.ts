import { describe, expect, it } from 'vitest';
import { caseOf, caseSlug, decodeLayout, encodeLayout, parseCase, pretty, serializeCase, sourceSlug, type Provenance } from './cases';
import { describeChanges } from './changes';
import { designFromLayout } from './design';
import { addModule, paint } from './layout';
import { newPin } from './pins';
import { blankLayout, buildLayout, DEFAULT_SOURCE, specOf } from './source';

const prov = (): Provenance => ({ ...DEFAULT_SOURCE, spec: specOf(DEFAULT_SOURCE), generator: 'commit abc1234' });

describe('feedback cases', () => {
  it('round-trips a generated design, its edit and the notes through JSON text', () => {
    const { layout } = buildLayout({ ...DEFAULT_SOURCE, size: 'outpost', layout: '' });
    const edited = addModule(paint(layout, [[12, 12]], '#'), { def: 'module.chair', x: 14, y: 14, rot: 1 });
    const d = designFromLayout(edited, 't');
    const pin = newPin(1, 'move this', 14, 14, { kind: 'tile', x: 14, y: 14 }, edited, d);
    const text = serializeCase(caseOf('wider', prov(), layout, edited, [pin], describeChanges(layout, edited)));
    const back = parseCase(text);
    expect(decodeLayout(back.original)).toEqual(layout);
    expect(decodeLayout(back.edited)).toEqual(edited);
    expect(back.notes).toEqual([pin]);
    expect(back.source).toEqual(prov());
    expect(back.changes.length).toBeGreaterThan(0);
  });
  it('writes tile rows one per line, so a diff reads like a picture', () => {
    const l = blankLayout(6, 4);
    const text = serializeCase(caseOf('t', { ...prov(), kind: 'blank', spec: '' }, l, paint(l, [[2, 1]], '_'), [], []));
    expect(text).toContain('    "cells": [\n      "......",\n      ".._...",');
    expect(text).not.toContain('"cells": ["');
    expect(text.endsWith('}\n')).toBe(true);
  });
  it('pretty keeps short values on one line and expands long arrays of strings', () => {
    expect(pretty({ a: [1, 2], b: 'x' })).toBe('{"a":[1,2],"b":"x"}');
    expect(pretty({ rows: ['a', 'b', 'c', 'd'] })).toBe('{\n  "rows": [\n    "a",\n    "b",\n    "c",\n    "d"\n  ]\n}');
  });
  it('rejects a file that is not a case, or whose grid does not match its size', () => {
    expect(() => parseCase('{"format":"other"}')).toThrow();
    const j = encodeLayout(blankLayout(4, 3));
    expect(() => decodeLayout({ ...j, width: 5 })).toThrow();
  });
  it('names a case after its source and the name given', () => {
    expect(sourceSlug(DEFAULT_SOURCE)).toBe('trading-station-stationwheel-s1');
    expect(caseSlug({ ...DEFAULT_SOURCE, kind: 'faction', id: 'faction.navy', family: '', depth: 4, seed: 2 }, 'Wider Hall!')).toBe('navy-s2-d4--wider-hall');
    expect(caseSlug({ ...DEFAULT_SOURCE, kind: 'blank', id: '' }, '')).toBe('blank--untitled');
    expect(caseSlug({ ...DEFAULT_SOURCE, kind: 'starter', id: 'ship.wayfarer' }, 'x')).toBe('starter-wayfarer--x');
  });
  it('a blank grid and a starter template record where they came from', () => {
    expect(buildLayout({ ...DEFAULT_SOURCE, kind: 'blank', id: '' }).label).toBe('Blank grid');
    expect(specOf({ ...DEFAULT_SOURCE, kind: 'faction', id: 'faction.navy', family: 'x' })).toBe('faction.navy:x');
  });
});
