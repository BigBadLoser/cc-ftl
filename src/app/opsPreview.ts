import { AllegianceC, CrewC, DeadC, type Sim } from '../sim';
import { injuriesOf, partDestroyed } from '../sim/crew/body';
import { skillOf } from '../sim/combat/operators';
import { partIcon } from './healthDetail';
import type { UiOperationOption, UiOperations } from '../ui/crewDetailApi';

/**
 * A preview of the Health tab's surgery section (#601), for screenshots only: surgery and implants come in slice 2 (#311), so in play the crew detail API
 * returns no operations and the section is not drawn. Only the debug start `?scenario=injuries&ops` turns this on (a scenario UI request, app/scenarioStart.ts);
 * it reads the real body and medics, with example implant names, and its buttons are inert (`live: false`).
 */
let enabled = false;

/** Turn the preview on (the debug scenario's request). */
export const enableOpsPreview = (): void => void (enabled = true);

const IMPLANT: Record<string, string> = { 'part-eye': 'Cyber eye', 'part-arm': 'Cyber arm', 'part-leg': 'Cyber leg', 'part-lungs': 'Cyber lungs', 'part-heart': 'Cyber heart' };

/** The preview operations of one crew member, or null when the preview is off. */
export function previewOperations(sim: Sim, id: number): UiOperations | null {
  const c = sim.content.injuries;
  if (!enabled || !c) return null;
  const list = injuriesOf(sim, id);
  const parts = Object.entries(c.parts).map(([pid, def]) => ({ id: pid, name: def.name, icon: partIcon(def), mirror: def.side === 'left', def }));
  const ops: Record<string, UiOperationOption[]> = {};
  for (const p of parts) {
    const lost = partDestroyed(sim, id, p.id);
    const hurt = list.some((i) => i.part === p.id && i.sev === 'serious');
    const name = p.name.toLowerCase();
    const implant = IMPLANT[p.icon];
    const limb = p.def.group === 'limb';
    ops[p.id] = [
      implant
        ? { kind: 'fit', label: 'Fit implant', note: lost ? `replaces the lost ${name}` : `replaces the ${name}`, ...(lost ? {} : { disabled: `the ${name} still works` }),
          implants: [{ id: `${implant} Mk I`, name: `${implant} Mk I`, stock: 1 }, { id: `${implant} Mk II`, name: `${implant} Mk II`, stock: 0 }] }
        : { kind: 'fit', label: 'Fit implant', note: 'an augment', disabled: 'no augment for this part in stock' },
      { kind: 'repair', label: 'Repair', note: `mends the ${name}`, ...(lost ? { disabled: `a lost ${name} can't be repaired` } : hurt ? {} : { disabled: 'nothing to repair' }) },
      { kind: 'amputate', label: 'Amputate', note: 'removes a ruined limb', ...(limb && lost ? {} : { disabled: limb ? 'only a lost limb' : 'not a limb' }) },
      { kind: 'remove', label: 'Remove implant', note: 'takes an implant out', disabled: 'no implant fitted' },
    ];
  }
  let best = { name: '', skill: -1 };
  for (const m of sim.world.query(CrewC)) {
    const mine = sim.world.get(m, AllegianceC)?.faction === 'player' && !sim.world.has(m, DeadC);
    const s = m === id || !mine ? -1 : skillOf(sim, m, 'medicine');
    if (s > best.skill) best = { name: sim.world.get(m, CrewC)?.name ?? '', skill: s };
  }
  const lost = parts.find((p) => partDestroyed(sim, id, p.id) && IMPLANT[p.icon]);
  const hurt = parts.find((p) => list.some((i) => i.part === p.id && i.sev === 'serious'));
  const queue: UiOperations['queue'] = [];
  if (lost) queue.push({ id: 1, label: `Fit ${IMPLANT[lost.icon]!.toLowerCase()} Mk I`, icon: lost.icon, mirror: lost.mirror, status: 'waiting' });
  if (hurt) queue.push({ id: 2, label: `Repair ${hurt.name.toLowerCase()}`, icon: hurt.icon, mirror: hurt.mirror, status: queue.length ? '2nd in line' : 'next' });
  return {
    queue,
    picker: {
      parts: parts.map(({ id: pid, name, icon, mirror }) => ({ id: pid, name, icon, mirror })),
      ops,
      where: ['Surgery table: low risk', 'Medical bed: higher risk'],
      surgeon: best.skill < 0 ? 'No free medic aboard.' : `Best free medic, ${best.name} (Medicine ${Math.round(best.skill)}): success ${Math.min(95, 60 + Math.round(best.skill) * 5)}%`,
    },
    live: false,
  };
}
