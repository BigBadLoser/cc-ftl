import type { Command } from '../commands';
import type { Sim } from '../sim';
import { CrewC } from './components';
import { OperationsC } from './implantTypes';
import { isUrgent, operationError, operationsOf } from './surgery';

type SurgeryCommand = 'crew.queueOperation' | 'crew.cancelOperation';

const reject = (sim: Sim, command: string, reason: string): void => void sim.events.emit({ type: 'command.rejected', command, reason });

/** The surgery queue commands (#311). The work is the surgery job (systems/surgery.ts, crew/surgeryOutcome.ts). */
export const surgeryHandlers: { [T in SurgeryCommand]: (sim: Sim, cmd: Extract<Command, { type: T }>) => void } = {
  'crew.queueOperation': (sim, cmd) => {
    if (!sim.world.has(cmd.id, CrewC)) return reject(sim, cmd.type, 'noCrew');
    const op = { kind: cmd.kind, part: cmd.part, ...(cmd.item ? { item: cmd.item } : {}) };
    const err = operationError(sim, cmd.id, op);
    if (err) return reject(sim, cmd.type, err);
    if (operationsOf(sim, cmd.id).some((o) => o.part === op.part && o.kind === op.kind)) return reject(sim, cmd.type, 'queued');
    queueOperation(sim, cmd.id, op);
  },
  'crew.cancelOperation': (sim, cmd) => {
    const ops = sim.world.get(cmd.id, OperationsC);
    const at = ops?.list.findIndex((o) => o.id === cmd.op) ?? -1;
    if (!ops || at < 0) return reject(sim, cmd.type, 'noOperation');
    ops.list.splice(at, 1);
    if (!ops.list.length) sim.world.remove(cmd.id, OperationsC);
  },
};

/** Put an operation on the patient's queue: last, or (one that saves a life, `isUrgent`) ahead of every operation that does not. Returns its id. */
export function queueOperation(sim: Sim, id: number, op: { kind: Parameters<typeof operationError>[2]['kind']; part: string; item?: string }): number {
  let ops = sim.world.get(id, OperationsC);
  if (!ops) {
    ops = { list: [], next: 1 };
    sim.world.add(id, OperationsC, ops);
  }
  const urgent = isUrgent(sim, id, op);
  const entry = { id: ops.next++, ...op, ...(urgent ? { urgent: true as const } : {}) };
  const at = urgent ? ops.list.findIndex((o) => !o.urgent) : -1;
  if (at < 0) ops.list.push(entry);
  else ops.list.splice(at, 0, entry);
  return entry.id;
}
