import { describe, expect, it } from 'vitest';
import { galaxyIndex, newGame, playerShip, type Sim } from '../sim';
import { ensureAround } from '../sim/galaxy/state';
import { content } from '../content';
import { buildCombat } from './combatSnapshot';
import { buildDeploy, buildJumpWarnings, deployError } from './deploySnapshot';

/** A new game teleported to a node with generated ships, waiting to deploy. */
function waiting(): Sim {
  const sim = newGame(11, content);
  ensureAround(sim, 's.12.0.n0');
  const node = [...galaxyIndex(sim.galaxy).nodes.values()].filter((n) => n.danger >= 3 && n.contacts.length > 0).sort((a, b) => (a.id < b.id ? -1 : 1))[0]!;
  sim.enqueue({ type: 'debug.galaxyTeleport', node: node.id });
  sim.step();
  return sim;
}

describe('deploy picker data', () => {
  it('lists the ships already there and suggests a spot the gap rule accepts', () => {
    const sim = waiting();
    const d = buildDeploy(sim)!;
    expect(d.others.length).toBeGreaterThan(0);
    expect(d.ship.w).toBeGreaterThan(0);
    expect(d.suggested).not.toBeNull();
    expect(deployError(sim, d.suggested!.x, d.suggested!.y)).toBeNull();
    expect(d.others[0]!.frame.w).toBeGreaterThan(d.others[0]!.w);
  });

  it('validates spots: bounds, overlap, closeness, and non-tiles', () => {
    const sim = waiting();
    const d = buildDeploy(sim)!;
    const o = d.others[0]!;
    expect(deployError(sim, -1, 0)).toBe('outOfBounds');
    expect(deployError(sim, d.width, 0)).toBe('outOfBounds');
    expect(deployError(sim, 0.5, 0)).toBe('badValue');
    expect(deployError(sim, Math.max(0, o.x), Math.max(0, o.y))).toBe('overlap');
    // Just outside the ship but inside its frame: too close. Every spot the picker would highlight agrees with the command's own check.
    let tooClose = 0;
    for (let y = 0; y + d.ship.h <= d.height; y += 6) for (let x = 0; x + d.ship.w <= d.width; x += 6) if (deployError(sim, x, y) === 'tooClose') tooClose++;
    expect(tooClose).toBeGreaterThan(0);
    sim.enqueue({ type: 'sector.deploy', x: Math.max(0, o.x), y: Math.max(0, o.y) });
    sim.step();
    expect(sim.sector.state).toBe('deploying');
    sim.enqueue({ type: 'sector.deploy', x: d.suggested!.x, y: d.suggested!.y });
    sim.step();
    expect(sim.sector.state).toBe('active');
    expect(buildDeploy(sim)).toBeNull();
    expect(deployError(sim, 0, 0)).toBe('notDeploying');
  });

  it('lists crew away from the ship by name for the jump confirm', () => {
    const sim = newGame(3, content);
    expect(buildJumpWarnings(sim, playerShip(sim))).toEqual({ crew: [], vehicles: [], hostileDocked: [] });
  });

  it('shows no combat while the ship waits to deploy, whatever is placed in the empty sector', () => {
    const sim = waiting();
    expect(sim.sector.state).toBe('deploying');
    expect(buildCombat(sim)).toEqual({ inCombat: false, player: null, enemies: [] });
  });
});
