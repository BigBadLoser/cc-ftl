import type { SkillName } from '../registry';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { aboard, guardPacked } from '../packedGuard';
import { crewOf, modulesOf, PLAYER, shipsOf, storagesOf } from '../side';
import { ImplantsC } from '../crew/implantTypes';
import { VehicleC } from '../vehicles/components';
import { vehicleDefOf, vehicleFaction } from '../vehicles/lifecycle';


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
    const gone = new Set<number>();
    packet.entities = packet.entities.flatMap((e) => {
      const c = sim.world.detach(e.id);
      if (Object.keys(c).length) return [{ id: e.id, c }];
      gone.add(e.id);
      return [];
    });
    // An entity destroyed inside (a seized stack) must not leave its id on the packet's item grid: stamping would restore it.
    const items = packet.tiles['item'];
    if (gone.size && items) for (let i = 0; i < items.length; i++) if (gone.has(items[i] as number)) items[i] = 0;
    aboard.delete(sim);
  }
}

/** Living, free crew on the player's side (anywhere: ships, shuttles). Ascending id. */
export const playerCrew = (sim: Sim): number[] => crewOf(sim, PLAYER, { free: true });

/** `playerCrew` for a caller that wants "nobody" while the ship is packed. */
export const playerCrewPackedOk = (sim: Sim): number[] => crewOf(sim, PLAYER, { free: true, packedOk: true });

/** Ship ids of ships the player owns (active, disabled or prize; not wrecks). */
export const playerShips = (sim: Sim): Set<number> => shipsOf(sim, PLAYER);

/** `playerShips` for a caller that wants "none" while the ship is packed. */
export const playerShipsPackedOk = (sim: Sim): Set<number> => shipsOf(sim, PLAYER, { packedOk: true });

/** Module entity ids of a def on player ships. */
export const playerModules = (sim: Sim, def?: string): number[] => modulesOf(sim, PLAYER, def);

/** Player shuttles stowed in a bay (`eva`: only those fit for EVA work). */
export function stowedShuttles(sim: Sim, eva: boolean): number {
  guardPacked(sim, 'stowedShuttles');
  return sim.world.query(VehicleC).filter((id) => {
    const v = sim.world.get(id, VehicleC);
    return !!v && v.state === 'stowed' && vehicleFaction(sim, v) === PLAYER && (!eva || !!vehicleDefOf(sim, v)?.eva);
  }).length;
}

/** Storage modules on player ships, ascending id. */
export const playerStorages = (sim: Sim): number[] => storagesOf(sim, PLAYER);

export function skillOf(sim: Sim, crew: number, skill: SkillName): number {
  try {
    return stat(sim, crew, skill);
  } catch {
    return 0;
  }
}

/** The crew member with the highest skill (ties: lowest id), or null with no crew. Reads the crew in hyperspace too (the packet view). */
export function bestAt(sim: Sim, skill: SkillName): { crew: number; level: number } | null {
  return withPlayerAboard(sim, () => {
    let best: { crew: number; level: number } | null = null;
    for (const id of playerCrew(sim)) {
      const level = skillOf(sim, id, skill);
      if (!best || level > best.level) best = { crew: id, level };
    }
    return best;
  });
}

export const hasImplant = (sim: Sim, crew: number, implant: string): boolean => !!sim.world.get(crew, ImplantsC)?.list.some((i) => i.item === implant);

