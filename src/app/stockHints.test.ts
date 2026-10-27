import { describe, expect, it } from 'vitest';
import { ShipC, galaxyIndex, hailVerdict, newGame, nodeOf, type Port, type Sim } from '../sim';
import { placementGapError } from '../sim/regions';
import { portsAt } from '../sim/galaxy/portIndex';
import { content } from '../content';
import { buildStarmap } from './starmapSnapshot';
import { buildTrade } from './tradeSnapshot';
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

/** Fly to a navy depot of a deep node (after `rep` navy reputation) and return the trade partner that is the depot. */
function atNavyDepot(rep: number): { sim: Sim; partner: ReturnType<typeof buildTrade>['partners'][number] | undefined } {
  const { sim, ports } = deep(1);
  const depot = ports.find((p) => p.owner === 'navy' && p.kind === 'depot')!;
  expect(depot).toBeDefined();
  sim.story.reputation['navy'] = rep;
  sim.enqueue({ type: 'debug.galaxyTeleport', node: depot.node });
  sim.step();
  const pk = sim.sector.packet!;
  for (let x = 0; x + pk.w <= sim.sector.width; x += 4) {
    let done = false;
    for (let y = 2; y + pk.h <= sim.sector.height && !done; y += 4) {
      if (placementGapError(sim, { x, y, w: pk.w, h: pk.h })) continue;
      sim.enqueue({ type: 'sector.deploy', x, y });
      sim.step();
      done = true;
    }
    if (done) break;
  }
  for (let i = 0; i < 25; i++) sim.step();
  return { sim, partner: buildTrade(sim).partners.find((p) => p.station && p.info?.owner?.name === 'Concord Navy') };
}

describe('navy depots', () => {
  it('are stations you can trade with at the navy\'s default standing, and show their stock', () => {
    const { sim, partner } = atNavyDepot(0);
    expect(partner).toBeDefined();
    expect(sim.world.get(partner!.id, ShipC)?.faction).toBe('neutral');
    expect(hailVerdict(sim, partner!.id).answers).toBe(true);
    expect(partner!.info?.hints).toContain('Mk II shield gens');
  });

  it('stay hostile once the navy is hostile to you', () => {
    const { sim, partner } = atNavyDepot(-10);
    expect(partner).toBeDefined();
    expect(sim.world.get(partner!.id, ShipC)?.faction).toBe('hostile');
    expect(hailVerdict(sim, partner!.id).answers).toBe(false);
  });
});
