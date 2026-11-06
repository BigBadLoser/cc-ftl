import { ShipC } from '../combat/components';
import { strHash, unit } from '../galaxy/hash';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { playerShips } from '../story/world';

/** Deeper ships carry more: the chance of an entry is scaled by this, from 0.6 at depth 0 up to 1. */
const depthScale = (depth: number): number => Math.min(1, 0.6 + 0.1 * depth);

/**
 * Enemy loadouts. A generated ship's weapon modules carry upgrades by their faction (`FactionDef.upgrades`: navy precise, pirates crude), once, the
 * first tick the ship is seen. Each module rolls each entry in order and takes the first that hits; the rolls are a hash of the ship's seed
 * and the module's place, so a seed always carries the same guns and the sim's rng stream is untouched.
 */
export function enemyLoadoutSystem(sim: Sim): void {
  for (const shipId of sim.world.query(ShipC)) {
    const ship = sim.world.get(shipId, ShipC);
    if (!ship?.gen || ship.upgraded || ship.faction === 'player' || playerShips(sim).has(shipId)) continue;
    ship.upgraded = true;
    const table = sim.content.factions?.[ship.gen.faction]?.upgrades;
    if (!table?.length) continue;
    const scale = depthScale(ship.gen.depth);
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC);
      const def = m && sim.content.modules[m.def];
      if (!m || !def?.weapon || !def.upgradeSlot || m.upgrade || shipIdOf(sim, m) !== shipId) continue;
      const at = strHash(`${m.def}|${m.x}|${m.y}`);
      const pick = table.find((e, k) => {
        const up = sim.content.items[e.item]?.upgrade;
        const fits = up && up.slot === def.upgradeSlot && (!up.fits || up.fits.includes(m.def) || up.fits.includes(def.weapon ?? ''));
        return fits && unit(ship.gen?.seed ?? 0, at, k, 0x7ee) < e.chance * scale;
      });
      if (pick) m.upgrade = pick.item;
    }
  }
}

/**
 * A weapon module on another ship is being stripped (salvage): its fitted upgrade comes out with it, unless the hit that wrecked it took it too.
 * A destroyed module always loses it; a damaged one loses it with a chance equal to its damage (half hp, an even chance). What is kept is spilled by
 * `removeModule`.
 */
export function stripUpgrade(sim: Sim, moduleId: number): void {
  const m = sim.world.get(moduleId, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m?.upgrade || !def || playerShips(sim).has(shipIdOf(sim, m))) return;
  if (m.hp > 0 && !sim.rng.chance(1 - m.hp / def.maxHp)) return;
  sim.events.emit({ type: 'module.upgradeLost', moduleId, item: m.upgrade });
  delete m.upgrade;
}
