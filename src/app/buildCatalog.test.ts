import { describe, expect, it } from 'vitest';
import { newGame } from '../sim';
import { content } from '../content';
import type { Renderer } from '../render/scene';
import type { UiApi, UiToolState } from '../ui/api';
import { CATEGORIES, buildEntries, filterEntries, visibleCategories } from '../ui/buildCatalog';
import { createStore } from './store';
import type { Bridge } from './bridge';
import { createController } from './controller';
import { rejectionMessage } from './messages';
import { buildModuleDefs } from './moduleSnapshot';
import { buildStructCosts } from './logisticsSnapshot';

const sim = newGame(1, content);
const defs = buildModuleDefs(sim);
const api = { structCosts: buildStructCosts(sim) } as unknown as UiApi;
const entries = buildEntries(api, defs);

describe('build catalog', () => {
  it('puts every module in a known category and reaches it from some tab', () => {
    const known = new Set(CATEGORIES.map((c) => c.id as string));
    const tabs = visibleCategories(entries, true);
    for (const id of Object.keys(content.modules)) {
      const e = entries.find((x) => x.id === id && x.kind === 'module');
      expect(e, id).toBeDefined();
      expect(known.has(e!.category), `${id} category`).toBe(true);
      expect(tabs.some((t) => filterEntries(entries, t.id, '', true).some((x) => x.key === id)), `${id} reachable`).toBe(true);
    }
  });

  it('keeps the tab order stable and hides empty categories and the mining tab unless relevant', () => {
    const order = CATEGORIES.map((c) => c.id as string);
    const tabs = visibleCategories(entries, false).map((t) => t.id as string);
    expect(tabs).toEqual(order.filter((id) => tabs.includes(id)));
    expect(tabs).not.toContain('mining');
    expect(visibleCategories(entries, true).map((t) => t.id)).toContain('mining');
    expect(visibleCategories(entries.filter((e) => e.category !== 'power'), false).map((t) => t.id)).not.toContain('power');
    expect(tabs.indexOf('systems')).toBe(tabs.indexOf('power') + 1);
  });

  it('lists only its own category without a query, and searches every category with one', () => {
    const power = filterEntries(entries, 'power', '', false);
    expect(power.length).toBeGreaterThan(0);
    expect(power.every((e) => e.category === 'power')).toBe(true);
    const found = filterEntries(entries, 'power', 'laser', false);
    expect(found.map((e) => e.id)).toContain('module.burstLaser');
    expect(found.some((e) => e.category !== 'power')).toBe(true);
    expect(filterEntries(entries, 'power', 'zzzz-none', false)).toEqual([]);
    expect(filterEntries(entries, 'structure', 'dig', false).some((e) => e.category === 'mining')).toBe(false);
    expect(filterEntries(entries, 'structure', 'dig', true).some((e) => e.id === 'dig')).toBe(true);
  });

  it('shows modules with an unknown blueprint as locked cards with a source hint, and the tiers as a family', () => {
    const e = (id: string) => entries.find((x) => x.id === id)!;
    expect(e('module.reactor').locked).toBe(false);
    for (const id of ['module.reactor.mk2', 'module.reactor.mk3', 'module.engine.mk2', 'module.shieldGen.mk3']) expect(e(id).locked, id).toBe(true);
    expect(e('module.reactor.mk2').def!.lockHint).toBe('Blueprint: research stations');
    expect(e('module.shieldGen.mk2').def!.lockHint).toBe('Blueprint: military stations');
    expect(e('module.reactor').def!.lockHint).toBeNull();
    const fam = entries.filter((x) => x.def?.family === 'module.reactor').map((x) => x.def!.tier);
    expect(fam.sort()).toEqual(['Mk I', 'Mk II', 'Mk III']);
    expect(e('module.bed').def!.family).toBeNull();
  });

  it('keeps card names to two short lines', () => {
    for (const e of entries) expect(e.name.length, e.name).toBeLessThanOrEqual(22);
    const names = entries.filter((e) => e.kind === 'module').map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

const toolOf = (c: { tool: { subscribe(fn: (v: UiToolState) => void): () => void } }): UiToolState => {
  let v: UiToolState | undefined;
  c.tool.subscribe((x) => (v = x))();
  return v as UiToolState;
};

describe('placement tool state', () => {
  const setup = () => {
    const bridge = { setSelected: () => undefined, setHovered: () => undefined, sites: createStore([]), yard: createStore({ plan: { ship: 0, tiles: [], connected: [], loose: [], blocked: [], floor: [], bad: [], hull: { now: 0, afterAll: 0, capacity: 0, max: 0 } }, quote: null, order: null }) } as unknown as Bridge;
    const c = createController(newGame(1, content), bridge);
    const h = c.attach({ setPreview: () => undefined, setAreas: () => undefined, setWorldGrid: () => undefined, setHover: () => undefined, setSites: () => undefined, setModuleGhost: () => undefined } as unknown as Renderer);
    return { c, h };
  };

  it('switching modules mid-placement replaces the selection and keeps the rotation', () => {
    const { c } = setup();
    c.setTool({ tool: 'build', build: 'module', moduleDef: 'module.fabricator' });
    c.setTool({ rot: 2 });
    c.setTool({ tool: 'build', build: 'module', moduleDef: 'module.galley' });
    expect(toolOf(c)).toMatchObject({ tool: 'build', build: 'module', moduleDef: 'module.galley', rot: 2 });
    c.setTool({ tool: 'build', build: 'wall' });
    expect(toolOf(c)).toMatchObject({ build: 'wall', moduleDef: 'module.galley' });
  });

  it('a locked module cannot be picked for placement; an unlocked one can', () => {
    const { c } = setup();
    c.setTool({ tool: 'build', build: 'module', moduleDef: 'module.fabricator' });
    c.setTool({ tool: 'build', build: 'module', moduleDef: 'module.reactor.mk2' });
    expect(toolOf(c).moduleDef).toBe('module.fabricator');
    const sim2 = newGame(1, content);
    sim2.story.blueprints.push('module.reactor.mk2');
    const bridge = { setSelected: () => undefined, setHovered: () => undefined, sites: createStore([]), yard: createStore({ plan: { ship: 0, tiles: [], connected: [], loose: [], blocked: [], floor: [], bad: [], hull: { now: 0, afterAll: 0, capacity: 0, max: 0 } }, quote: null, order: null }) } as unknown as Bridge;
    const c2 = createController(sim2, bridge);
    c2.setTool({ tool: 'build', build: 'module', moduleDef: 'module.reactor.mk2' });
    expect(toolOf(c2).moduleDef).toBe('module.reactor.mk2');
  });

  it('rotates with R and back with Shift+R', () => {
    const { c, h } = setup();
    c.setTool({ tool: 'build', build: 'module', moduleDef: 'module.fabricator' });
    h.onKey('r');
    expect(toolOf(c).rot).toBe(1);
    h.onKey('r', true);
    h.onKey('r', true);
    expect(toolOf(c).rot).toBe(3);
  });

  it.each(['escape', 'back'])('%s drops the placement first, then leaves build mode', (how) => {
    const { c, h } = setup();
    const press = () => (how === 'escape' ? h.onKey('escape') : h.onContext(0, 0, false));
    c.setTool({ tool: 'build', build: 'module', moduleDef: 'module.fabricator' });
    press();
    expect(toolOf(c)).toMatchObject({ tool: 'build', build: 'module', moduleDef: null });
    press();
    expect(toolOf(c).tool).toBe('select');
    c.setTool({ tool: 'build', build: 'floor' }); // a structure tool counts as a selection too
    press();
    expect(toolOf(c)).toMatchObject({ tool: 'build', moduleDef: null, build: 'module' });
  });
});

describe('placement reasons', () => {
  it('every placement and build rejection has a plain-language message', () => {
    const codes = ['badGrid', 'badDef', 'badRot', 'outOfBounds', 'notOnHull', 'notFloor', 'occupied', 'rockMass', 'noAccess', 'jobExists', 'noModule', 'noRoom', 'badStruct', 'sameStruct', 'notRock', 'noAsteroid', 'offAsteroid', 'overlap', 'badSize', 'noPod', 'noOre', 'moduleHere', 'nothingToDeconstruct', 'noJob', 'cantAfford'];
    for (const code of codes) {
      const m = rejectionMessage(code);
      expect(m, code).not.toMatch(/rejected|\(/);
      expect(m.length).toBeGreaterThan(8);
    }
    expect(rejectionMessage('unknownCode')).not.toContain('unknownCode');
  });
});
