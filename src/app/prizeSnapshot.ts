import { shipIdOf } from '../sim/regions';
import { AllegianceC, CrewC, DeadC, DownedC, HealthC, PositionC, PrisonerC, PrizeC, ShipC, prizeValue, type Sim } from '../sim';
import type { UiPrize } from '../ui/api';

/** Plain-data list of captured ships (prizes) with their prisoners and the player's crew still aboard. Reads the sim only. */
export function buildPrizes(sim: Sim): UiPrize[] {
  const out: UiPrize[] = [];
  for (const id of sim.world.query(ShipC, PrizeC)) {
    const ship = sim.world.get(id, ShipC);
    const prize = sim.world.get(id, PrizeC);
    if (!ship || !prize || ship.state !== 'prize') continue;
    const prisoners: UiPrize['prisoners'] = [];
    let aboard = 0;
    for (const c of sim.world.query(CrewC, PositionC)) {
      const crew = sim.world.get(c, CrewC);
      if (!crew || shipIdOf(sim, sim.world.get(c, PositionC)) !== id || sim.world.has(c, DeadC)) continue;
      if (sim.world.has(c, PrisonerC)) {
        const hp = sim.world.get(c, HealthC);
        prisoners.push({
          id: c, name: crew.name, role: sim.content.roles[crew.role]?.name ?? crew.role, hp: Math.round(hp?.hp ?? 0), maxHp: hp?.max ?? 0,
          state: sim.world.has(c, DownedC) ? 'downed' : 'surrendered',
        });
      } else if (sim.world.get(c, AllegianceC)?.faction === 'player') aboard++;
    }
    out.push({ ship: id, name: ship.name, from: prize.from, value: prizeValue(sim, id), prisoners, crewAboard: aboard });
  }
  return out;
}
