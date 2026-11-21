import { CrewC, DownedC, HealthC, type Injury, type Sim } from '../sim';
import { bleedRate, canBeInjured, capacitiesOf, injuriesOf, isBleeding, needsTreatment } from '../sim/crew/body';
import { BLEED_FAST_AT } from '../sim/crew/tuningInjury';
import type { BodyPartDef, Capacity } from '../sim/crew/injuryTypes';
import { clockAt } from '../sim/clock';
import type { UiBodyPart, UiHealth, UiInjuryCard, UiOperations, UiPartIcon, UiTone } from '../ui/crewDetailApi';

/** The glyph of a part, from what it feeds (a gate on moving is the spine). */
export function partIcon(def: BodyPartDef): UiPartIcon {
  const by: Record<Capacity, UiPartIcon> = {
    consciousness: 'part-brain', sight: 'part-eye', bloodPumping: 'part-heart', breathing: 'part-lungs', manipulation: 'part-arm', moving: 'part-leg',
  };
  return def.gate ? 'part-spine' : by[def.capacity];
}

/** How bad an injury is for the row: lost, needs care now (serious untreated, bleeding), treated, scar, minor. Higher first. */
const rank = (i: Injury): number => (i.sev === 'destroyed' ? 5 : i.sev === 'serious' && !i.treated ? 4 : i.bleeding ? 3 : i.sev === 'serious' ? 2 : i.sev === 'scar' ? 1 : 0);
const needsCare = (i: Injury): boolean => !!i.bleeding || (i.sev === 'serious' && !i.treated);

function stateOf(sim: Sim, i: Injury): string {
  if (i.sev === 'destroyed') return 'Destroyed';
  const name = sim.content.injuries?.kinds[i.kind]?.name ?? i.kind;
  const how = i.bleeding ? 'bleeding' : i.sev === 'serious' ? (i.treated ? 'treated' : 'untreated') : i.sev === 'scar' ? 'scar' : 'healing';
  return `${name}, ${how}`;
}

function careOf(sim: Sim, i: Injury): string {
  if (i.sev === 'destroyed') return 'Lost for good.';
  if (i.sev === 'scar') return 'Healed badly: a small loss for good.';
  const bleed = i.bleeding ? 'Bleeding: needs first aid where they stand. ' : '';
  if (i.sev === 'serious' && !i.treated) return `${bleed}Untreated. A medic must treat it at a medical bed, or it may scar.`;
  const k = sim.content.injuries?.kinds[i.kind];
  const left = k ? Math.max(1, Math.round((k.healSec - i.heal) / 60)) : 0;
  return `${bleed}${i.sev === 'serious' ? 'Treated, healing' : 'Heals on its own'}${left ? `: about ${left} min at this rate` : ''}.`;
}

function gotOf(sim: Sim, i: Injury): string {
  if (!i.src || i.at === undefined) return '';
  return `Got it: ${sim.content.injuries?.sources[i.src]?.name ?? i.src}, day ${clockAt(i.at).day}.`;
}

/** The summary sentence from the sim's answers: down, bleeding, waiting for a medic, healing, healthy. */
function summaryOf(sim: Sim, id: number, list: readonly Injury[]): UiHealth['summary'] {
  if (sim.world.has(id, DownedC)) return { alert: 'Down.', text: needsTreatment(sim, id) ? 'Needs a rescue and a medic.' : 'Needs a rescue.', fine: false };
  if (isBleeding(sim, id)) return { alert: 'Bleeding.', text: needsTreatment(sim, id) ? 'Needs first aid and a medic.' : 'Needs first aid.', fine: false };
  if (needsTreatment(sim, id)) return { alert: 'Needs a medic.', text: '', fine: false };
  if (list.some((i) => i.sev === 'minor' || i.sev === 'serious')) return { alert: '', text: 'Healing.', fine: false };
  return { alert: '', text: list.length ? 'Stable.' : 'Healthy.', fine: true };
}

/** The Health tab of one crew member (null for a body that takes no injuries). `operations`: the surgery queue, null until surgery exists. */
export function buildHealth(sim: Sim, id: number, operations: UiOperations | null = null): UiHealth | null {
  const c = sim.content.injuries;
  if (!c || !sim.world.has(id, CrewC) || !canBeInjured(sim, id)) return null;
  const list = injuriesOf(sim, id);
  const caps = capacitiesOf(sim, id);
  const hp = sim.world.get(id, HealthC);
  const capTone = (v: number): UiTone => (v >= 0.995 ? 'fine' : 'plain'); // a low capacity is an effect, not care needed now: never red
  let lastGroup = '';
  const parts: UiBodyPart[] = Object.entries(c.parts).map(([pid, def]) => {
    const group = def.group === 'limb' ? def.capacity : def.group;
    const gap = lastGroup !== '' && group !== lastGroup;
    lastGroup = group;
    const mine = list.filter((i) => i.part === pid).sort((a, b) => rank(b) - rank(a));
    const worst = mine[0];
    const tone: UiTone = mine.some(needsCare) ? 'alert' : worst ? 'plain' : 'fine';
    const capDef = c.capacities[def.capacity];
    const card: UiInjuryCard | null = worst ? {
      title: `${def.name}: ${worst.sev === 'destroyed' ? 'destroyed' : (c.kinds[worst.kind]?.name ?? worst.kind).toLowerCase()}`, tone,
      injuries: mine.map((i) => ({ what: mine.length > 1 ? stateOf(sim, i) : '', care: careOf(sim, i), got: gotOf(sim, i) })),
      effect: `${capDef?.name ?? def.capacity} ${Math.round(caps[def.capacity] * 100)}%: ${capDef?.effect ?? ''}.`,
    } : null;
    return { id: pid, name: def.name, icon: partIcon(def), mirror: def.side === 'left', gap, state: worst ? stateOf(sim, worst) : 'Fine', more: Math.max(0, mine.length - 1), tone, card };
  });
  const rate = bleedRate(sim, id);
  return {
    summary: summaryOf(sim, id, list),
    hpPct: hp && hp.max > 0 ? Math.round((hp.hp / hp.max) * 100) : 100,
    bleeding: rate > 0 ? (rate >= BLEED_FAST_AT ? 'fast' : 'slow') : null,
    capacities: (Object.keys(c.capacities) as Capacity[]).map((k) => ({ key: k, name: c.capacities[k].name, pct: Math.round(caps[k] * 100), tone: capTone(caps[k]) })),
    parts,
    operations,
  };
}
