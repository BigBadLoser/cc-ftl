import { describe, expect, it } from 'vitest';
import { ContainerC } from '../sim/containers/components';
import { ShipC } from '../sim/combat/components';
import { ItemStackC, StorageC } from '../sim/items/components';
import { currentNode, newGame, playerShip, populateCargo, type Sim } from '../sim';
import { lostCargoFaction } from '../sim/galaxy/populateCargo';
import { SalvageOrderC } from '../sim/salvage/components';
import { content } from '.';

/** Lost cargo (#503): loose sealed containers in a node, wearing the livery of the faction that lost them, cut open into a salvageable deck. */

function setup(tier = 0, seed = 7): { sim: Sim; ids: number[] } {
  const sim = newGame(3, content);
  const node = currentNode(sim)!;
  const before = new Set(sim.world.query(ContainerC));
  const ship = sim.world.get(playerShip(sim), ShipC)!;
  populateCargo(sim, { ...node, danger: tier }, seed, { x: ship.x + ship.width + 12, y: ship.y });
  return { sim, ids: sim.world.query(ContainerC).filter((id) => !before.has(id)) };
}

describe('lost cargo', () => {
  it('makes one or two drifting containers with goods and a faction', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { sim, ids } = setup(0, seed);
      expect(ids.length).toBeGreaterThanOrEqual(1);
      expect(ids.length).toBeLessThanOrEqual(2);
      for (const id of ids) {
        const c = sim.world.get(id, ContainerC)!;
        expect(c.state).toBe('drifting');
        expect(Object.keys(content.factions)).toContain(c.faction);
        expect((sim.world.get(id, StorageC)?.stacks ?? []).length).toBeGreaterThan(0);
      }
    }
  });

  it("picks the owner faction by one rule: the node's own, else a trading one, never pirates", () => {
    const sim = newGame(3, content);
    const node = { ...currentNode(sim)!, faction: null };
    const seen = new Set<string>();
    for (let s = 0; s < 200; s++) seen.add(lostCargoFaction(sim, node, s) ?? 'none');
    expect(seen.has('none')).toBe(false);
    for (const f of seen) expect(f).not.toMatch(/pirate|raider|rogue|drone/);
    expect(lostCargoFaction(sim, node, 5)).toBe(lostCargoFaction(sim, node, 5));
  });

  it('opens into a small wreck deck holding the goods, which a salvage order accepts', () => {
    const { sim, ids } = setup(2, 4);
    const id = ids[0] as number;
    const total = (sim.world.get(id, StorageC)?.stacks ?? []).reduce((n, s) => n + s.count, 0);
    sim.enqueue({ type: 'container.open', id });
    sim.step();
    expect(sim.world.has(id, ContainerC)).toBe(false);
    const deck = sim.world.query(ShipC).find((s) => sim.world.get(s, ShipC)?.name === 'Opened container')!;
    expect(sim.world.get(deck, ShipC)?.state).toBe('wreck');
    const lying = sim.world.query(ItemStackC).reduce((n, s) => n + (sim.world.get(s, ItemStackC)?.count ?? 0), 0);
    expect(lying).toBeGreaterThanOrEqual(total);
    sim.enqueue({ type: 'salvage.order', ship: deck, types: ['hull'] });
    sim.step();
    expect(sim.world.has(deck, SalvageOrderC)).toBe(true);
  });

  it('refuses to open anything that is not a drifting container', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'container.open', id: playerShip(sim) });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'command.rejected')).toBe(true);
  });
});
