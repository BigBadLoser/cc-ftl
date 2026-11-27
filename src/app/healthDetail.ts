import { CrewC, HealthC, type Injury, type Sim } from '../sim';
import { bleedRate, canBeInjured, capacitiesOf, injuriesOf } from '../sim/crew/body';
import { BLEED_FAST_AT } from '../sim/crew/tuningInjury';
import type { BodyPartDef, Capacity } from '../sim/crew/injuryTypes';
import { clockAt } from '../sim/clock';
import { implantsOf } from '../sim/crew/implants';
import { DERMAL_PART } from '../sim/crew/implantTypes';
import { suggestedOperation } from '../sim/crew/surgery';
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

const AMPUTATED = 'injury.amputated';

function stateOf(sim: Sim, i: Injury): string {
  if (i.sev === 'destroyed') return i.kind === AMPUTATED ? 'Amputated' : 'Destroyed';
  const name = sim.content.injuries?.kinds[i.kind]?.name ?? i.kind;
  const how = i.bleeding ? 'bleeding' : i.sev === 'serious' ? (i.treated ? 'treated' : 'untreated') : i.sev === 'scar' ? 'scar' : 'healing';
  return `${name}, ${how}`;
}

function careOf(sim: Sim, i: Injury): string {
  if (i.sev === 'destroyed') return i.kind === AMPUTATED ? 'Taken off: ready for a cyber limb.' : 'Lost: only an implant can replace it.';
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

/** The fitted implants' names on a part, or null. */
function implantNames(sim: Sim, id: number, part: string): string | null {
  const names = implantsOf(sim, id).filter((f) => f.part === part).map((f) => sim.content.items[f.item]?.name ?? f.item);
  return names.length ? names.join(', ') : null;
}

const ACTION_LABEL = { fit: 'Replace', repair: 'Repair', amputate: 'Amputate' } as const;

/** The row's action from the sim's suggestion (crew/surgery.ts `suggestedOperation`); buttons only where surgery is on offer. */
function actionOf(sim: Sim, id: number, part: string, surgery: boolean): Pick<UiBodyPart, 'action'> {
  const s = suggestedOperation(sim, id, part);
  if (s === 'heals') return { action: { kind: 'heals', label: 'heals' } };
  return s && s !== 'remove' && surgery ? { action: { kind: s, label: ACTION_LABEL[s] } } : {};
}

/** The Health tab of one crew member (null for a body that takes no injuries). `operations`: the surgery section (app/surgeryDetail.ts). */
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
      title: `${def.name}: ${worst.sev === 'destroyed' ? stateOf(sim, worst).toLowerCase() : (c.kinds[worst.kind]?.name ?? worst.kind).toLowerCase()}`, tone,
      injuries: mine.map((i) => ({ what: mine.length > 1 ? stateOf(sim, i) : '', care: careOf(sim, i), got: gotOf(sim, i) })),
      effect: `${capDef?.name ?? def.capacity} ${Math.round(caps[def.capacity] * 100)}%: ${capDef?.effect ?? ''}.`,
    } : null;
    const implant = implantNames(sim, id, pid);
    return { id: pid, name: def.name, icon: partIcon(def), mirror: def.side === 'left', gap, state: worst ? stateOf(sim, worst) : implant ? '' : 'Fine', more: Math.max(0, mine.length - 1), tone: implant && tone === 'fine' ? 'plain' : tone, implant, card, ...actionOf(sim, id, pid, !!operations) };
  });
  const skin = implantNames(sim, id, DERMAL_PART); // the skin has a row only while an implant is in it
  if (skin) parts.push({ id: DERMAL_PART, name: 'Skin', icon: 'part-skin', mirror: false, gap: true, state: '', more: 0, tone: 'plain', implant: skin, card: null });
  const rate = bleedRate(sim, id);
  return {
    hpPct: hp && hp.max > 0 ? Math.round((hp.hp / hp.max) * 100) : 100,
    bleeding: rate > 0 ? (rate >= BLEED_FAST_AT ? 'fast' : 'slow') : null,
    capacities: (Object.keys(c.capacities) as Capacity[]).map((k) => ({ key: k, name: c.capacities[k].name, pct: Math.round(caps[k] * 100), tone: capTone(caps[k]) })),
    parts,
    operations,
  };
}
