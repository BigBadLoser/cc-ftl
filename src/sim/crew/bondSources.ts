import { FighterC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import {
  BOND_DANGER_COOLDOWN_SEC, BOND_DOWNED_BESIDE, BOND_FIGHT_RADIUS, BOND_FOUGHT, BOND_FOUGHT_BAD, BOND_GRATE, BOND_GRIEF_SEC, BOND_NEAR_RADIUS,
  BOND_NEAR_TRICKLE, BOND_RESCUED, BOND_RESCUER, BOND_WITNESS_DEATH, BOND_WORK_RADIUS, BOND_WORK_TRICKLE, MOOD_LOW,
} from '../tuning';
import { bondBoth, bondTo, entityOf, onCooldownFor, personOf } from './bonds';
import { compatibility } from './compat';
import { AssignmentC, CarriedC, CrewC, DeadC, DownedC, MoodC, PositionC } from './components';
import { hasMood, ensureMood } from './mood';

/**
 * Where opinions come from besides interactions (docs/TRAITS.md section 6), read from the world's state: the passive trickle of company
 * and shared work, shared danger (fighting side by side, being downed beside a fighter, a rescue, a death) and grief. Each shared-danger
 * source applies once per pair per BOND_DANGER_COOLDOWN_SEC, which stands in for "once per fight".
 */

const danger = { danger: true } as const;

/** The pair-by-pair sources for two living mood crew `a` < `b` within BOND_NEAR_RADIUS of each other on one ship, `dist` apart. */
export function pairSources(sim: Sim, a: number, b: number, dist: number): void {
  const c = compatibility(sim, a, b);
  bondBoth(sim, a, b, BOND_NEAR_TRICKLE * c, 'together', { shared: false });
  if (dist <= BOND_WORK_RADIUS && sim.world.has(a, AssignmentC) && sim.world.has(b, AssignmentC)) bondBoth(sim, a, b, BOND_WORK_TRICKLE * c, 'worked', { shared: false });
  if ((sim.world.get(a, MoodC)?.value ?? 50) < MOOD_LOW || (sim.world.get(b, MoodC)?.value ?? 50) < MOOD_LOW) bondBoth(sim, a, b, -BOND_GRATE, 'grated', { shared: false });
  const fa = sim.world.get(a, FighterC)?.mode === 'engage', fb = sim.world.get(b, FighterC)?.mode === 'engage';
  if (dist > BOND_FIGHT_RADIUS) return;
  if (fa && fb && !onCooldownFor(sim, a, b, 'fought', BOND_DANGER_COOLDOWN_SEC)) {
    bondBoth(sim, a, b, c < -0.3 ? BOND_FOUGHT_BAD : BOND_FOUGHT, 'fought', { ...danger, source: 'fought' });
  } else if (((fa && sim.world.has(b, DownedC)) || (fb && sim.world.has(a, DownedC))) && !onCooldownFor(sim, a, b, 'downedBeside', BOND_DANGER_COOLDOWN_SEC)) {
    bondBoth(sim, a, b, BOND_DOWNED_BESIDE, 'downedBeside', { ...danger, source: 'downedBeside' });
  }
}

/** Every carried patient whose carrier is a crew member of ours: the patient thinks well of the rescuer (more than the rescuer of the patient). Run every tick (carries are short). */
export function rescueSources(sim: Sim): void {
  for (const patient of sim.world.query(CarriedC)) {
    const rescuer = sim.world.get(patient, CarriedC)!.carrier;
    if (!sim.world.has(patient, DownedC) || !hasMood(sim, patient) || !hasMood(sim, rescuer) || onCooldownFor(sim, patient, rescuer, 'rescued', BOND_DANGER_COOLDOWN_SEC)) continue;
    bondTo(sim, patient, rescuer, BOND_RESCUED, 'rescued', { ...danger, source: 'rescued' });
    bondTo(sim, rescuer, patient, BOND_RESCUER, 'rescuer', { ...danger, source: 'rescued' });
  }
}

/**
 * Deaths not yet mourned: friends of the dead grieve (`Mood.grief`, and the grief stressor reads it), and the crew who saw it happen
 * (within BOND_NEAR_RADIUS) are closer for having been there. Found from the corpses (`DeadC`), not the event.
 */
export function deathSources(sim: Sim): void {
  for (const dead of sim.world.query(CrewC, DeadC)) {
    const pid = personOf(sim, dead);
    if (!pid || sim.bonds.dead[pid] !== undefined || !hasMood(sim, dead)) continue;
    sim.bonds.dead[pid] = sim.tick;
    const pos = sim.world.get(dead, PositionC);
    const ship = pos && shipIdOf(sim, pos);
    const witnesses: number[] = [];
    for (const o of sim.world.query(CrewC, PositionC)) {
      if (o === dead || sim.world.has(o, DeadC) || !hasMood(sim, o)) continue;
      const p = sim.world.get(o, PositionC)!;
      if (pos && shipIdOf(sim, p) === ship && Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y)) <= BOND_NEAR_RADIUS) witnesses.push(o);
    }
    for (let i = 0; i < witnesses.length; i++) for (let j = i + 1; j < witnesses.length; j++) bondBoth(sim, witnesses[i]!, witnesses[j]!, BOND_WITNESS_DEATH, 'witness', danger);
    // Grief: whoever counts the dead a friend (a record outlives its subject).
    for (const fk of Object.keys(sim.bonds.opinions)) {
      const mourner = entityOf(sim, +fk);
      if (sim.bonds.opinions[+fk]?.[pid]?.kind !== 'friend' || !mourner || sim.world.has(mourner, DeadC) || !hasMood(sim, mourner)) continue;
      ensureMood(sim, mourner).grief = BOND_GRIEF_SEC;
      sim.events.emit({ type: 'crew.grieving', crew: mourner, lost: dead });
    }
  }
}
