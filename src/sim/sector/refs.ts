/**
 * Entity references that cross a cut (a ship lifted out of a sector, or a sector frozen into an archive). Ids survive a lift
 * and a restore (they are never reused), so references between entities on the same side stay valid with no fix-up. A
 * reference to an entity on the other side would point at nothing for as long as the two are apart: targets, attack orders
 * and reservations are cleared here so no system waits on an entity that is gone. Others (a stranded shuttle's `homeShip`,
 * an old `ContainerC.ship`) are kept on purpose: they become valid again when the two meet, and `world.get` returns
 * undefined until then.
 */

type Data = Record<string, unknown>;
type Target = { ship: number; moduleId: number; vehicle?: number; tile?: { x: number; y: number } } | null;

/** Clear, in place, the references in one entity's components (as `World.detach` returns them) to ids `inSet` rejects. */
export function cutLeaving(data: Data, inSet: (id: number) => boolean): Data {
  const gone = (id: number | undefined): boolean => !!id && !inSet(id);
  const target = (t: Target): Target => (t && (t.vehicle ? gone(t.vehicle) : gone(t.ship)) ? null : t);
  const combat = data.combat as { target: Target } | undefined;
  if (combat) combat.target = target(combat.target);
  const weapon = data.weapon as { target: Target; volleyTarget: Target; shotsLeft: number; commit?: { target: Target } | null } | undefined;
  if (weapon) {
    if (weapon.commit && !target(weapon.commit.target)) weapon.commit = null; // a telegraphed aim at a ship across the cut would come back with stale coordinates
    weapon.target = target(weapon.target);
    const volley = target(weapon.volleyTarget);
    if (weapon.volleyTarget && !volley) weapon.shotsLeft = 0;
    weapon.volleyTarget = volley;
  }
  const fighter = data.fighter as { target: number; ordered: number } | undefined;
  if (fighter && gone(fighter.target)) fighter.target = 0;
  if (fighter && gone(fighter.ordered)) fighter.ordered = 0;
  const job = data.job as { reservedBy: number } | undefined;
  if (job && gone(job.reservedBy)) job.reservedBy = 0;
  const module = data.module as { reservedBy: number } | undefined;
  if (module && gone(module.reservedBy)) module.reservedBy = 0;
  const downed = data.downed as { bed: number } | undefined;
  if (downed && gone(downed.bed)) downed.bed = 0;
  if (gone((data.assignment as { jobId: number } | undefined)?.jobId)) delete data.assignment;
  if (gone((data.bedClaim as { bed: number } | undefined)?.bed)) delete data.bedClaim;
  if (gone((data.bedOwner as { bed: number } | undefined)?.bed)) delete data.bedOwner;
  return data;
}
