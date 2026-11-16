import { describe, expect, it } from 'vitest';
import { ContainerC } from '../sim/containers/components';
import { ShipC } from '../sim/combat/components';
import { ItemStackC, StorageC } from '../sim/items/components';
import { currentNode, newGame, playerShip, populateCargo, type Sim } from '../sim';
import { lostCargoFaction } from '../sim/galaxy/populateCargo';
import { SalvageOrderC } from '../sim/salvage/components';
import { salvageJobs } from '../sim/salvage/plan';
import { performJob } from '../sim/crew/jobWork';
import { JobC } from '../sim/crew/components';
import { ModuleC } from '../sim/modules/components';
import { shipIdOf } from '../sim/regions';
import { playerCrew } from '../sim/story/world';
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

  it('marks a box for opening: it sits on a one-piece seat, still sealed, with a salvage order and a cutting job', () => {
    const { sim, ids } = setup(2, 4);
    const id = ids[0] as number;
    const stock = (sim.world.get(id, StorageC)?.stacks ?? []).map((s) => ({ ...s }));
    const seed = sim.world.get(id, ContainerC)!.seed;
    sim.enqueue({ type: 'container.open', id });
    sim.step();
    expect(sim.world.has(id, ContainerC)).toBe(false);
    const seat = sim.world.query(ShipC).find((s) => sim.world.get(s, ShipC)?.name === `Container ${id}`)!;
    expect(sim.world.get(seat, ShipC)?.state).toBe('wreck');
    expect(sim.world.has(seat, SalvageOrderC)).toBe(true);
    // Still sealed: the box is a module on its seat with its stock, nothing lies loose, and the art picks (variant, logo) are kept.
    const box = sim.world.query(ContainerC).find((c) => sim.world.has(c, ModuleC) && shipIdOf(sim, sim.world.get(c, ModuleC)) === seat)!;
    expect(sim.world.get(box, ContainerC)?.seed).toBe(seed);
    expect(sim.world.get(box, StorageC)?.stacks).toEqual(stock);
    expect(sim.world.query(ItemStackC).length).toBe(0);
    for (let i = 0; i < 3; i++) sim.step();
    const job = salvageJobs(sim, seat).map((j) => sim.world.get(j, JobC)!).find((j) => j.kind === 'moduleDecon');
    expect(job?.target).toBe(box);
    expect(job?.work).toBeGreaterThan(0);
  });

  it('opens only when the crew finish the cutting job, and then the goods lie loose', () => {
    const run = () => {
      const { sim, ids } = setup(2, 4);
      const id = ids[0] as number;
      const goods = (sim.world.get(id, StorageC)?.stacks ?? []);
      const item = goods[0]!.item;
      const total = goods.reduce((n, s) => n + s.count, 0);
      sim.enqueue({ type: 'container.open', id });
      for (let i = 0; i < 5; i++) sim.step();
      const seat = sim.world.query(ShipC).find((s) => sim.world.get(s, ShipC)?.name === `Container ${id}`)!;
      const jobId = salvageJobs(sim, seat).find((j) => sim.world.get(j, JobC)?.kind === 'moduleDecon')!;
      const job = sim.world.get(jobId, JobC)!;
      const crew = playerCrew(sim)[0] as number;
      let ticks = 0;
      while (performJob(sim, crew, job, 1) !== 'done') {
        ticks++;
        expect(sim.world.query(ItemStackC).length).toBe(0); // nothing is out until the work is done
      }
      const lying = sim.world.query(ItemStackC).reduce((n, s) => n + (sim.world.get(s, ItemStackC)?.item === item ? sim.world.get(s, ItemStackC)!.count : 0), 0);
      return { ticks, lying, total };
    };
    const a = run();
    expect(a.ticks).toBeGreaterThan(50);
    expect(a.lying).toBe(a.total);
    expect(run()).toEqual(a); // deterministic
  });

  it('refuses to open anything that is not a drifting container', () => {
    const sim = newGame(3, content);
    sim.enqueue({ type: 'container.open', id: playerShip(sim) });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'command.rejected')).toBe(true);
  });
});
