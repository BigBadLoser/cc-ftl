import { describe, expect, it } from 'vitest';
import { report as reportNews } from '../sim/galaxy/news';
import { galaxyIndex } from '../sim/galaxy/state';
import { newGame } from '../sim/newGame';
import { nodesWithin } from '../sim/galaxy/fleets';
import { content } from '../content';
import { buildStarmap } from './starmapSnapshot';

describe('the news feed in the starmap', () => {
  it('names ships and places for news inside sensor range, and only factions and the region for a rumour', () => {
    const sim = newGame(21, content);
    const near = [...nodesWithin(sim, sim.galaxy.current, 1)].find(([, d]) => d === 1)![0];
    let far = '';
    for (const [id, d] of nodesWithin(sim, sim.galaxy.current, 6)) if (d === 6) far = id;
    reportNews(sim, { kind: 'destroyed', node: near, who: 'CNS Valiant', faction: 'navy', foe: 'Rust Jackal', foeFaction: 'pirates' });
    reportNews(sim, { kind: 'destroyed', node: far, who: 'CNS Gallant', faction: 'navy', foe: 'Rust Hound', foeFaction: 'pirates' });
    reportNews(sim, { kind: 'shortage', node: near, who: 'Lucky Margin', faction: 'traders', item: 'item.metal' });
    const news = buildStarmap(sim).news;
    expect(news.length).toBe(3);
    const nearby = news.filter((n) => !n.rumour);
    expect(nearby.map((n) => n.text)).toContain('CNS Valiant destroyed Rust Jackal');
    expect(nearby.some((n) => /is short of Metal/.test(n.text))).toBe(true);
    const rumour = news.find((n) => n.rumour)!;
    expect(rumour.text).toMatch(/Concord Navy and Scrapper Clans ships fought near/);
    expect(rumour.text).not.toMatch(/CNS Gallant|Rust Hound/);
    expect(news[0]!.id).toBeGreaterThan(news[2]!.id);
    expect(galaxyIndex(sim.galaxy).nodes.has(near)).toBe(true);
  });

  it('words a war and a peace, for the place in range and as a rumour from afar', () => {
    const sim = newGame(21, content);
    const near = [...nodesWithin(sim, sim.galaxy.current, 1)].find(([, d]) => d === 1)![0];
    let far = '';
    for (const [id, d] of nodesWithin(sim, sim.galaxy.current, 6)) if (d === 6) far = id;
    reportNews(sim, { kind: 'war', node: near, who: '', faction: 'navy', foeFaction: 'meridian' });
    reportNews(sim, { kind: 'peace', node: far, who: '', faction: 'meridian', foeFaction: 'helix' });
    const texts = buildStarmap(sim).news.map((n) => n.text);
    expect(texts.some((t) => /Concord Navy declared war on Meridian/.test(t))).toBe(true);
    expect(texts.some((t) => /have made peace/.test(t))).toBe(true);
  });

  it('is empty in a fresh game and bounded in a long one', () => {
    const sim = newGame(21, content);
    expect(buildStarmap(sim).news).toEqual([]);
    for (let i = 0; i < 60; i++) reportNews(sim, { kind: 'clash', node: sim.galaxy.current, who: `A${i}`, faction: 'navy', foe: `B${i}`, foeFaction: 'pirates' });
    expect(buildStarmap(sim).news.length).toBeLessThanOrEqual(14);
  });
});
