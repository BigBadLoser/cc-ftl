import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { BOND_FRIEND_MOOD, BOND_GRIEF_MOOD, BOND_CHAT_MOOD, BOND_NEAR_RADIUS, BOND_RIVAL_MOOD, BOND_ROW_MOOD } from '../tuning';
import { entityOf, friendsOf, personOf, rivalsOf } from './bonds';
import { CrewC, DeadC, PositionC, type Mood, type MoodFactor } from './components';
import { traitFlag } from './traits';

/** Mood factor labels added by relationships (merged into MOOD_LABELS). */
export const BOND_MOOD_LABELS: Readonly<Record<string, string>> = {
  withFriend: 'Near a friend', nearRival: 'Near a rival', grieving: 'Grieving', goodChat: 'Good talk', row: 'Had a row',
};

/** Living bond partners of one kind within BOND_NEAR_RADIUS on the same grid (entities). */
function near(sim: Sim, id: number, kind: 'friend' | 'rival'): number[] {
  const pid = personOf(sim, id);
  const pos = sim.world.get(id, PositionC);
  if (!pid || !pos) return [];
  const ship = shipIdOf(sim, pos);
  const out: number[] = [];
  for (const { person } of kind === 'friend' ? friendsOf(sim, pid) : rivalsOf(sim, pid)) {
    const o = entityOf(sim, person);
    const p = o ? sim.world.get(o, PositionC) : undefined;
    if (!p || !sim.world.has(o, CrewC) || sim.world.has(o, DeadC) || shipIdOf(sim, p) !== ship) continue;
    if (Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y)) <= BOND_NEAR_RADIUS) out.push(o);
  }
  return out;
}

/** True when a Peacemaker stands within the radius (rivals nearby then feel half the penalty). */
function calmed(sim: Sim, id: number): boolean {
  const pos = sim.world.get(id, PositionC);
  if (!pos) return false;
  const ship = shipIdOf(sim, pos);
  for (const o of sim.world.query(CrewC, PositionC)) {
    if (o === id || sim.world.has(o, DeadC) || !traitFlag(sim, o, 'peacemaker')) continue;
    const p = sim.world.get(o, PositionC) as { x: number; y: number };
    if (shipIdOf(sim, p) === ship && Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y)) <= BOND_NEAR_RADIUS) return true;
  }
  return false;
}

/**
 * The mood factors of a crew member's relationships (docs/TRAITS.md section 6): a friend within range lifts, a rival within range weighs
 * (halved near a Peacemaker), grief for a friend who died, the lift of a good chat and the dip of a row. Added before the traits scale the
 * lot. Empty for a crew member with no bonds, which costs one component read.
 */
export function bondFactors(sim: Sim, id: number, m: Mood): MoodFactor[] {
  const out: MoodFactor[] = [];
  if ((m.grief ?? 0) > 0) out.push({ key: 'grieving', value: -BOND_GRIEF_MOOD * (traitFlag(sim, id, 'protective') ? 1.5 : 1) });
  if ((m.chat ?? 0) > 0) out.push({ key: 'goodChat', value: BOND_CHAT_MOOD });
  if ((m.row ?? 0) > 0) out.push({ key: 'row', value: BOND_ROW_MOOD });
  const pid = personOf(sim, id);
  if (!pid || !sim.bonds.opinions[pid]) return out;
  if (near(sim, id, 'friend').length > 0) out.push({ key: 'withFriend', value: BOND_FRIEND_MOOD });
  if (near(sim, id, 'rival').length > 0) out.push({ key: 'nearRival', value: calmed(sim, id) ? BOND_RIVAL_MOOD / 2 : BOND_RIVAL_MOOD });
  return out;
}
