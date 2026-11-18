import { ShipC, homeShip } from '../../../sim';
import type { BuildCtx } from '../types';
import { enemyUpgradeCommands } from './upgrade';

/**
 * The enemy of the drone and upgrade fights: at engagement distance off the ship, trying the sides in turn until one is clear (a rock or a ship may be in the
 * way). `faction`: a generated ship of that faction (with its drone bay and defence drones) instead of the Lancer; `kind` 'upgrades' also fits it with upgrades.
 */
export function spawnFightEnemy(ctx: BuildCtx, opts: { kind: 'drones' | 'upgrades'; faction: string | null; depth: number }): void {
  const { sim } = ctx;
  const mine = sim.world.get(homeShip(sim), ShipC);
  const t = (ctx.content.ships as Record<string, { rows: readonly string[] }>)['ship.lancer'];
  if (!mine || !t) return;
  const w = Math.max(...t.rows.map((r) => r.length)), h = t.rows.length;
  const clamp = (x: number, y: number) => ({ x: Math.max(0, Math.min(sim.sector.width - w, x)), y: Math.max(0, Math.min(sim.sector.height - h, y)) });
  const spots = [
    clamp(mine.x + mine.width + 40, mine.y - 30), clamp(mine.x - w - 40, mine.y - 30),
    clamp(mine.x + mine.width + 40, mine.y + mine.height + 20), clamp(mine.x - w - 40, mine.y + mine.height + 20),
  ];
  const hostile = (): boolean => sim.world.query(ShipC).some((id) => sim.world.get(id, ShipC)?.faction === 'hostile');
  for (const p of spots) {
    if (hostile()) return;
    if (opts.faction) ctx.enqueue({ type: 'debug.spawnGenerated', faction: `faction.${opts.faction}`, depth: opts.depth, seed: 5, cx: p.x + 37, cy: p.y + 14 });
    else ctx.enqueue({ type: 'debug.spawnEnemy', template: 'ship.lancer', x: p.x, y: p.y });
    ctx.step(10);
    if (opts.kind === 'upgrades') {
      const enemy = sim.world.query(ShipC).find((id) => id !== homeShip(sim));
      if (enemy !== undefined) ctx.enqueue(...enemyUpgradeCommands(sim, enemy));
    }
  }
}
