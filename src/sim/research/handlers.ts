import type { Command } from '../commands';
import type { Sim } from '../sim';
import { ResearchC } from './components';
import { projectOf, queueBlocker, queueValid, refund } from './research';

type ResearchCommandType = Extract<Command['type'], `research.${string}`>;
type Handler<T extends ResearchCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

const reject = (sim: Sim, command: string, reason: string): void => void sim.events.emit({ type: 'command.rejected', command, reason });

export const researchHandlers: { [T in ResearchCommandType]: Handler<T> } = {
  'research.queue': (sim, cmd) => {
    const why = queueBlocker(sim, cmd.ship, cmd.project);
    if (why) return reject(sim, cmd.type, why);
    const r = sim.world.get(cmd.ship, ResearchC);
    if (r) r.queue.push(cmd.project);
    else sim.world.add(cmd.ship, ResearchC, { queue: [cmd.project], progress: 0, paid: false });
  },
  'research.cancel': (sim, cmd) => {
    const r = sim.world.get(cmd.ship, ResearchC);
    const i = r ? r.queue.indexOf(cmd.project) : -1;
    if (!r || i < 0) return reject(sim, cmd.type, 'notQueued');
    if (i === 0 && r.paid) {
      const def = projectOf(sim, cmd.project);
      if (def) refund(sim, cmd.ship, def);
      r.paid = false;
      r.progress = 0;
    }
    r.queue.splice(i, 1);
    // Projects queued on top of this one lose their prerequisite: they go too.
    while (!queueValid(sim, r.queue)) r.queue.splice(r.queue.findIndex((_, k) => !queueValid(sim, r.queue.slice(0, k + 1))), 1);
  },
  'research.move': (sim, cmd) => {
    const r = sim.world.get(cmd.ship, ResearchC);
    const i = r ? r.queue.indexOf(cmd.project) : -1;
    if (!r || i < 0) return reject(sim, cmd.type, 'notQueued');
    if (!Number.isInteger(cmd.to)) return reject(sim, cmd.type, 'badValue');
    const to = Math.max(0, Math.min(r.queue.length - 1, cmd.to));
    if (r.paid && (i === 0 || to === 0)) return reject(sim, cmd.type, 'active');
    const next = r.queue.filter((p) => p !== cmd.project);
    next.splice(to, 0, cmd.project);
    if (!queueValid(sim, next)) return reject(sim, cmd.type, 'order');
    r.queue = next;
  },
};
