import { factionsHostile } from '../combat/factions';
import { abortTask, attachJob } from '../ai/task';


import { skillOf } from '../combat/operators';
import type { Command } from '../commands';
import { CrewC, DraftedC, JobC, NeedsC, PathC, PositionC, type Path } from '../crew/components';
import { isIncapacitated, origin } from '../crew/helpers';
import { findPath } from '../crew/pathfind';
import { createCrew } from '../crew/spawn';
import { AllegianceC, EquipC, FighterC } from '../fight/components';
import { TraitsC } from '../crew/traits';
import { SkillXpC } from '../story/components';
import { ModuleC } from '../modules/components';
import { footprintTiles } from '../modules/footprint';
import { isTileWalkable } from '../modules/walk';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { HACK_SEC } from '../tuning';
import { HackedC } from './components';
import { assemblyAt, bayFree, cradleOf, isBay } from './bay';
import { destroyJob } from '../items/stacks';
import { shipIdOf, shipGrid } from '../regions';
import { shipById } from '../combat/ships';

type RobotCommand = 'crew.hack' | 'debug.spawnCrew' | 'module.assembleRobot' | 'module.cancelAssembly' | 'debug.setCharge' | 'debug.setCrew';
type Handler<T extends RobotCommand> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const robotHandlers: { [T in RobotCommand]: Handler<T> } = {
  'crew.hack': (sim, cmd) => {
    const pos = sim.world.get(cmd.id, PositionC);
    if (!sim.world.has(cmd.id, CrewC) || !pos) return reject(sim, cmd.type, 'noCrew');
    if (isIncapacitated(sim, cmd.id)) return reject(sim, cmd.type, 'incapacitated');
    if (skillOf(sim, cmd.id, 'hacking') <= 0) return reject(sim, cmd.type, 'noSkill');
    const m = sim.world.get(cmd.module, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def?.aiCore || m.hp <= 0) return reject(sim, cmd.type, 'badTarget');
    if (sim.world.get(cmd.module, HackedC)?.hacker) return reject(sim, cmd.type, 'alreadyHacked');
    if (!factionsHostile(sim.world.get(cmd.id, AllegianceC)?.faction, shipById(sim, shipIdOf(sim, m))?.faction)) return reject(sim, cmd.type, 'notHostile');
    if (shipIdOf(sim, pos) !== shipIdOf(sim, m)) return reject(sim, cmd.type, 'notAboard');
    let plan: { x: number; y: number; steps: { x: number; y: number }[] } | null = null;
    for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
      const steps = findPath(sim, shipIdOf(sim, pos), origin(pos), { x: t.x, y: t.y, adjacent: true });
      if (steps && (!plan || steps.length < plan.steps.length)) plan = { x: t.x, y: t.y, steps };
    }
    if (!plan) return reject(sim, cmd.type, 'unreachable');
    // A hack is a drafted order: the hacker stands by (no move target) and works until done or pulled away.
    abortTask(sim, cmd.id, 'order');
    const drafted = sim.world.get(cmd.id, DraftedC);
    if (drafted) {
      drafted.target = null;
      delete drafted.planned;
    } else sim.world.add(cmd.id, DraftedC, { target: null });
    const f = sim.world.get(cmd.id, FighterC);
    if (f) f.ordered = 0;
    (sim.world.get(cmd.id, CrewC) as { activity: string }).activity = 'drafted';
    const job = sim.world.createEntity();
    sim.world.add(job, JobC, {
      category: 'operating', kind: 'hack', x: plan.x, y: plan.y, struct: 0,
      work: Math.round(HACK_SEC * TICK_HZ), progress: 0, reservedBy: cmd.id, target: cmd.module,
    });
    attachJob(sim, cmd.id, job);
    (sim.world.get(cmd.id, PathC) as Path).steps = plan.steps;
  },
  'module.assembleRobot': (sim, cmd) => {
    const m = sim.world.get(cmd.moduleId, ModuleC);
    if (!m || !isBay(sim, cmd.moduleId)) return reject(sim, cmd.type, 'notBay');
    const plan = sim.content.roles[cmd.role]?.assemble;
    if (!plan) return reject(sim, cmd.type, 'badRole');
    if (!bayFree(sim, cmd.moduleId)) return reject(sim, cmd.type, 'bayTaken');
    const job = sim.world.createEntity();
    sim.world.add(job, JobC, {
      category: 'crafting', kind: 'assemble', ...cradleOf(sim, cmd.moduleId), struct: 0, work: plan.work, progress: 0,
      reservedBy: 0, target: cmd.moduleId, assemble: { role: cmd.role },
      ...(plan.cost.length > 0 ? { needs: plan.cost.map((q) => ({ ...q })), delivered: [] } : {}),
    });
  },
  'module.cancelAssembly': (sim, cmd) => {
    const job = assemblyAt(sim, cmd.moduleId);
    if (!job) return reject(sim, cmd.type, 'noAssembly');
    destroyJob(sim, job); // delivered materials fall to the floor
  },
  'debug.setCharge': (sim, cmd) => {
    for (const id of sim.world.query(NeedsC)) {
      const n = sim.world.get(id, NeedsC);
      if (n && n.charge !== undefined) n.charge = Math.max(0, Math.min(100, cmd.value));
    }
  },
  'debug.setCrew': (sim, cmd) => {
    if (!sim.world.has(cmd.id, CrewC)) return reject(sim, cmd.type, 'noCrew');
    if (cmd.traits) sim.world.add(cmd.id, TraitsC, { ids: cmd.traits.filter((t) => sim.content.traits?.[t]) });
    if (cmd.xp) sim.world.add(cmd.id, SkillXpC, { xp: { ...cmd.xp } });
    if (cmd.weapon !== undefined) {
      if (cmd.weapon !== null && !sim.content.items[cmd.weapon]?.hand) return reject(sim, cmd.type, 'notWeapon');
      sim.world.add(cmd.id, EquipC, { weapon: cmd.weapon });
    }
    const n = sim.world.get(cmd.id, NeedsC);
    if (n && cmd.hunger !== undefined && sim.content.species[sim.world.get(cmd.id, CrewC)?.species ?? '']?.hunger) n.hunger = Math.max(0, Math.min(100, cmd.hunger));
    if (n && cmd.rest !== undefined) n.rest = Math.max(0, Math.min(100, cmd.rest));
  },
  'debug.spawnCrew': (sim, cmd) => {
    const grid = shipGrid(sim, cmd.ship);
    if (!grid?.has('struct') || !grid.inBounds(cmd.x, cmd.y) || !isTileWalkable(sim, grid, cmd.x, cmd.y)) return reject(sim, cmd.type, 'notWalkable');
    const faction = cmd.faction ?? shipById(sim, cmd.ship)?.faction ?? 'player';
    if (!createCrew(sim, cmd.ship, cmd.role, { x: cmd.x, y: cmd.y }, { faction, rest: 100 })) return reject(sim, cmd.type, 'badRole');
  },
};
