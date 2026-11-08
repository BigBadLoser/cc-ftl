import { describe, expect, it } from 'vitest';
import { CrewC, ModuleC, newGame, playerShip, storageCount } from '../sim';
import { AllegianceC } from '../sim/fight/components';
import { CarryingC } from '../sim/items/components';
import { spillItems } from '../sim/items/stacks';
import { storageAdd } from '../sim/items/storage';
import { takeItems } from '../sim/story/effects';
import { playerStock, playerStorages } from '../sim/story/world';
import { content } from './index';

const ITEM = 'item.metal';

/** Counts that read "what the player holds" (heldItems): storage and loose stacks only, delivery crates included, carried loads not. */
describe('player stock over heldItems', () => {
  function stocked() {
    const sim = newGame(7, content);
    for (let i = 0; i < 5; i++) sim.step();
    const hold = playerStorages(sim)[0] as number;
    const m = sim.world.get(hold, ModuleC)!;
    const before = playerStock(sim, ITEM);
    expect(storageAdd(sim, hold, ITEM, 6)).toBe(6);
    expect(spillItems(sim, playerShip(sim), m.x, m.y, ITEM, 4)).toBe(0);
    const crew = sim.world.query(CrewC).find((i) => sim.world.get(i, AllegianceC)?.faction === 'player') as number;
    sim.world.add(crew, CarryingC, { item: ITEM, count: 5 });
    return { sim, hold, before };
  }

  it('counts storage and loose stacks, not what a crew member carries', () => {
    const { sim, before } = stocked();
    expect(playerStock(sim, ITEM)).toBe(before + 10);
  });

  it('takes from storage first, then loose stacks, and reports the units taken', () => {
    const { sim, hold, before } = stocked();
    const inHold = storageCount(sim, hold, ITEM);
    expect(takeItems(sim, ITEM, inHold + 3)).toBe(inHold + 3);
    expect(storageCount(sim, hold, ITEM)).toBe(0);
    expect(playerStock(sim, ITEM)).toBe(before + 10 - (inHold + 3));
    expect(takeItems(sim, ITEM, 999)).toBe(before + 10 - (inHold + 3));
    expect(playerStock(sim, ITEM)).toBe(0);
  });
});
