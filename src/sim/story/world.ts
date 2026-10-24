import { shipIdAt , shipIdOf } from '../regions';
import { CrewC, DeadC } from '../crew/components';
import { ShipC } from '../combat/components';
import { AllegianceC, SurrenderedC } from '../fight/components';
import { ItemStackC, StorageC } from '../items/components';
import { storageCount } from '../items/storage';
import { ModuleC } from '../modules/components';
import type { SkillName } from '../registry';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { ImplantsC } from './components';

const aboard = new WeakSet<Sim>();

/** True inside `withPlayerAboard` while the player's ship is a hyperspace packet: its entities are in the world for the moment. */
export const inPacketView = (sim: Sim): boolean => aboard.has(sim);

/**
 * The one accessor that makes the story layer packet-aware. While the ship is in hyperspace its crew, cargo and modules are packet data, not
 * world entities, so every query below would see nothing. Inside this call the packet's entities are put back in the world under their own ids
 * (a ship in a packet sits at (0, 0), so the rect fallback of `shipIdAt` finds it on the empty hyperspace grid), `fn` reads and mutates them
 * as it would aboard a ship in a node, and they are lifted back into the packet afterwards (changed, or gone if destroyed). Re-entrant, and
 * a plain call to `fn` when the ship is in a node. Story code wraps its entry points (`meets`, `eligible`, `checkOdds`, `applyEffect`, ...) once.
 */
export function withPlayerAboard<T>(sim: Sim, fn: () => T): T {
  const packet = sim.sector.state === 'hyperspace' ? sim.sector.packet : null;
  if (!packet || aboard.has(sim)) return fn();
  aboard.add(sim);
  for (const e of packet.entities) sim.world.restore(e.id, e.c);
  try {
    return fn();
  } finally {
    packet.entities = packet.entities.flatMap((e) => {
      const c = sim.world.detach(e.id);
      return Object.keys(c).length ? [{ id: e.id, c }] : [];
    });
    aboard.delete(sim);
  }
}

/** Living, free crew on the player's side (anywhere: ships, shuttles). Ascending id. */
export function playerCrew(sim: Sim): number[] {
  return sim.world.query(CrewC, AllegianceC).filter(
    (id) => sim.world.get(id, AllegianceC)?.faction === 'player' && !sim.world.has(id, DeadC) && !sim.world.has(id, SurrenderedC),
  );
}

/** Ship ids of ships the player owns (active, disabled or prize; not wrecks). */
export function playerShips(sim: Sim): Set<number> {
  const out = new Set<number>();
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (s?.faction === 'player' && s.state !== 'wreck') out.add(id);
  }
  return out;
}

/** Module entity ids of a def on player ships. */
export function playerModules(sim: Sim, def?: string): number[] {
  const grids = playerShips(sim);
  return sim.world.query(ModuleC).filter((id) => {
    const m = sim.world.get(id, ModuleC);
    return !!m && grids.has(shipIdOf(sim, m)) && (def === undefined || m.def === def);
  });
}

/** Storage modules on player ships, ascending id. */
export function playerStorages(sim: Sim): number[] {
  const grids = playerShips(sim);
  return sim.world.query(StorageC, ModuleC).filter((id) => grids.has(shipIdOf(sim, sim.world.get(id, ModuleC)) ?? -1));
}

export function skillOf(sim: Sim, crew: number, skill: SkillName): number {
  try {
    return stat(sim, crew, skill);
  } catch {
    return 0;
  }
}

/** The crew member with the highest skill (ties: lowest id), or null with no crew. */
export function bestAt(sim: Sim, skill: SkillName): { crew: number; level: number } | null {
  let best: { crew: number; level: number } | null = null;
  for (const id of playerCrew(sim)) {
    const level = skillOf(sim, id, skill);
    if (!best || level > best.level) best = { crew: id, level };
  }
  return best;
}

export const hasImplant = (sim: Sim, crew: number, implant: string): boolean => !!sim.world.get(crew, ImplantsC)?.list.includes(implant);

/** Units of an item on player ships only: their storage modules plus loose stacks. Other ships' stock never counts. */
export function playerStock(sim: Sim, item: string): number {
  let n = 0;
  for (const id of playerStorages(sim)) n += storageCount(sim, id, item);
  const grids = playerShips(sim);
  for (const id of sim.world.query(ItemStackC)) {
    const s = sim.world.get(id, ItemStackC);
    if (s?.item === item && grids.has(shipIdAt(sim, s.x, s.y))) n += s.count;
  }
  return n;
}
