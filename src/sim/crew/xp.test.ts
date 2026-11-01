import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { ModuleC } from '../modules/components';
import type { ContentRegistry, ModuleDef, SkillName } from '../registry';
import { ResearchC } from '../research/components';
import { spawnTemplateModules } from '../ship';
import { Sim } from '../sim';
import { stat } from '../stats';
import { SkillXpC } from '../story/components';
import { TICK_HZ } from '../time';
import { FTL_CHARGE_SEC, XP_LEVEL_COST, XP_MAX_LEVEL } from '../tuning';
import { CombatC, ShipC } from '../combat/components';
import { newHeat } from '../combat/heat';
import { helmSystem } from '../systems/helm';
import { AllegianceC } from '../fight/components';
import {
  CrewC, DownedC, HealthC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Job,
} from './components';
import { performJob } from './jobWork';
import { TraitsC, RolledSkillsC } from './traits';
import type { TraitDef } from './traitDef';
import { grantXp, levelsFor, xpForLevels, xpProgress } from './xp';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const content: ContentRegistry = {
  ships: {},
  roles: { 'role.fixer': { name: 'Fixer', skills: { repair: 1 }, priorities: {} } as never },
  species: {
    'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6, mood: true },
    'species.bot': { name: 'B', moveSpeed: 2.5, workSpeed: 1, restDecay: 0 },
  },
  modules: { helm: mod({ console: 'helm' }), engine: mod({ engine: { evasionPerPower: 1 }, power: -1 }), panel: mod({}), lab: mod({ research: true }), bed: mod({ bed: true, footprint: [1, 2] }), core: mod({}) },
  crewNames: [],
  items: {},
  recipes: {},
  structCosts: {},
  research: { 'research.x': { name: 'X', cost: [], work: 1e6, unlocks: [], category: 'c' } },
  traits: { 'trait.gifted': { name: 'Gifted', effects: { xpMult: 1.5 } } as unknown as TraitDef },
};
const rows = ['..........', '.########.', '.#______#.', '.#______#.', '.########.', '..........'];
const speciesOf = { human: 'species.human', bot: 'species.bot' };

function make(): Sim {
  const sim = new Sim(5, content);
  stampShip(sim, { name: 't', rows }, { faction: 'player', state: 'prize', x: 0, y: 0 });
  spawnTemplateModules(sim, 1, { name: 't', rows, modules: [
    { def: 'panel', x: 3, y: 2, rot: 0 }, { def: 'lab', x: 4, y: 2, rot: 0 }, { def: 'core', x: 5, y: 2, rot: 0 }, { def: 'bed', x: 7, y: 2, rot: 0 },
    { def: 'helm', x: 3, y: 3, rot: 0 }, { def: 'engine', x: 6, y: 3, rot: 0 },
  ] });
  return sim;
}
function person(sim: Sim, species: string, x = 3, y = 3): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'role.fixer', species, appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, {} as never);
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: 100, max: 100 });
  sim.world.add(id, AllegianceC, { faction: 'player' });
  return id;
}
const xpOf = (sim: Sim, id: number, skill: SkillName): number => sim.world.get(id, SkillXpC)?.xp[skill] ?? 0;
const moduleId = (sim: Sim, def: string): number => sim.world.query(ModuleC).find((i) => sim.world.get(i, ModuleC)?.def === def) as number;
const job = (kind: Job['kind'], target: number, work = 1e6): Job =>
  ({ category: 'repair', kind, x: 3, y: 3, struct: 0, work, progress: 0, reservedBy: 0, target }) as Job;

describe('the XP curve', () => {
  it('costs XP_LEVEL_COST x n^2 for level n on top of the earlier levels, and stops at the cap', () => {
    expect([0, 1, 2, 3, 4, 5].map(xpForLevels)).toEqual([0, 100, 500, 1400, 3000, 5500]);
    expect(levelsFor(160)).toBe(1);
    expect(xpProgress(160)).toEqual({ xp: 60, per: 400 });
    for (let n = 0; n <= XP_MAX_LEVEL; n++) {
      expect(levelsFor(xpForLevels(n))).toBe(n);
      expect(levelsFor(xpForLevels(n))).toBe(n);
      if (n > 0) expect(levelsFor(xpForLevels(n) - 1)).toBe(n - 1);
    }
    expect(levelsFor(xpForLevels(XP_MAX_LEVEL) * 100)).toBe(XP_MAX_LEVEL);
    expect(levelsFor(-5)).toBe(0);
  });

  it('reports progress within the current level, and none at the cap', () => {
    expect(xpProgress(xpForLevels(2) + 30)).toEqual({ xp: 30, per: xpForLevels(3) - xpForLevels(2) });
    expect(xpProgress(xpForLevels(XP_MAX_LEVEL))).toEqual({ xp: 0, per: 0 });
  });
});

describe('grantXp', () => {
  it('adds XP, multiplied by Gifted', () => {
    const sim = make();
    const plain = person(sim, speciesOf.human);
    const gifted = person(sim, speciesOf.human);
    sim.world.add(gifted, TraitsC, { ids: ['trait.gifted'] });
    grantXp(sim, plain, 'repair', 40);
    grantXp(sim, gifted, 'repair', 40);
    expect(xpOf(sim, plain, 'repair')).toBe(40);
    expect(xpOf(sim, gifted, 'repair')).toBe(40 * 1.5);
  });

  it('lets robots learn on top of their role skills, and ignores non-crew', () => {
    const sim = make();
    const bot = person(sim, speciesOf.bot);
    const before = stat(sim, bot, 'repair');
    grantXp(sim, bot, 'repair', 500);
    expect(xpOf(sim, bot, 'repair')).toBe(500);
    expect(stat(sim, bot, 'repair')).toBe(before + levelsFor(500));
    grantXp(sim, 9999, 'repair', 500); // not crew at all
  });

  it('takes a penalty as is and never goes below 0', () => {
    const sim = make();
    const id = person(sim, speciesOf.human);
    grantXp(sim, id, 'repair', 10);
    grantXp(sim, id, 'repair', -25);
    expect(xpOf(sim, id, 'repair')).toBe(0);
  });
});

describe('XP from routine work', () => {
  const seconds = (n: number) => n * TICK_HZ;

  it('job progress grants repair XP in proportion to the work done, and none while waiting', () => {
    const sim = make();
    const id = person(sim, speciesOf.human);
    const j = job('forceDoor', 0);
    for (let i = 0; i < seconds(10); i++) performJob(sim, id, j, 1);
    expect(xpOf(sim, id, 'repair')).toBeCloseTo(10);
    const fast = person(sim, speciesOf.human);
    for (let i = 0; i < seconds(10); i++) performJob(sim, fast, job('forceDoor', 0), 2);
    expect(xpOf(sim, fast, 'repair')).toBeCloseTo(20);
    const idle = person(sim, speciesOf.human);
    performJob(sim, idle, { ...job('build', 0), needs: [{ item: 'x', count: 1 }] } as Job, 1); // waits for materials
    expect(sim.world.get(idle, SkillXpC)).toBeUndefined();
  });

  it('a module repair job trains repair and the stat rises after enough work', () => {
    const sim = make();
    const id = person(sim, speciesOf.human);
    const panel = moduleId(sim, 'panel');
    const before = stat(sim, id, 'repair');
    sim.world.get(panel, ModuleC)!.hp = 1;
    const j = job('repair', panel);
    for (let i = 0; i < seconds(XP_LEVEL_COST + 1); i++) {
      sim.world.get(panel, ModuleC)!.hp = 1; // keep it needing repair
      performJob(sim, id, j, 1);
    }
    expect(xpOf(sim, id, 'repair')).toBeGreaterThanOrEqual(XP_LEVEL_COST);
    expect(stat(sim, id, 'repair')).toBe(before + 1);
  });

  it('research grants science XP and hacking grants hacking XP', () => {
    const sim = make();
    const id = person(sim, speciesOf.human);
    sim.world.get(moduleId(sim, 'lab'), ModuleC)!.powered = true;
    sim.world.add(1, ResearchC, { queue: ['research.x'], progress: 0, paid: true });
    for (let i = 0; i < seconds(5); i++) performJob(sim, id, job('research', moduleId(sim, 'lab')), 1);
    expect(xpOf(sim, id, 'science')).toBeCloseTo(5);
    expect(xpOf(sim, id, 'repair')).toBe(0);
    for (let i = 0; i < seconds(5); i++) performJob(sim, id, job('hack', moduleId(sim, 'core')), 1);
    expect(xpOf(sim, id, 'hacking')).toBeCloseTo(5);
  });

  it('bed healing grants medicine XP to the best medic aboard, in proportion to the hp healed', () => {
    const sim = make();
    const medic = person(sim, speciesOf.human, 3, 3);
    const other = person(sim, speciesOf.human, 4, 3);
    sim.world.add(medic, RolledSkillsC, { skills: { medicine: 2 } });
    sim.world.add(other, RolledSkillsC, { skills: { medicine: 1 } });
    const patient = person(sim, speciesOf.human, 5, 3);
    sim.world.get(patient, HealthC)!.hp = 10;
    sim.world.add(patient, DownedC, { bleed: 60, stabilized: true, bed: 0 });
    const hp0 = sim.world.get(patient, HealthC)!.hp;
    for (let i = 0; i < seconds(5); i++) sim.step();
    const healed = sim.world.get(patient, HealthC)!.hp - hp0;
    expect(healed).toBeGreaterThan(0);
    expect(xpOf(sim, medic, 'medicine')).toBeGreaterThan(0);
    expect(xpOf(sim, other, 'medicine')).toBe(0);
    const rate = xpOf(sim, medic, 'medicine') / healed;
    for (let i = 0; i < seconds(5); i++) sim.step();
    expect(xpOf(sim, medic, 'medicine') / (sim.world.get(patient, HealthC)!.hp - hp0)).toBeCloseTo(rate, 3);
  });

  it('bed healing with no medic aboard still trains the lowest-id crew member', () => {
    const sim = make();
    const a = person(sim, speciesOf.human, 3, 3);
    const b = person(sim, speciesOf.human, 4, 3);
    const patient = person(sim, speciesOf.human, 5, 3);
    sim.world.get(patient, HealthC)!.hp = 10;
    sim.world.add(patient, DownedC, { bleed: 60, stabilized: true, bed: 0 });
    for (let i = 0; i < seconds(5); i++) sim.step();
    expect(xpOf(sim, a, 'medicine')).toBeGreaterThan(0);
    expect(xpOf(sim, b, 'medicine')).toBe(0);
  });

  describe('helm', () => {
    function seated(): { sim: Sim; pilot: number } {
      const sim = make();
      sim.world.add(1, CombatC, {
        hold: false, volley: false, target: null, doctrine: 'random', ftl: 0, shield: { layers: 0, max: 0, timer: 0 }, heat: newHeat(),
        evasion: 0, pilot: 0, cruisePilot: 0, cruiseEvasion: 0, aiTimer: 0,
      });
      sim.world.get(1, ShipC)!.state = 'active';
      for (const d of ['helm', 'engine']) sim.world.get(moduleId(sim, d), ModuleC)!.powered = true;
      const pilot = person(sim, speciesOf.human, 3, 3);
      const j = sim.world.createEntity();
      sim.world.add(j, JobC, { ...job('operate', moduleId(sim, 'helm')), x: 3, y: 3, reservedBy: pilot } as Job);
      return { sim, pilot };
    }
    it('a seated pilot earns piloting XP while the drive charges, and nothing once it is full in peacetime', () => {
      const { sim, pilot } = seated();
      for (let i = 0; i < seconds(5); i++) helmSystem(sim);
      const charging = xpOf(sim, pilot, 'piloting');
      expect(charging).toBeGreaterThan(0);
      sim.world.get(1, CombatC)!.ftl = FTL_CHARGE_SEC;
      for (let i = 0; i < seconds(5); i++) helmSystem(sim);
      expect(xpOf(sim, pilot, 'piloting')).toBe(charging);
      sim.sector.inCombat = true; // evading a hostile: it matters again
      for (let i = 0; i < seconds(5); i++) helmSystem(sim);
      expect(xpOf(sim, pilot, 'piloting')).toBeGreaterThan(charging);
    });
  });
});
