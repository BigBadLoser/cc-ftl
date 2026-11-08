import { lodgingHere } from '../consent/guests';
import { shipIdOf, shipGrid } from '../regions';
import { hasSuitAir } from '../eva/suit';
import { AllegianceC } from '../fight/components';
import type { Modifier, ModifierSource } from '../stats';
import type { Sim } from '../sim';
import {
  BREAK_LET_OUT_POINTS, BREAK_SCENE_MOOD, LIGHT_DARK_BELOW, MOOD_BASE, MOOD_BREAKDOWN_BELOW, MOOD_COMPANY_RADIUS, MOOD_LONELY_SEC, MOOD_LOW, MOOD_LOW_WORK_MULT,
  MOOD_MEAL_SEC, MOOD_RELAX_POINTS, MOOD_RELAX_SEC, MOOD_SLEEP_SEC, MOOD_VERY_LOW, MOOD_VERY_LOW_WORK_MULT, O2_ALERT_BELOW, O2_HARM_BELOW,
} from '../tuning';
import { CrewC, DeadC, MoodC, NeedsC, PositionC, type Mood, type MoodFactor } from './components';
import { BOND_MOOD_LABELS, bondFactors } from './bondMood';
import { applyTraitMood, FOOD_MOOD_KEYS, TRAIT_MOOD_LABELS } from './traitMood';

export { FOOD_MOOD_KEYS };

const NONE: readonly Modifier[] = [];

/** Display names of the mood factor keys (the UI shows "<label> <+/-points>"). */
export const MOOD_LABELS: Readonly<Record<string, string>> = {
  starving: 'Starving', hungry: 'Hungry', peckish: 'Peckish', wellFed: 'Well fed',
  exhausted: 'Exhausted', tired: 'Tired', rested: 'Rested',
  hotMeal: 'Hot ration at the galley', mealBland: 'Bland meal', mealGood: 'Good meal', mealFine: 'Fine meal', bed: 'Slept in a bed', floor: 'Slept on the floor',
  dark: 'Dark room', thinAir: 'Thin air', staleAir: 'Stale air', smoky: 'Smoky room', temperature: 'Uncomfortable temperature',
  company: 'Company', lonely: 'Lonely', relaxed: 'Took a break', letOut: 'Let it out', scene: 'Made a scene',
  ...TRAIT_MOOD_LABELS,
  ...BOND_MOOD_LABELS,
};

/** True for crew who have moods: their species says so, and they live aboard as the player's crew or as a passenger (enemy crews do not mope). */
export function hasMood(sim: Sim, id: number): boolean {
  const crew = sim.world.get(id, CrewC);
  return !!crew && !!sim.content.species[crew.species]?.mood && (sim.world.get(id, AllegianceC)?.faction === 'player' || !!lodgingHere(sim, id));
}

/** The crew member's Mood, created neutral on first use (old saves, new crew). */
export function ensureMood(sim: Sim, id: number): Mood {
  let m = sim.world.get(id, MoodC);
  if (!m) sim.world.add(id, MoodC, (m = { value: MOOD_BASE, factors: [], meal: 0, sleep: 0, bed: 1, alone: 0, low: false }));
  return m;
}

/** A meal just ended; a galley meal is a hot one and lifts mood for a while. */
export function noteMeal(sim: Sim, id: number, galley: boolean, item = ''): void {
  if (!hasMood(sim, id)) return;
  const m = ensureMood(sim, id);
  m.meal = galley ? MOOD_MEAL_SEC : 0;
  if (galley) m.mealItem = item; // which meal it was sets the factor (ItemDef.food.mood)
}

/** A break (the leisure drive's walk and rest, ai/machines/leisure.ts) just ended: mood lifts for a while. */
export function noteLeisure(sim: Sim, id: number): void {
  if (hasMood(sim, id)) ensureMood(sim, id).relax = MOOD_RELAX_SEC;
}

/** A sleep just ended, in a bed or on the floor. */
export function noteSleep(sim: Sim, id: number, inBed: boolean): void {
  if (!hasMood(sim, id)) return;
  const m = ensureMood(sim, id);
  m.sleep = MOOD_SLEEP_SEC;
  m.bed = inBed ? 1 : -1;
}

/** The factors that make up a crew member's mood right now. Pure read; the counters in `m` supply the memory. */
export function moodFactors(sim: Sim, id: number, m: Mood): MoodFactor[] {
  const out: MoodFactor[] = [];
  const add = (key: string, value: number): void => void out.push({ key, value });
  const needs = sim.world.get(id, NeedsC);
  const hunger = needs?.hunger;
  if (hunger !== undefined) {
    if (hunger <= 0) add('starving', -25);
    else if (hunger < 35) add('hungry', -10);
    else if (hunger < 60) add('peckish', -3);
    else if (hunger >= 85) add('wellFed', 4);
  }
  const rest = needs?.rest ?? 100;
  if (rest < 10) add('exhausted', -15);
  else if (rest < 30) add('tired', -8);
  else if (rest >= 85) add('rested', 4);
  if (m.meal > 0) {
    const lift = sim.content.items[m.mealItem ?? '']?.food?.mood ?? { key: 'hotMeal', points: 6 };
    add(lift.key, lift.points);
  }
  if ((m.relax ?? 0) > 0) add('relaxed', MOOD_RELAX_POINTS);
  if ((m.letOut ?? 0) > 0) add('letOut', BREAK_LET_OUT_POINTS);
  if ((m.scene ?? 0) > 0) add('scene', BREAK_SCENE_MOOD);
  if (m.sleep > 0) add(m.bed > 0 ? 'bed' : 'floor', m.bed > 0 ? 5 : -6);

  const pos = sim.world.get(id, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  if (pos && grid?.has('light') && grid.inBounds(pos.x, pos.y)) {
    if (grid.get('light', pos.x, pos.y) < LIGHT_DARK_BELOW) add('dark', -5);
    if (!hasSuitAir(sim, id)) {
      const o2 = grid.get('o2', pos.x, pos.y);
      if (o2 < O2_HARM_BELOW) add('thinAir', -20);
      else if (o2 < O2_ALERT_BELOW) add('staleAir', -8);
    }
    if (grid.get('smoke', pos.x, pos.y) > 40) add('smoky', -6);
    const temp = grid.get('temp', pos.x, pos.y);
    if (temp > 40 || temp < 5) add('temperature', -6);
  }
  if (m.alone >= MOOD_LONELY_SEC) add('lonely', -4);
  else if (m.alone === 0) add('company', 3);
  out.push(...bondFactors(sim, id, m));
  return applyTraitMood(sim, id, m, out, (o) => hasMood(sim, o));
}

/** True when another living crew member of the same side stands within MOOD_COMPANY_RADIUS tiles on the same grid. */
export function hasCompany(sim: Sim, id: number): boolean {
  const pos = sim.world.get(id, PositionC);
  if (!pos) return true; // aboard a shuttle: with whoever else is aboard, not lonely
  for (const other of sim.world.query(CrewC, PositionC)) {
    if (other === id || sim.world.has(other, DeadC) || !hasMood(sim, other)) continue;
    const p = sim.world.get(other, PositionC);
    if (p && shipIdOf(sim, p) === shipIdOf(sim, pos) && Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y)) <= MOOD_COMPANY_RADIUS) return true;
  }
  return false;
}

/** Total of a factor list. */
export const moodScore = (factors: readonly MoodFactor[]): number => Math.max(0, Math.min(100, Math.round(MOOD_BASE + factors.reduce((n, f) => n + f.value, 0))));

/** Low mood slows work (crew without a Mood, robots among them, are unaffected). */
export const moodModifiers: ModifierSource = (sim, entity) => {
  const m = sim.world.get(entity, MoodC);
  if (!m || m.value >= MOOD_LOW) return NONE;
  return [{ stat: 'workSpeed', op: 'mul', value: m.value < MOOD_VERY_LOW ? MOOD_VERY_LOW_WORK_MULT : MOOD_LOW_WORK_MULT }];
};

/** True when the crew member's mood is low enough to be a breakdown risk: the top tier of the low-mood chance (`breakBase`, crew/breakdown.ts). */
export function breakdownRisk(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, MoodC);
  return !!m && m.value < MOOD_BREAKDOWN_BELOW;
}
