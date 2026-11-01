import {
  CrewC, DownedC, HealthC, ImplantsC, MoodC, MOOD_BASE, MOOD_LABELS, MOOD_LOW, MOOD_LOW_WORK_MULT, MOOD_VERY_LOW, MOOD_VERY_LOW_WORK_MULT,
  NeedsC, RolledSkillsC, SKILLS, SkillXpC, SuitC, SurrenderedC, PrisonerC, XP_PER_LEVEL,
  statBreakdown, suitAir, TraitsC, suitDef, traitDefs, wielded, type Sim, type StatBreakdown, type StatName,
} from '../sim';
import { CarryingC } from '../sim/items/components';
import { xpGainMult } from '../sim/crew/traits';
import { carriedCard, suitCard, weaponCard } from './crewItemCards';
import type { UiCondition, UiCrewDetail, UiGearSlot, UiItemCard, UiSkillDetail, UiStatDetail, UiStatPart } from '../ui/crewDetailApi';

const cap = (s: string): string => s[0]!.toUpperCase() + s.slice(1);
const OTHER_STATS: readonly { stat: StatName; name: string; unit: UiStatDetail['unit'] }[] = [
  { stat: 'moveSpeed', name: 'Move speed', unit: 'tiles/s' },
  { stat: 'workSpeed', name: 'Work speed', unit: 'x' },
  { stat: 'carryCapacity', name: 'Carry capacity', unit: 'items' },
  { stat: 'restDecay', name: 'Rest drain', unit: 'x' },
];

/**
 * The resolver's terms with a label each. The trait source is split back per trait (its modifiers are the trait defs'),
 * the surroundings by which penalty it is.
 */
function partsOf(sim: Sim, id: number, name: StatName, b: StatBreakdown): UiStatPart[] {
  const out: UiStatPart[] = [];
  let traitsDone = false;
  const rolled = sim.world.has(id, RolledSkillsC);
  for (const p of b.parts) {
    switch (p.origin) {
      case 'traits':
        if (traitsDone) break;
        traitsDone = true;
        for (const d of traitDefs(sim, id))
          for (const m of d.modifiers ?? []) if (m.stat === name) out.push({ label: d.name, kind: 'trait', op: m.op, value: m.value });
        break;
      case 'skills': out.push({ label: rolled ? 'Rolled' : 'Role', kind: 'rolled', op: p.op, value: p.value }); break;
      case 'xp': if (p.value) out.push({ label: 'Experience', kind: 'xp', op: p.op, value: p.value }); break;
      case 'suit': out.push({ label: 'EVA suit', kind: 'gear', op: p.op, value: p.value }); break;
      case 'charge': out.push({ label: 'Flat battery', kind: 'state', op: p.op, value: p.value }); break;
      case 'mood': out.push({ label: 'Low mood', kind: 'state', op: p.op, value: p.value }); break;
      case 'dark': out.push({ label: 'Dark room', kind: 'env', op: p.op, value: p.value }); break;
      case 'lowAir': out.push({ label: 'Thin air', kind: 'env', op: p.op, value: p.value }); break;
    }
  }
  return out;
}

function skillsOf(sim: Sim, id: number): UiSkillDetail[] {
  const crew = sim.world.get(id, CrewC);
  const role = crew ? sim.content.roles[crew.role]?.skills : undefined;
  const xp = sim.world.get(id, SkillXpC)?.xp ?? {};
  return SKILLS.map((skill) => {
    const b = statBreakdown(sim, id, skill);
    const parts = partsOf(sim, id, skill, b);
    const sum = (k: UiStatPart['kind']) => parts.filter((p) => p.kind === k && p.op === 'add').reduce((n, p) => n + p.value, 0);
    return {
      skill, name: cap(skill), value: Math.round(b.value), rolled: sum('rolled'), xpLevels: sum('xp'),
      mods: parts.filter((p) => p.kind !== 'rolled' && p.kind !== 'xp'), role: role?.[skill] ?? 0,
      xp: Math.floor((xp[skill] ?? 0) % XP_PER_LEVEL), per: XP_PER_LEVEL, gain: xpGainMult(sim, id, skill),
    };
  });
}

function statsOf(sim: Sim, id: number): UiStatDetail[] {
  return OTHER_STATS.map(({ stat, name, unit }) => {
    const b = statBreakdown(sim, id, stat);
    return { stat, name, unit, base: b.base, value: Math.round(b.value * 100) / 100, parts: partsOf(sim, id, stat, b) };
  });
}

const level = (key: string, label: string, v: number, text: string, warn: number, bad: number): UiCondition =>
  ({ key, label, text, pct: Math.round(v), tone: v < bad ? 'bad' : v < warn ? 'warn' : v >= 85 ? 'good' : 'ok' });

function conditionsOf(sim: Sim, id: number): UiCondition[] {
  const out: UiCondition[] = [];
  const downed = sim.world.get(id, DownedC);
  if (downed) out.push({ key: 'downed', label: 'Downed', text: downed.stabilized ? 'stabilized in a bed' : `bleeding out in ${Math.round(downed.bleed)} s`, pct: null, tone: downed.stabilized ? 'warn' : 'bad' });
  if (sim.world.has(id, SurrenderedC)) out.push({ key: 'surrendered', label: sim.world.has(id, PrisonerC) ? 'Prisoner' : 'Surrendered', text: 'out of the fight', pct: null, tone: 'bad' });
  if (sim.world.has(id, SuitC)) {
    const max = suitDef(sim).airSec;
    const air = suitAir(sim, id);
    out.push({ key: 'suit', label: 'Suit air', text: `${Math.floor(air / 60)}:${String(Math.round(air) % 60).padStart(2, '0')} left`, pct: Math.round((air / Math.max(1, max)) * 100), tone: air <= max * 0.25 ? 'bad' : 'ok' });
  }
  const n = sim.world.get(id, NeedsC);
  if (n?.hunger !== undefined) out.push(level('hunger', 'Hunger', n.hunger, n.hunger <= 0 ? 'starving' : n.hunger < 35 ? `${Math.round(n.hunger)}% hungry` : `${Math.round(n.hunger)}% fed`, 60, 35));
  if (n?.charge !== undefined) out.push(level('charge', 'Battery', n.charge, n.charge <= 0 ? 'flat' : `${Math.round(n.charge)}%`, 40, 15));
  else if (n) out.push(level('rest', 'Rest', n.rest, n.rest < 10 ? 'exhausted' : n.rest < 30 ? `${Math.round(n.rest)}% tired` : `${Math.round(n.rest)}% rested`, 30, 10));
  return out;
}

function moodOf(sim: Sim, id: number): UiCrewDetail['mood'] {
  const m = sim.world.get(id, MoodC);
  if (!m) return null;
  const factors = m.factors.map((f) => ({
    label: MOOD_LABELS[f.key] ?? (f.key.startsWith('trait:') ? f.key.slice(6) : f.key), value: f.value, source: factorSource(sim, id, f.key),
  })).sort((a, b) => b.value - a.value);
  return { value: m.value, base: MOOD_BASE, factors, workMult: m.value < MOOD_VERY_LOW ? MOOD_VERY_LOW_WORK_MULT : m.value < MOOD_LOW ? MOOD_LOW_WORK_MULT : 1 };
}

/** The trait behind a mood factor: the trait's own factor, or the one that changes how this factor feels (Social's Company). */
function factorSource(sim: Sim, id: number, key: string): string | undefined {
  for (const d of traitDefs(sim, id)) {
    const e = d.effects ?? {};
    if (key.startsWith('trait:') && MOOD_LABELS[key] !== undefined) return d.name;
    if ((key === 'company' || key === 'lonely' || key === 'alone' || key === 'crowded') && e.company) return d.name;
    if ((key === 'wellFed' || key === 'hotMeal') && e.foodMoodMult) return d.name;
    if ((key === 'thrill' || key === 'bored') && e.thrill) return d.name;
    if (key === 'cooped' && e.voidHome) return d.name;
    if (key === 'glare' && e.darkAdapted) return d.name;
    if ((key === 'idle' || key === 'restless') && e.idleMood?.key === key) return d.name;
  }
  return undefined;
}

/** The loadout: weapon, suit (armor when it exists), what they carry, and two implant slots. Each item has its hover card. */
function gearOf(sim: Sim, id: number): UiGearSlot[] {
  const w = wielded(sim, id);
  const natural = w.item !== 'unarmed' && !sim.content.items[w.item];
  const wname = sim.content.items[w.item]?.name ?? cap(w.item.replace(/^.*\./, ''));
  const out: UiGearSlot[] = [{
    slot: 'weapon', label: 'Weapon',
    item: w.item === 'unarmed' ? null : { id: w.item, name: wname, natural, card: weaponCard(sim, id, wname, w.def, sim.content.items[w.item]?.price) },
  }];
  out.push({ slot: 'suit', label: 'Armor', item: sim.world.has(id, SuitC) ? { id: 'suit', name: 'EVA suit', card: suitCard(sim, id) } : null });
  const c = sim.world.get(id, CarryingC);
  out.push({ slot: 'hands', label: 'Carrying', item: c ? { id: c.item, name: sim.content.items[c.item]?.name ?? c.item, count: c.count, card: carriedCard(sim, id, c.item, c.count) } : null });
  const implants = sim.world.get(id, ImplantsC)?.list ?? [];
  for (let i = 0; i < Math.max(1, implants.length); i++) {
    const imp = implants[i];
    out.push({ slot: 'implant', label: 'Implant', item: imp ? { id: imp, name: cap(imp.replace(/^.*\./, '').replace(/_/g, ' ')), card: null } : null });
  }
  return out;
}

/** Hover cards of every hand weapon in content, as this crew member would use it. */
function cardsOf(sim: Sim, id: number): Record<string, UiItemCard> {
  const out: Record<string, UiItemCard> = {};
  for (const [item, def] of Object.entries(sim.content.items)) if (def.hand) out[item] = weaponCard(sim, id, def.name, def.hand, def.price);
  return out;
}

/** The inspector's detail tabs for one crew member (null when it is not crew). Reads the sim only. */
export function buildCrewDetail(sim: Sim, id: number | null): UiCrewDetail | null {
  if (id === null || !sim.world.has(id, CrewC)) return null;
  const hp = sim.world.get(id, HealthC);
  return {
    id,
    health: { hp: Math.round(hp?.hp ?? 100), maxHp: hp?.max ?? 100, conditions: conditionsOf(sim, id) },
    mood: moodOf(sim, id),
    skills: skillsOf(sim, id),
    stats: statsOf(sim, id),
    traits: (sim.world.get(id, TraitsC)?.ids ?? []).flatMap((tid) => {
      const d = sim.content.traits?.[tid];
      return d ? [{ id: tid, name: d.name, kind: d.kind, flavour: d.flavour, effect: d.effect, short: d.short }] : [];
    }),
    gear: gearOf(sim, id),
    cards: cardsOf(sim, id),
  };
}
