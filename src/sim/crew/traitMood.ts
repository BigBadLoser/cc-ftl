import { shipIdOf, shipGrid } from '../regions';
import { isSuited, isThin } from '../eva/suit';
import { FighterC } from '../fight/components';
import type { Sim } from '../sim';
import {
  DARK_FEAR_MOOD, FIRE_FEAR_MOOD, FIRE_FEAR_RADIUS, LIGHT_GLARE_ABOVE, SPACE_SICK_MOOD, MOOD_COMPANY_RADIUS, MOOD_CROWD, TRAIT_BORED_SEC, TRAIT_COOPED_SEC,
} from '../tuning';
import { AssignmentC, CrewC, DeadC, PositionC, type Mood, type MoodFactor } from './components';
import { traitDefs, traitEffect, traitFlag, traitMult } from './traits';

/** Mood factor labels added by traits (merged into MOOD_LABELS). */
export const TRAIT_MOOD_LABELS: Readonly<Record<string, string>> = {
  alone: 'Alone (loner)', crowded: 'Crowded', cheeredUp: 'Cheered up', draggedDown: 'Dragged down',
  thrill: 'Thrill of danger', bored: 'Bored', cooped: 'Cooped up', fireNearby: 'Fire nearby', spacewalk: 'Spacewalk', glare: 'Glare', idle: 'Nothing to do', restless: 'Restless',
};

/** In combat (the sector fight, or engaging a foe) or on EVA (suited, on thin air): what a Thrill-seeker lives for. */
function inDanger(sim: Sim, id: number): boolean {
  if (sim.sector.inCombat || sim.world.get(id, FighterC)?.mode === 'engage') return true;
  return onEva(sim, id);
}

function onEva(sim: Sim, id: number): boolean {
  if (!isSuited(sim, id)) return false;
  const pos = sim.world.get(id, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  return !!pos && !!grid && isThin(grid, pos.x, pos.y);
}

const idleNow = (sim: Sim, id: number): boolean => sim.world.get(id, CrewC)?.activity === 'idle' && !sim.world.has(id, AssignmentC);

/**
 * Trait memory counters on the Mood (seconds idle, since danger, since EVA), advanced by `dt`. Only the counters a crew member's
 * traits read are kept, so crew without those traits keep the Mood shape they had.
 */
export function advanceTraitMemory(sim: Sim, id: number, m: Mood, dt: number): void {
  if (traitEffect(sim, id, 'idleMood')) m.idle = idleNow(sim, id) ? (m.idle ?? 0) + dt : 0;
  if (traitFlag(sim, id, 'thrill')) m.quiet = inDanger(sim, id) ? 0 : (m.quiet ?? 0) + dt;
  if (traitFlag(sim, id, 'voidHome')) m.inside = onEva(sim, id) ? 0 : (m.inside ?? 0) + dt;
}

/** Other living mood crew of the same side within MOOD_COMPANY_RADIUS, on the same grid. */
function nearbyCrew(sim: Sim, id: number, hasMood: (o: number) => boolean): number[] {
  const pos = sim.world.get(id, PositionC);
  if (!pos) return [];
  const out: number[] = [];
  const ship = shipIdOf(sim, pos);
  for (const other of sim.world.query(CrewC, PositionC)) {
    if (other === id || sim.world.has(other, DeadC) || !hasMood(other)) continue;
    const p = sim.world.get(other, PositionC);
    if (p && shipIdOf(sim, p) === ship && Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y)) <= MOOD_COMPANY_RADIUS) out.push(other);
  }
  return out;
}

/** True if any player crew member has a trait with a mood aura (Cheerful, Gloomy): only then do auras need a scan. */
function anyAura(sim: Sim): boolean {
  for (const t of Object.values(sim.content.traits ?? {})) if (t.effects?.aura && t.rollable) return true;
  return false;
}

/**
 * Apply a crew member's traits (and nearby crew's mood auras) to their base mood factors: food factors scaled, darkness ignored,
 * company and loneliness changed, the trait factors added, then everything scaled by Stoic / Sensitive. docs/TRAITS.md section 4.
 */
export function applyTraitMood(sim: Sim, id: number, m: Mood, base: MoodFactor[], hasMood: (o: number) => boolean): MoodFactor[] {
  const defs = traitDefs(sim, id);
  const auras = anyAura(sim);
  if (defs.length === 0 && !auras) return base;
  let out = base;
  const food = traitMult(sim, id, 'foodMoodMult');
  if (food !== 1) out = out.map((f) => (f.key === 'wellFed' || f.key === 'hotMeal' ? { key: f.key, value: f.value * food } : f));
  if (traitFlag(sim, id, 'darkAdapted')) out = out.filter((f) => f.key !== 'dark');
  const company = traitEffect(sim, id, 'company');
  const near = company === 'loner' || auras ? nearbyCrew(sim, id, hasMood) : [];
  if (company === 'loner') {
    out = out.filter((f) => f.key !== 'lonely' && f.key !== 'company');
    if (m.alone > 0) out.push({ key: 'alone', value: 3 });
    else if (near.length >= MOOD_CROWD) out.push({ key: 'crowded', value: -4 });
  } else if (company === 'social') {
    out = out.map((f) => (f.key === 'company' ? { key: f.key, value: 6 } : f.key === 'lonely' ? { key: f.key, value: -8 } : f));
  }
  for (const d of defs) {
    const e = d.effects;
    if (e?.mood) out.push({ key: traitKey(d.name), value: e.mood });
  }
  for (const other of near) {
    for (const d of traitDefs(sim, other)) {
      const a = d.effects?.aura;
      if (a && !out.some((f) => f.key === (a > 0 ? 'cheeredUp' : 'draggedDown'))) out.push({ key: a > 0 ? 'cheeredUp' : 'draggedDown', value: a });
    }
  }
  if (traitFlag(sim, id, 'thrill')) {
    if (inDanger(sim, id)) out.push({ key: 'thrill', value: 6 });
    else if ((m.quiet ?? 0) >= TRAIT_BORED_SEC) out.push({ key: 'bored', value: -3 });
  }
  if (traitFlag(sim, id, 'voidHome') && (m.inside ?? 0) >= TRAIT_COOPED_SEC) out.push({ key: 'cooped', value: -3 });
  if (traitFlag(sim, id, 'darkFear')) out = out.map((f) => (f.key === 'dark' ? { key: f.key, value: DARK_FEAR_MOOD } : f));
  if (traitFlag(sim, id, 'fireFear') && fireNearby(sim, id)) out.push({ key: 'fireNearby', value: FIRE_FEAR_MOOD });
  if (traitFlag(sim, id, 'spaceSick') && onEva(sim, id)) out.push({ key: 'spacewalk', value: SPACE_SICK_MOOD });
  if (traitFlag(sim, id, 'darkAdapted') && brightTile(sim, id)) out.push({ key: 'glare', value: -3 });
  for (const d of defs) {
    const idle = d.effects?.idleMood;
    if (idle && (m.idle ?? 0) >= idle.afterSec) out.push({ key: idle.key, value: idle.value });
  }
  const scale = traitMult(sim, id, 'moodScale');
  if (scale !== 1) out = out.map((f) => ({ key: f.key, value: f.value * scale }));
  // Whole points, halves away from zero (a halved -15 is -8).
  return out.map((f) => (Number.isInteger(f.value) ? f : { key: f.key, value: Math.sign(f.value) * Math.round(Math.abs(f.value)) }));
}

/** The mood factor key of a trait's flat mood ('trait:Cheerful'); the UI shows the trait's name. */
export const traitKey = (name: string): string => `trait:${name}`;

function brightTile(sim: Sim, id: number): boolean {
  const pos = sim.world.get(id, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  return !!pos && !!grid?.has('light') && grid.inBounds(pos.x, pos.y) && grid.get('light', pos.x, pos.y) >= LIGHT_GLARE_ABOVE;
}


/** True if a tile burns within FIRE_FEAR_RADIUS of the crew member (a small square scan; only Pyrophobic crew, at the mood cadence). */
function fireNearby(sim: Sim, id: number): boolean {
  const pos = sim.world.get(id, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  if (!pos || !grid?.has('fire')) return false;
  const px = Math.round(pos.x), py = Math.round(pos.y);
  for (let y = py - FIRE_FEAR_RADIUS; y <= py + FIRE_FEAR_RADIUS; y++) {
    for (let x = px - FIRE_FEAR_RADIUS; x <= px + FIRE_FEAR_RADIUS; x++) {
      if (grid.inBounds(x, y) && grid.get('fire', x, y) > 0) return true;
    }
  }
  return false;
}
