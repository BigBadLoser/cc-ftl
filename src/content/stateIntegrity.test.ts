import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, ModuleC, StorageC, galaxyIndex, newGame, playerShip, type Sim } from '../sim';
import { stepDistress } from '../sim/galaxy/stranded';
import { refund } from '../sim/yard/money';
import type { YardOrder } from '../sim/yard/types';
import { playerStock } from '../sim/story/world';
import { withHeld } from '../sim/items/held';
import { spillItems } from '../sim/items/stacks';
import { shipIdOf } from '../sim/regions';
import { giveItems } from '../sim/story/effects';
import { content } from '.';

/** Issue #160: a second representation of goods (grid ids, escrow, stock) must follow the entity. */

/** The player's ship in hyperspace, with `n` loose units of `item` on its deck beforehand. */
function inHyperspaceWithLoose(item: string, n: number): Sim {
  const sim = newGame(11, content);
  giveItems(sim, 'item.fuel', 40);
  const ship = playerShip(sim);
  const at = sim.world.query(ModuleC).map((id) => sim.world.get(id, ModuleC)!).find((m) => shipIdOf(sim, m) === ship)!;
  expect(spillItems(sim, ship, at.x, at.y, item, n)).toBe(0);
  const combat = sim.world.get(ship, CombatC);
  if (combat) combat.ftl = FTL_CHARGE_SEC;
  const next = (galaxyIndex(sim.galaxy).adjacent.get(sim.galaxy.current) ?? []).map((e) => (e.a === sim.galaxy.current ? e.b : e.a)).sort()[0]!;
  sim.enqueue({ type: 'galaxy.jump', ship, route: [next] });
  for (let i = 0; i < 2000 && sim.sector.state !== 'hyperspace'; i++) sim.step();
  expect(sim.sector.state).toBe('hyperspace');
  return sim;
}

/** Every non-zero item-grid id of the packet names an itemStack entity in it. */
function danglingItemIds(sim: Sim): number[] {
  const p = sim.sector.packet!;
  const have = new Set(p.entities.filter((e) => e.c['itemStack']).map((e) => e.id));
  return (p.tiles['item'] ?? []).filter((v) => v !== 0 && !have.has(v));
}

describe('packet item grid', () => {
  it('seizing a loose stack in hyperspace leaves no dangling item-grid id', () => {
    const sim = inHyperspaceWithLoose('item.stolen_goods', 3);
    expect(sim.sector.packet!.entities.some((e) => (e.c['itemStack'] as { item: string } | undefined)?.item === 'item.stolen_goods')).toBe(true);
    withHeld(sim, (held) => { for (const h of held) if (h.item === 'item.stolen_goods') h.remove(); });
    expect(sim.sector.packet!.entities.some((e) => (e.c['itemStack'] as { item: string } | undefined)?.item === 'item.stolen_goods')).toBe(false);
    expect(danglingItemIds(sim)).toEqual([]);
  });
});

describe('refunds and deliveries that need a floor', () => {
  const dropStorage = (sim: Sim): void => {
    for (const id of sim.world.query(StorageC)) sim.world.destroyEntity(id);
  };

  it('a yard refund with no storage left still returns the metal (to the deck beside any module)', () => {
    const sim = newGame(11, content);
    dropStorage(sim);
    const before = playerStock(sim, 'item.metal');
    const o = { ship: playerShip(sim), held: { credits: 0, metal: 10 } } as YardOrder;
    expect(refund(sim, o, { credits: 0, metal: 10 }).metal).toBe(10);
    expect(playerStock(sim, 'item.metal')).toBe(before + 10);
    expect(o.held.metal).toBe(0);
  });

  it('a yard refund that finds no room anywhere keeps the metal held and reports only what went back', () => {
    const sim = newGame(11, content);
    for (const id of sim.world.query(ModuleC)) sim.world.destroyEntity(id);
    const o = { ship: playerShip(sim), held: { credits: 0, metal: 10 } } as YardOrder;
    expect(refund(sim, o, { credits: 0, metal: 10 }).metal).toBe(0);
    expect(o.held.metal).toBe(10);
  });

  it('the distress tug charges only for the fuel it could set down', () => {
    const sim = newGame(11, content);
    for (const id of sim.world.query(ModuleC)) sim.world.destroyEntity(id);
    sim.trade.credits = 100000;
    sim.galaxy.distress = { node: sim.galaxy.current, sent: 0, due: 0 };
    const rep = sim.story.reputation['traders'];
    stepDistress(sim, 1);
    expect(sim.trade.credits).toBe(100000);
    expect(sim.story.reputation['traders']).toBe(rep); // nothing owed for fuel that never came
  });
});
