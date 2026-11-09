import { AirlockC } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { vehicleSuits } from '../eva/shuttle';
import { airlockSuits, freeSuits } from '../eva/suit';
import type { Vehicle } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';

/**
 * A site's shuttle at home tops its suits back up to its complement from the home ship's airlocks (#404, user decision 2026-11-09): suits
 * lost or left behind would otherwise leave seats only crew who need no air can take. Each airlock keeps at least one suit (one nobody is
 * on the way to fetch), so the home ship can still send someone out. Airlocks in ascending id.
 */
export function restockSuits(sim: Sim, v: Vehicle): void {
  const full = vehicleDefOf(sim, v)?.eva?.suits ?? 0;
  if (vehicleSuits(sim, v) >= full) return;
  for (const id of [...sim.world.query(AirlockC)].sort((a, b) => a - b)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) !== v.homeShip) continue;
    const a = sim.world.get(id, AirlockC)!;
    while (vehicleSuits(sim, v) < full && airlockSuits(sim, id) > 1 && freeSuits(sim, id) > 1) {
      a.suits = airlockSuits(sim, id) - 1;
      v.suits = vehicleSuits(sim, v) + 1;
    }
    if (vehicleSuits(sim, v) >= full) return;
  }
}
