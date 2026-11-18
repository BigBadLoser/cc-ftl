import { PositionC, homeShip, shipGrid, Struct, type Command } from '../../../sim';
import { organicCrew, pickCrew } from '../lib/crewPick';
import { definePart } from '../types';

type BreakCmd = Extract<Command, { type: 'debug.breakCrew' }>;
type SetCmd = Extract<Command, { type: 'debug.setCrew' }>;

export interface CrewEdit {
  /** Which of the player's organic crew: an index, or a role id (the first of that role, else the first crew member). */
  who: number | string;
  /** Traits, xp, rifle in hand, needs, hp (`debug.setCrew`). */
  set?: Omit<SetCmd, 'type' | 'id'>;
  /** Start a mental break now (`debug.breakCrew`). */
  break?: { kind: BreakCmd['kind']; context?: BreakCmd['context']; sec?: number };
  /** What this crew member thinks of the others (indexes among the organic crew), both ways (`debug.bond`). */
  bonds?: readonly { with: number; delta: number; reason: string }[];
  /** A fire two or three tiles from them, for a panic to flee (`debug.ignite`; first of the commands). */
  fireNear?: boolean;
  /** Items dropped on their tile (`debug.spawnItems`). */
  drop?: Record<string, number>;
}
declare module '../types' { interface ScenarioSpec { crew?: readonly CrewEdit[] } }



/** Edits to the player's crew: traits and xp, breaks, bonds, a fire to flee, goods at hand. All through debug commands. */
export default definePart<'crew'>({
  key: 'crew',
  after: ['ship', 'node', 'items', 'prep', 'modules'],
  apply(ctx, edits) {
    const { sim } = ctx;
    const mine = organicCrew(sim);
    const ship = homeShip(sim);
    const cmds: Command[] = [];
    for (const e of edits) {
      const id = pickCrew(sim, e.who);
      if (id === undefined) continue;
      if (e.fireNear) {
        const first = sim.world.get(id, PositionC);
        const grid = shipGrid(sim, ship);
        for (let d = 2; first && grid && d <= 3; d++) {
          const t = [[d, 0], [-d, 0], [0, d], [0, -d]].map(([dx, dy]) => ({ x: Math.round(first.x) + dx!, y: Math.round(first.y) + dy! }))
            .find((c) => grid.inBounds(c.x, c.y) && grid.get('struct', c.x, c.y) === Struct.Floor && !grid.get('module', c.x, c.y));
          if (t) { cmds.unshift({ type: 'debug.ignite', ship, x: t.x, y: t.y }); break; }
        }
      }
      if (e.set) cmds.push({ type: 'debug.setCrew', id, ...e.set });
      if (e.break) cmds.push({ type: 'debug.breakCrew', id, ...e.break });
      for (const b of e.bonds ?? []) {
        const other = mine[b.with];
        if (other !== undefined) cmds.push({ type: 'debug.bond', a: id, b: other, delta: b.delta, reason: b.reason });
      }
      const at = e.drop ? sim.world.get(id, PositionC) : undefined;
      if (at) for (const [item, count] of Object.entries(e.drop!)) cmds.push({ type: 'debug.spawnItems', ship, x: at.x, y: at.y, item, count });
    }
    ctx.enqueue(...cmds);
    if (cmds.length) ctx.step();
  },
});
