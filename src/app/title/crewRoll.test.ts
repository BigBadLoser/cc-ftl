import { describe, expect, it } from 'vitest';
import { content } from '../../content';
import { AllegianceC, CrewC, RolledSkillsC, TraitsC, newGame, startingRoles } from '../../sim';
import { planOf } from '../saves';
import { previewCrew } from './crewRoll';

describe('the crew screen', () => {
  const ship = 'ship.wayfarer';
  const roles = startingRoles(content, ship);
  const plan = { seed: 4242, ship, picks: roles.map((role, i) => ({ role, rerolls: i === 1 ? 3 : i === 2 ? 1 : 0, ...(i === 0 ? { name: 'Ada' } : {}) })) };

  it('starts the game with exactly the crew it showed: names, traits and rolled skills', () => {
    const preview = previewCrew(content, plan);
    // Start stores the plan as JSON and the reload reads it back (app/saves.ts).
    const back = planOf(JSON.stringify({ seed: plan.seed, picks: plan.picks }), ship)!;
    const sim = newGame(back.seed, content, ship, false, back.picks);
    const crew = sim.world.query(CrewC).filter((id) => sim.world.get(id, AllegianceC)?.faction === 'player');
    const started = crew.map((id) => ({
      name: sim.world.get(id, CrewC)!.name,
      role: sim.world.get(id, CrewC)!.role,
      traits: sim.world.get(id, TraitsC)?.ids ?? [],
      skills: sim.world.get(id, RolledSkillsC)?.skills ?? {},
    }));
    const shown = preview.map((c) => ({
      name: c.name, role: c.role, traits: c.traits.map((t) => t.id),
      skills: Object.fromEntries(c.skills.filter((s) => s.rolled > 0).map((s) => [s.skill, s.rolled])),
    }));
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    expect(started.map((s) => ({ ...s, skills: Object.fromEntries(Object.entries(s.skills).filter(([, v]) => (v ?? 0) > 0)) })).sort(byName)).toEqual(shown.sort(byName));
    expect(preview[0]!.name).toBe('Ada');
  });

  it('keys each slot by its reroll count, so stepping back returns the earlier roll', () => {
    const a = previewCrew(content, plan)[1]!;
    const more = previewCrew(content, { ...plan, picks: plan.picks.map((p, i) => (i === 1 ? { ...p, rerolls: 4 } : p)) })[1]!;
    const again = previewCrew(content, plan)[1]!;
    expect(again).toEqual(a);
    expect(more.rerolls).toBe(4);
    expect(previewCrew(content, plan)[0]).toEqual(previewCrew(content, { ...plan, picks: plan.picks.map((p, i) => (i === 1 ? { ...p, rerolls: 9 } : p)) })[0]);
  });

  it('reads back only a well-formed plan for the ship (roles come from the ship, names are trimmed)', () => {
    expect(planOf(null, ship)).toBeNull();
    expect(planOf('not json', ship)).toBeNull();
    expect(planOf(JSON.stringify({ seed: 1, picks: [{}] }), ship)).toBeNull();
    const p = planOf(JSON.stringify({ seed: 7, picks: roles.map(() => ({ role: 'role.robot_worker', rerolls: -2, name: '  Zed  ' })) }), ship)!;
    expect(p.picks.map((x) => x.role)).toEqual(roles);
    expect(p.picks.every((x) => x.rerolls === 0 && x.name === 'Zed')).toBe(true);
  });
});
