import { describe, expect, it } from 'vitest';
import { newGame } from '../sim';
import { content } from '../content';
import type { Renderer } from '../render/scene';
import type { UiApi, UiToolState } from '../ui/api';
import { CATEGORIES, buildEntries, filterEntries, groupMembers, isSelected, visibleCategories } from '../ui/buildCatalog';
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
      // Reachable: on a card of some tab, or as a member behind its group's card (the chips of the popover).
      const card = e!.def?.group ? groupMembers(entries, e!.def.group)[0]! : e!;
      expect(tabs.some((t) => filterEntries(entries, t.id, '', true).some((x) => x.key === card.key)), `${id} reachable`).toBe(true);
      expect(groupMembers(entries, e!.def?.group ?? '').concat(e!).some((m) => m.id === id)).toBe(true);
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
    const fam = entries.filter((x) => x.def?.group === 'module.reactor').map((x) => x.def!.tier);
    expect(fam.sort()).toEqual(['Mk I', 'Mk II', 'Mk III']);
    expect(e('module.bed').def!.group).toBeNull();
  });

  it('folds tier families, the bar counters and the vending machines into one card each, ×N members behind it', () => {
    const members = (g: string) => groupMembers(entries, g).map((m) => m.id);
    expect(members('module.reactor')).toEqual(['module.reactor', 'module.reactor.mk2', 'module.reactor.mk3']);
    expect(members('bar')).toEqual(['module.bar_counter', 'module.bar_counter_short', 'module.bar_corner']);
    expect(members('vending')).toEqual(['module.vending', 'module.vending_red']);
    expect(members('hydroponics')).toEqual(['module.hydroponics', 'module.hydroponics_large']);
    expect(entries.find((e) => e.id === 'module.bar_stool')!.def!.group).toBeNull();
    for (const g of ['bar', 'vending', 'hydroponics']) for (const m of groupMembers(entries, g)) expect(m.def!.variantLabel, m.id).toBeTruthy();
    const furn = (chosen: Record<string, string> = {}) => filterEntries(entries, 'furniture', '', false, chosen).map((e) => e.id);
    expect(furn().filter((id) => id.startsWith('module.bar_') && id !== 'module.bar_stool')).toEqual(['module.bar_counter']);
    expect(furn({ bar: 'module.bar_corner' })).toContain('module.bar_corner');
    expect(furn({ bar: 'module.bar_corner' })).not.toContain('module.bar_counter');
    expect(furn().filter((id) => id.startsWith('module.vending'))).toEqual(['module.vending']);
    expect(filterEntries(entries, 'power', '', false).filter((e) => e.def?.group === 'module.reactor').length).toBe(1);
    // A search lists each module on its own card.
    expect(filterEntries(entries, 'life', 'bar ', false).map((e) => e.id)).toEqual(expect.arrayContaining(['module.bar_counter', 'module.bar_counter_short', 'module.bar_corner']));
    // The tab count is cards, not modules.
    expect(visibleCategories(entries, false).find((t) => t.id === 'power')!.count).toBe(filterEntries(entries, 'power', '', false).length);
  });

  it('marks a group card selected when any member is being placed', () => {
    const ms = groupMembers(entries, 'bar');
    const st = { tool: 'build', build: 'module', moduleDef: 'module.bar_corner', rot: 0 } as UiToolState;
    expect(isSelected(ms[0]!, st, ms)).toBe(true);
    expect(isSelected(ms[0]!, st)).toBe(false);
    expect(isSelected(entries.find((e) => e.id === 'module.bar_stool')!, st)).toBe(false);
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
    const h = c.attach({ setPreview: () => undefined, setAreas: () => undefined, setWorldGrid: () => undefined, setCutLine: () => undefined, setHover: () => undefined, setSites: () => undefined, setModuleGhost: () => undefined } as unknown as Renderer);
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
    h.onKey('rotate');
    expect(toolOf(c).rot).toBe(1);
    h.onKey('rotateBack');
    h.onKey('rotateBack');
    expect(toolOf(c).rot).toBe(3);
  });

  it.each(['escape', 'back'])('%s drops the placement first, then leaves build mode', (how) => {
    const { c, h } = setup();
    const press = () => (how === 'escape' ? c.cancel() : h.onContext(0, 0, false));
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

describe('combat start', () => {
  it('drops an active build tool, and canvas paints no longer reach the tools during the fight', () => {
    const sim2 = newGame(1, content);
    const bridge = { setSelected: () => undefined, setHovered: () => undefined, sites: createStore([]), yard: createStore({ plan: { ship: 0, tiles: [], connected: [], loose: [], blocked: [], floor: [], bad: [], hull: { now: 0, afterAll: 0, capacity: 0, max: 0 } }, quote: null, order: null }) } as unknown as Bridge;
    const c = createController(sim2, bridge);
    const h = c.attach({ setPreview: () => undefined, setAreas: () => undefined, setWorldGrid: () => undefined, setCutLine: () => undefined, setHover: () => undefined, setSites: () => undefined, setModuleGhost: () => undefined, setCutaway: () => undefined } as unknown as Renderer);
    c.setTool({ tool: 'deconstruct' });
    c.upkeep();
    expect(toolOf(c).tool).toBe('deconstruct'); // no fight: untouched
    sim2.sector.inCombat = true;
    expect(h.paintMode()).toBe(false);
    c.upkeep();
    expect(toolOf(c).tool).toBe('select');
    c.setTool({ tool: 'build', build: 'wall' });
    c.upkeep(); // still the same fight: no further reset (nothing in the UI offers tools, but the edge fires once)
    expect(toolOf(c).tool).toBe('build');
    sim2.sector.inCombat = false;
    c.upkeep();
    expect(h.paintMode()).toBe(true);
  });
});
