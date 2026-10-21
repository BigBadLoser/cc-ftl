import { ProjectileC } from '../combat/components';
import { SectorGrid, type SectorGridData } from '../sectorGrid';
import type { Sim } from '../sim';
import { newSectorGrid } from '../stamp';
import type { PacketEntity } from './packet';
import { cutLeaving } from './refs';
import { translated } from './translate';

/**
 * A sector the player left, frozen: its node, the tick it was frozen at, its size, every tile chunk and every entity that was
 * still in it (prizes, wrecks, derelicts, enemies, and the player's own crew or shuttles that were not aboard or docked), in
 * sector tiles under their own ids. Not simulated. Restored whole when the player returns to the node. Plain JSON data, saved
 * in `Sim.archives`. Retention (user decision, 2026-10-21): every archive is kept; there is no pruning rule for now.
 */
export interface SectorArchive {
  node: number;
  tick: number;
  width: number;
  height: number;
  grid: SectorGridData;
  entities: PacketEntity[];
}

/**
 * Freeze everything left in the sector into an archive for its node (replacing an older one of that node) and leave the sector
 * empty. Shots in flight are dropped: they would land on a frozen sector long after the fact. References to entities that are
 * not archived (the ship that just lifted out) are cleared as in `liftShip`.
 */
export function archiveSector(sim: Sim): SectorArchive {
  for (const id of [...sim.world.query(ProjectileC)]) sim.world.destroyEntity(id);
  const ids = sim.world.ids();
  const kept = new Set(ids);
  const entities = ids.map((id) => ({ id, c: cutLeaving(translated(sim.world.detach(id), 0, 0), (e) => kept.has(e)) }));
  const archive: SectorArchive = {
    node: sim.sector.node, tick: sim.tick, width: sim.sector.width, height: sim.sector.height, grid: sim.sector.grid.serialize(), entities,
  };
  sim.archives = [...sim.archives.filter((a) => a.node !== archive.node), archive];
  sim.sector.grid = newSectorGrid();
  sim.sector.inCombat = false;
  return archive;
}

/** The archive of a node, or undefined. */
export function archiveOf(sim: Sim, node: number): SectorArchive | undefined {
  return sim.archives.find((a) => a.node === node);
}

/**
 * Bring a node's archive back as the current sector (which must be empty of tiles and entities) and drop it from the list.
 * Returns false if the node has none (the caller makes a fresh sector).
 */
export function restoreArchive(sim: Sim, node: number): boolean {
  const archive = archiveOf(sim, node);
  if (!archive) return false;
  sim.sector.grid = SectorGrid.deserialize(0, archive.grid);
  sim.sector.width = archive.width;
  sim.sector.height = archive.height;
  for (const e of archive.entities) sim.world.restore(e.id, translated(e.c, 0, 0));
  sim.archives = sim.archives.filter((a) => a !== archive);
  return true;
}
