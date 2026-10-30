import { describe, expect, it } from 'vitest';
import { needsMenu, orderChoices } from './orders';

describe('order choices', () => {
  it('a bare floor tile offers just walking, with no menu', () => {
    const c = orderChoices({ walk: true });
    expect(c.map((x) => x.id)).toEqual(['walk']);
    expect(needsMenu(c)).toBe(false);
  });

  it('an enemy on a floor tile offers attack and walk, so it asks', () => {
    const c = orderChoices({ foe: { id: 5, name: 'Raider' }, walk: true });
    expect(c.map((x) => x.id)).toEqual(['attack', 'walk']);
    expect(c[0]?.label).toBe('Attack Raider');
    expect(needsMenu(c)).toBe(true);
  });

  it('a console tile offers man station before walk; a shuttle offers boarding', () => {
    expect(orderChoices({ station: { module: 1, name: 'weapons console' }, walk: true }).map((x) => x.id)).toEqual(['man', 'walk']);
    expect(orderChoices({ shuttle: { vehicle: 2, name: 'Shuttle' }, walk: true }).map((x) => x.id)).toEqual(['board', 'walk']);
  });

  it('a shuttle seen in flight, with no floor under it, is a lone choice and runs at once', () => {
    const c = orderChoices({ shuttle: { vehicle: 2, name: 'Shuttle' } });
    expect(c.map((x) => x.id)).toEqual(['board']);
    expect(needsMenu(c)).toBe(false);
  });

  it('nothing under the cursor offers nothing', () => {
    expect(orderChoices({})).toEqual([]);
  });

  it('a hostile module is sabotaged by the right-click itself, with no menu', () => {
    const c = orderChoices({ sabotage: { module: 9, name: 'reactor' }, walk: true });
    expect(c.map((x) => x.id)).toEqual(['sabotage']);
    expect(c[0]?.label).toBe('Sabotage reactor');
    expect(needsMenu(c)).toBe(false);
  });

  it('with a foe under the cursor, sabotage stays a menu entry', () => {
    const c = orderChoices({ foe: { id: 5, name: 'Raider' }, sabotage: { module: 9, name: 'reactor' }, walk: true });
    expect(c.map((x) => x.id)).toEqual(['attack', 'sabotage', 'walk']);
    expect(needsMenu(c)).toBe(true);
  });
});
