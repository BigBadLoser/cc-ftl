import { ShipC, homeShip, type Command } from '../../../sim';
import { MIN_SHIP_GAP, REGION_PAD } from '../../../sim/tuning';
import { definePart } from '../types';

/** Ships present in the node beside the player's, spawned through `debug.spawn*` (a rejected spawn overlaps something: the build says so in `rejected`). */
export type ShipSpawn =
  | { kind: 'enemy'; template: string; at: readonly [number, number] }
  | { kind: 'generated'; faction: string; depth: number; seed: number; at: readonly [number, number] }
  | { kind: 'derelict'; faction: string; depth: number; seed: number; at: readonly [number, number]; intensity: number; cause: 'combat' | 'decay' }
  /** A raider level with the player's ship, just past the padded gap (`far`: a typical engagement distance, 55 tiles east and 45 north). */
  | { kind: 'raider'; far?: boolean; boarders?: boolean };
declare module '../types' { interface ScenarioSpec { ships?: readonly ShipSpawn[] } }

export default definePart<'ships'>({
  key: 'ships',
  after: ['ship', 'node', 'items', 'prep'],
  apply(ctx, spawns) {
    const { sim } = ctx;
    for (const s of spawns) {
      let cmd: Command | undefined;
      if (s.kind === 'enemy') cmd = { type: 'debug.spawnEnemy', template: s.template, x: s.at[0], y: s.at[1] };
      else if (s.kind === 'generated') cmd = { type: 'debug.spawnGenerated', faction: s.faction, depth: s.depth, seed: s.seed, cx: s.at[0], cy: s.at[1] };
      else if (s.kind === 'derelict') cmd = { type: 'debug.spawnDerelict', faction: s.faction, depth: s.depth, seed: s.seed, cx: s.at[0], cy: s.at[1], intensity: s.intensity, cause: s.cause };
      else {
        const template = s.boarders ? 'ship.raiderBoarder' : 'ship.raider';
        const mine = sim.world.get(homeShip(sim), ShipC);
        const t = ctx.content.ships[template];
        if (!mine || !t) continue;
        const w = Math.max(...t.rows.map((r) => r.length));
        const h = t.rows.length;
        const cy = mine.y + mine.height / 2;
        const x = Math.min(sim.sector.width - w, mine.x + mine.width + (s.far ? 55 : MIN_SHIP_GAP + 2 * REGION_PAD + 4));
        const y = Math.min(sim.sector.height - h, Math.max(0, Math.round(cy - h / 2) - (s.far ? 45 : 0)));
        cmd = { type: 'debug.spawnEnemy', template, x, y };
      }
      ctx.enqueue(cmd);
      ctx.step();
    }
  },
});
