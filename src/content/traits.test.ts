import { describe, expect, it } from 'vitest';
import { content } from '.';
import { legacyIntent } from '../sim/ai/policy';
import { CrewC, HealthC, NeedsC, PositionC } from '../sim/crew/components';
import { environmentModifiers } from '../sim/crew/conditions';
import { wantsToEat } from '../sim/crew/eating';
import { ensureMood, MOOD_LABELS, moodFactors } from '../sim/crew/mood';
import { rollStartingCrew } from '../sim/crew/roll';
import { createCrew } from '../sim/crew/spawn';
import { RolledSkillsC, TraitsC, bleedOutSec, traitMult } from '../sim/crew/traits';
import { suitModifiers } from '../sim/eva/conditions';
import { SuitC } from '../sim/eva/components';
import { AllegianceC } from '../sim/fight/components';
import { wantsToSurrender } from '../sim/fight/surrender';
import { newGame } from '../sim/newGame';
import { shipIdOf, shipGrid } from '../sim/regions';
import type { Sim } from '../sim/sim';
import { stat } from '../sim/stats';
import { applyEffect } from '../sim/story/effects';
import { SkillXpC } from '../sim/story/components';
import { suitsSystem } from '../sim/systems/suits';
import { BLEED_OUT_SECONDS, CREW_MAX_HP } from '../sim/tuning';
import { traits } from './traits';

const PENDING = ['trait.hot_headed', 'trait.peacemaker', 'trait.protective', 'trait.pyrophobic', 'trait.space_sick', 'trait.dark_fear', 'trait.battle_shy', 'trait.drinker', 'trait.stim_hooked'];

/** A plain starter game (role skills, no traits) and its crew. */
function game(): { sim: Sim; crew: number[] } {
  const sim = newGame(1, content);
  return { sim, crew: [...sim.world.query(CrewC)] };
}
const give = (sim: Sim, id: number, ...ids: string[]): void => sim.world.add(id, TraitsC, { ids });
const roleOf = (sim: Sim, role: string): number => sim.world.query(CrewC).find((id) => sim.world.get(id, CrewC)?.role === role) as number;
/** Put `b` next to `a` (same grid). */
function beside(sim: Sim, a: number, b: number): void {
  const p = sim.world.get(a, PositionC)!;
  Object.assign(sim.world.get(b, PositionC)!, { x: p.x + 1, y: p.y, toX: p.x + 1, toY: p.y, progress: 0 });
}
const factor = (sim: Sim, id: number, key: string): number | undefined => moodFactors(sim, id, ensureMood(sim, id)).find((f) => f.key === key)?.value;
function setTile(sim: Sim, id: number, field: 'light' | 'o2', v: number): void {
  const p = sim.world.get(id, PositionC)!;
  shipGrid(sim, shipIdOf(sim, p))!.set(field, p.x, p.y, v);
}

describe('trait content', () => {
  it('excludes point at real traits, both ways, and pending mechanics are not rollable', () => {
    for (const [id, t] of Object.entries(traits) as [string, { excludes?: readonly string[]; rollable: boolean; effect: string; flavour: string }][]) {
      expect(t.effect.length, id).toBeGreaterThan(0);
      expect(t.flavour.length, id).toBeGreaterThan(0);
      for (const x of t.excludes ?? []) {
        expect(traits[x as keyof typeof traits], `${id} -> ${x}`).toBeDefined();
        expect((traits[x as keyof typeof traits] as { excludes?: readonly string[] }).excludes ?? [], `${x} -> ${id}`).toContain(id);
      }
      expect(t.rollable, id).toBe(!PENDING.includes(id));
    }
  });
});

describe('the starting crew roll', () => {
  it("is the same for a seed, and rerolling one slot changes nothing else: not sim.rng, not the other crew, not where they stand", () => {
    const snap = (sim: Sim) => sim.world.query(CrewC).map((id) => ({
      crew: sim.world.get(id, CrewC), pos: sim.world.get(id, PositionC), skills: sim.world.get(id, RolledSkillsC), traits: sim.world.get(id, TraitsC),
    }));
    const a = newGame(9, content, 'ship.starter', false, 'rolled');
    const b = newGame(9, content, 'ship.starter', false, 'rolled');
    expect(snap(b)).toEqual(snap(a));
    const picks = content.ships['ship.starter'].crew.map((role, i) => ({ role, rerolls: i === 3 ? 5 : 0 }));
    const c = newGame(9, content, 'ship.starter', false, picks);
    expect(c.rng.getState()).toBe(a.rng.getState());
    const [sa, sc] = [snap(a), snap(c)];
    expect(sc.slice(0, 3)).toEqual(sa.slice(0, 3));
    expect(sc.map((x) => x.pos)).toEqual(sa.map((x) => x.pos));
    expect(sc[3]).not.toEqual(sa[3]);
    // What the crew screen previews is what the game creates.
    const preview = rollStartingCrew(9, picks, content);
    expect(sc.map((x) => x.crew?.name)).toEqual(preview.map((p) => p.name));
    expect(sc.map((x) => x.skills?.skills)).toEqual(preview.map((p) => p.skills));
  });

  it('gives every rolled crew member a full skill snapshot', () => {
    const sim = newGame(3, content, 'ship.starter', false, 'rolled');
    for (const id of sim.world.query(CrewC)) expect(sim.world.get(id, RolledSkillsC)).toBeDefined();
  });
});

describe('rolled skills', () => {
  it('replace the role skills (a missing skill is 0); XP stacks on top; crew without a roll keep the role skills', () => {
    const { sim } = game();
    const gunner = roleOf(sim, 'role.gunner');
    expect(stat(sim, gunner, 'gunnery')).toBe(3); // old-shape crew: the role's
    sim.world.add(gunner, RolledSkillsC, { skills: { piloting: 2 } });
    expect(stat(sim, gunner, 'gunnery')).toBe(0);
    expect(stat(sim, gunner, 'piloting')).toBe(2);
    sim.world.add(gunner, SkillXpC, { xp: { piloting: 100 } });
    expect(stat(sim, gunner, 'piloting')).toBe(3);
  });
});

describe('stat traits', () => {
  it('apply through the resolver', () => {
    const { sim, crew } = game();
    const [a, b, c, d] = crew as [number, number, number, number];
    const before = (id: number) => Object.fromEntries((['moveSpeed', 'restDecay', 'carryCapacity', 'melee', 'workSpeed', 'gunnery', 'piloting'] as const).map((k) => [k, stat(sim, id, k)]));
    const [ba, bb, bc, bd] = [before(a), before(b), before(c), before(d)];
    give(sim, a, 'trait.quick');
    expect(stat(sim, a, 'moveSpeed')).toBeCloseTo(ba.moveSpeed! * 1.15);
    expect(stat(sim, a, 'restDecay')).toBeCloseTo(ba.restDecay! * 1.15);
    give(sim, b, 'trait.strong', 'trait.workaholic');
    expect(stat(sim, b, 'carryCapacity')).toBeCloseTo(bb.carryCapacity! * 1.5);
    expect(stat(sim, b, 'melee')).toBe(bb.melee! + 1);
    expect(stat(sim, b, 'workSpeed')).toBeCloseTo(bb.workSpeed! * 1.15);
    give(sim, c, 'trait.clumsy', 'trait.natural_pilot');
    expect(stat(sim, c, 'workSpeed')).toBeCloseTo(bc.workSpeed! * 0.95);
    expect(stat(sim, c, 'gunnery')).toBe(bc.gunnery! - 1);
    expect(stat(sim, c, 'piloting')).toBe(bc.piloting! + 1);
    give(sim, d, 'trait.marksman', 'trait.lazy');
    expect(stat(sim, d, 'gunnery')).toBe(bd.gunnery! + 1);
    expect(stat(sim, d, 'workSpeed')).toBeCloseTo(bd.workSpeed! * 0.9);
  });
});

describe('trade-off and behaviour hooks', () => {
  it('Tough and Bookish change max hp; Tough lasts longer downed', () => {
    const { sim } = game();
    const ship = shipIdOf(sim, sim.world.get(sim.world.query(CrewC)[0]!, PositionC)!);
    const roll = (t: string[]) => ({ role: 'role.medic', name: 'X', appearanceSeed: 1, rest: 80, skills: { medicine: 3 }, traits: t, label: null });
    const tough = createCrew(sim, ship, 'role.medic', { x: 3, y: 3 }, { faction: 'player', rolled: roll(['trait.tough']) });
    const bookish = createCrew(sim, ship, 'role.medic', { x: 3, y: 3 }, { faction: 'player', rolled: roll(['trait.bookish']) });
    expect(sim.world.get(tough, HealthC)?.max).toBe(Math.round(CREW_MAX_HP * 1.2));
    expect(sim.world.get(bookish, HealthC)?.max).toBe(Math.round(CREW_MAX_HP * 0.85));
    expect(bleedOutSec(sim, tough)).toBe(BLEED_OUT_SECONDS * 1.5);
    expect(sim.world.get(tough, RolledSkillsC)?.skills).toEqual({ medicine: 3 });
  });

  it('hunger: Glutton drains faster and eats sooner, Small appetite slower', () => {
    const { sim, crew } = game();
    const [a, b, c] = crew as [number, number, number];
    give(sim, a, 'trait.glutton');
    give(sim, b, 'trait.small_appetite');
    for (const id of [a, b, c]) sim.world.get(id, NeedsC)!.hunger = 90;
    for (let i = 0; i < 400; i++) sim.step();
    const drop = (id: number) => 90 - (sim.world.get(id, NeedsC)!.hunger as number);
    expect(drop(a) / drop(c)).toBeCloseTo(1.3, 1);
    expect(drop(b) / drop(c)).toBeCloseTo(0.7, 1);
    for (const id of [a, c]) sim.world.get(id, NeedsC)!.hunger = 45;
    expect(wantsToEat(sim, a, false)).toBe(true);
    expect(wantsToEat(sim, c, false)).toBe(false);
  });

  it('Workaholic stays up like an operator; Lazy wanders more', () => {
    const { sim, crew } = game();
    const [a, b] = crew as [number, number];
    give(sim, a, 'trait.workaholic');
    give(sim, b, 'trait.lazy');
    for (const id of [a, b]) sim.world.get(id, NeedsC)!.rest = 10;
    expect(legacyIntent(sim, a, false).sleep).toBe(false);
    expect(legacyIntent(sim, b, false).sleep).toBe(true);
    expect(traitMult(sim, b, 'wanderMult')).toBe(3);
  });

  it('Dark-adapted ignores the dark; Void-born walks normally in a suit and its tank lasts longer', () => {
    const { sim, crew } = game();
    const [a, b] = crew as [number, number];
    give(sim, a, 'trait.dark_adapted', 'trait.void_born');
    for (const id of [a, b]) setTile(sim, id, 'light', 0);
    expect(environmentModifiers(sim, a).some((m) => m.stat === 'moveSpeed')).toBe(false);
    expect(environmentModifiers(sim, b).some((m) => m.stat === 'moveSpeed')).toBe(true);
    for (const id of [a, b]) {
      sim.world.add(id, SuitC, { worn: true, air: 100 });
      setTile(sim, id, 'o2', 0);
    }
    expect(suitModifiers(sim, a).find((m) => m.stat === 'moveSpeed')?.value).toBe(1);
    expect(suitModifiers(sim, b).find((m) => m.stat === 'moveSpeed')?.value).toBe(0.8);
    for (let i = 0; i < 60; i++) suitsSystem(sim);
    expect(100 - (sim.world.get(a, SuitC)!.air as number)).toBeCloseTo(2, 5);
    expect(100 - (sim.world.get(b, SuitC)!.air as number)).toBeCloseTo(3, 5);
  });

  it('Brave never surrenders; a Coward on the player side does when hurt and outnumbered', () => {
    const { sim, crew } = game();
    const [me, f1, f2] = crew as [number, number, number];
    beside(sim, me, f1);
    beside(sim, me, f2);
    sim.world.get(me, HealthC)!.hp = 20;
    expect(wantsToSurrender(sim, me, [me], [f1, f2])).toBe(false); // player crew never do
    give(sim, me, 'trait.coward');
    expect(wantsToSurrender(sim, me, [me], [f1, f2])).toBe(true);
    sim.world.get(me, AllegianceC)!.faction = 'hostile';
    give(sim, me);
    expect(wantsToSurrender(sim, me, [me], [f1, f2])).toBe(true); // NPC default
    give(sim, me, 'trait.brave');
    expect(wantsToSurrender(sim, me, [me], [f1, f2])).toBe(false);
  });

  it('Gifted and Bookish learn faster from story XP', () => {
    const { sim } = game();
    const [a, b] = [roleOf(sim, 'role.engineer'), roleOf(sim, 'role.medic')];
    give(sim, a, 'trait.gifted');
    give(sim, b, 'trait.bookish');
    applyEffect(sim, { type: 'skillXp', skill: 'repair', amount: 100, who: 'all' }, { event: 't', actor: null });
    applyEffect(sim, { type: 'skillXp', skill: 'medicine', amount: 100, who: 'all' }, { event: 't', actor: null });
    expect(sim.world.get(a, SkillXpC)?.xp).toEqual({ repair: 150, medicine: 150 });
    expect(sim.world.get(b, SkillXpC)?.xp).toEqual({ repair: 100, medicine: 150 });
  });
});

describe('mood traits', () => {
  it('Cheerful lifts itself and the crew beside it; Gloomy drags them down', () => {
    const { sim, crew } = game();
    const [a, b, c] = crew as [number, number, number];
    beside(sim, a, b);
    give(sim, a, 'trait.cheerful');
    expect(factor(sim, a, 'trait:Cheerful')).toBe(5);
    expect(factor(sim, b, 'cheeredUp')).toBe(2);
    give(sim, c, 'trait.gloomy');
    beside(sim, c, b);
    expect(factor(sim, c, 'trait:Gloomy')).toBe(-5);
    expect(factor(sim, b, 'draggedDown')).toBe(-1);
  });

  it('Stoic halves and Sensitive multiplies every factor', () => {
    const { sim, crew } = game();
    const [a] = crew as [number];
    sim.world.get(a, NeedsC)!.rest = 5; // exhausted -15
    sim.world.get(a, NeedsC)!.hunger = 20; // hungry -10
    expect(factor(sim, a, 'exhausted')).toBe(-15);
    give(sim, a, 'trait.stoic');
    expect(factor(sim, a, 'exhausted')).toBe(-8);
    expect(factor(sim, a, 'hungry')).toBe(-5);
    give(sim, a, 'trait.sensitive');
    expect(factor(sim, a, 'hungry')).toBe(-15);
  });

  it('Loner and Social change company and loneliness', () => {
    const { sim, crew } = game();
    const [a, b] = crew as [number, number];
    beside(sim, a, b);
    expect(factor(sim, a, 'company')).toBe(3);
    give(sim, a, 'trait.social');
    expect(factor(sim, a, 'company')).toBe(6);
    give(sim, a, 'trait.loner');
    expect(factor(sim, a, 'company')).toBeUndefined();
    ensureMood(sim, a).alone = 5;
    expect(factor(sim, a, 'alone')).toBe(3);
    ensureMood(sim, a).alone = 0;
    for (const o of crew.slice(1)) beside(sim, a, o);
    expect(factor(sim, a, 'crowded')).toBe(-4);
  });

  it('Small appetite halves food mood; Thrill-seeker, Void-born, Gifted and Dark-adapted have their moments', () => {
    const { sim, crew } = game();
    const [a, b, c, d] = crew as [number, number, number, number];
    sim.world.get(a, NeedsC)!.hunger = 95;
    give(sim, a, 'trait.small_appetite');
    expect(factor(sim, a, 'wellFed')).toBe(2);
    give(sim, b, 'trait.thrill_seeker');
    expect(factor(sim, b, 'thrill')).toBeUndefined();
    ensureMood(sim, b).quiet = 1000;
    expect(factor(sim, b, 'bored')).toBe(-3);
    sim.sector.inCombat = true;
    expect(factor(sim, b, 'thrill')).toBe(6);
    give(sim, c, 'trait.void_born', 'trait.gifted');
    ensureMood(sim, c).inside = 2000;
    ensureMood(sim, c).idle = 20;
    expect(factor(sim, c, 'cooped')).toBe(-3);
    expect(factor(sim, c, 'restless')).toBe(-3);
    give(sim, d, 'trait.dark_adapted');
    setTile(sim, d, 'light', 0);
    expect(factor(sim, d, 'dark')).toBeUndefined();
    setTile(sim, d, 'light', 230);
    expect(factor(sim, d, 'glare')).toBe(-3);
  });

  it('Pyrophobic, Space-sick and Afraid of the dark each have their mood factor, with their labels, and only with the trait', () => {
    const { sim, crew } = game();
    const [a, b, c, d] = crew as [number, number, number, number];
    give(sim, a, 'trait.pyrophobic');
    give(sim, b, 'trait.space_sick');
    give(sim, c, 'trait.dark_fear');
    const pa = sim.world.get(a, PositionC)!;
    const fire = (dx: number, v: number): void => shipGrid(sim, shipIdOf(sim, pa))!.set('fire', pa.x + dx, pa.y, v);
    expect(factor(sim, a, 'fireNearby')).toBeUndefined();
    fire(7, 80);
    expect(factor(sim, a, 'fireNearby')).toBeUndefined();
    fire(7, 0);
    fire(6, 80);
    expect(factor(sim, a, 'fireNearby')).toBe(-6);
    fire(6, 0);
    expect(factor(sim, a, 'fireNearby')).toBeUndefined();
    const pd = sim.world.get(d, PositionC)!;
    shipGrid(sim, shipIdOf(sim, pd))!.set('fire', pd.x, pd.y, 80);
    expect(factor(sim, d, 'fireNearby')).toBeUndefined();

    expect(factor(sim, b, 'spacewalk')).toBeUndefined();
    sim.world.add(b, SuitC, { worn: true, air: 100 });
    expect(factor(sim, b, 'spacewalk')).toBeUndefined(); // suited but inside
    setTile(sim, b, 'o2', 0);
    expect(factor(sim, b, 'spacewalk')).toBe(-4);
    sim.world.add(d, SuitC, { worn: true, air: 100 });
    setTile(sim, d, 'o2', 0);
    expect(factor(sim, d, 'spacewalk')).toBeUndefined();

    setTile(sim, c, 'light', 0);
    setTile(sim, d, 'light', 0);
    expect(factor(sim, c, 'dark')).toBe(-10);
    expect(factor(sim, d, 'dark')).toBe(-5);
    expect(moodFactors(sim, c, ensureMood(sim, c)).filter((f) => f.key === 'dark')).toHaveLength(1);

    expect(MOOD_LABELS.fireNearby).toBe('Fire nearby');
    expect(MOOD_LABELS.spacewalk).toBe('Spacewalk');
  });

  it('the renamed Space-sick trait exists and the old id is gone; all three phobias stay unrollable', () => {
    expect(traits['trait.space_sick'].name).toBe('Space-sick');
    expect(Object.keys(traits)).not.toContain('trait.void_fear');
    for (const id of ['trait.pyrophobic', 'trait.space_sick', 'trait.dark_fear']) expect((traits as Record<string, { rollable: boolean }>)[id]!.rollable).toBe(false);
  });

  it('the mood system keeps trait memory only for the traits that read it', () => {
    const { sim, crew } = game();
    const [a, b] = crew as [number, number];
    give(sim, a, 'trait.gifted');
    for (let i = 0; i < 40; i++) sim.step();
    expect(ensureMood(sim, a).idle).toBeDefined();
    expect(ensureMood(sim, b)).not.toHaveProperty('idle');
  });
});
