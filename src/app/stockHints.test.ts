import { describe, expect, it } from 'vitest';
import { galaxyIndex, newGame, nodeOf, type Port, type Sim } from '../sim';
import { portsAt } from '../sim/galaxy/portIndex';
import { content } from '../content';
import { buildStarmap } from './starmapSnapshot';
import { nodeHints, portHints } from './stockHints';

/** A game with the whole revealed galaxy at the deepest danger tier, and its ports. */
function deep(seed: number): { sim: Sim; ports: Port[] } {
  const sim = newGame(seed, content);
  sim.step();
  sim.enqueue({ type: 'debug.galaxyReveal', radius: 14 });
  sim.step();
  const nodes = [...galaxyIndex(sim.galaxy).nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const n of nodes) (nodeOf(sim, n.id) as { danger: number }).danger = 9;
  return { sim, ports: nodes.flatMap((n) => portsAt(sim, n.id)) };
}

const structureOf = (sim: Sim, p: Port): string => nodeOf(sim, p.node)!.structures[Number(p.id.slice(p.id.indexOf('#') + 1))]!.def;

describe('stock hints', () => {
  it('names the best new blueprint of each line at a navy depot, and what standing holds back', () => {
    const { sim, ports } = deep(1);
    const depot = ports.find((p) => p.owner === 'navy' && structureOf(sim, p) === 'structure.station_military')!;
    expect(depot).toBeDefined();
    // Standing 1: Mk II shield gens are for sale, Mk III wait for a friend.
    expect(portHints(sim, depot)).toEqual(['Mk II shield gens', 'Mk III shield gens need standing']);
    sim.story.reputation['navy'] = 3;
    expect(portHints(sim, depot)).toEqual(['Mk III shield gens']);
    sim.story.blueprints.push('module.shieldGen.mk2', 'module.shieldGen.mk3');
    expect(portHints(sim, depot)).toEqual([]);
  });

  it('points out Meridian\'s cheap fuel at its trading stations and nowhere else', () => {
    const { sim, ports } = deep(1);
    const meridian = ports.find((p) => p.owner === 'meridian' && p.trade);
    const other = ports.find((p) => p.owner === 'vantor' && p.trade);
    expect(meridian).toBeDefined();
    expect(portHints(sim, meridian!)).toContain('Cheap fuel');
    if (other) expect(portHints(sim, other)).not.toContain('Cheap fuel');
  });

  it('gives a node the hints of its ports, and the starmap carries them for known nodes only', () => {
    const { sim, ports } = deep(1);
    const depot = ports.find((p) => p.owner === 'navy' && structureOf(sim, p) === 'structure.station_military')!;
    expect(nodeHints(sim, depot.node)).toEqual(expect.arrayContaining(['Mk II shield gens']));
    sim.galaxy.discovered[depot.node] ??= sim.galaxy.turn;
    sim.galaxy.rev++;
    const node = buildStarmap(sim).nodes.find((n) => n.id === depot.node)!;
    expect(node.hints).toEqual(nodeHints(sim, depot.node));
    const fresh = buildStarmap(newGame(1, content));
    const unknown = fresh.nodes.find((n) => !n.known)!;
    expect(unknown.hints).toEqual([]);
  });
});
