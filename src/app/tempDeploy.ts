import { placementGapError } from '../sim/regions';
import type { Sim } from '../sim';
import { PLAYER_START } from '../sim/tuning';

/**
 * TEMP (remove in step 9b, which brings the deploy picker): while the player's ship waits in state 'deploying', place it at the
 * first free spot on rings around where a new game starts the ship (`PLAYER_START`, where the camera already looks) (the same bounds and gap rule `sector.deploy` checks), so a starmap
 * jump is playable before the deploy modal exists. Queues `sector.deploy`; call once per update.
 */
export function tempAutoDeploy(sim: Sim): void {
  const p = sim.sector.packet;
  if (sim.sector.state !== 'deploying' || !p) return;
  const cx = PLAYER_START.x;
  const cy = PLAYER_START.y;
  for (let r = 0; r < 400; r += 8) {
    for (let k = 0; k < (r === 0 ? 1 : 16); k++) {
      const a = (k * 2 * Math.PI) / 16;
      const x = Math.round(cx + r * Math.cos(a));
      const y = Math.round(cy + r * 0.6 * Math.sin(a));
      if (x < 0 || y < 0 || x + p.w > sim.sector.width || y + p.h > sim.sector.height) continue;
      if (placementGapError(sim, { x, y, w: p.w, h: p.h })) continue;
      sim.enqueue({ type: 'sector.deploy', x, y });
      return;
    }
  }
}
