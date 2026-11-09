import type { Command } from '../commands';
import { DAY_HOURS } from '../clock';
import type { Sim } from '../sim';
import { CrewC } from './components';
import { SCHEDULE_BLOCKS, ScheduleC, hoursOf } from './schedule';

type ScheduleCommand = 'crew.schedule.set' | 'crew.schedule.preset' | 'crew.schedule.copy';
type Handler<T extends ScheduleCommand> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

const reject = (sim: Sim, command: string, reason: string): void => void sim.events.emit({ type: 'command.rejected', command, reason });
const isHour = (h: unknown): h is number => Number.isInteger(h) && (h as number) >= 0 && (h as number) < DAY_HOURS;

/**
 * Schedule commands (#412): edit a crew member's own row (`ScheduleC`). The first edit of someone following the Default starts from the row they
 * follow now (`hoursOf`), so changing one hour keeps the rest of their day.
 */
export const scheduleHandlers: { [T in ScheduleCommand]: Handler<T> } = {
  'crew.schedule.set': (sim, cmd) => {
    if (!sim.world.has(cmd.id, CrewC)) return reject(sim, cmd.type, 'noCrew');
    const to = cmd.to ?? cmd.from;
    if (!isHour(cmd.from) || !isHour(to)) return reject(sim, cmd.type, 'badHour');
    if (!SCHEDULE_BLOCKS.includes(cmd.block)) return reject(sim, cmd.type, 'badBlock');
    const hours = [...(hoursOf(sim, cmd.id) ?? Array.from({ length: DAY_HOURS }, () => 'any' as const))];
    for (let h = cmd.from; ; h = (h + 1) % DAY_HOURS) {
      hours[h] = cmd.block;
      if (h === to) break;
    }
    sim.world.add(cmd.id, ScheduleC, { hours });
  },
  'crew.schedule.preset': (sim, cmd) => {
    if (!sim.world.has(cmd.id, CrewC)) return reject(sim, cmd.type, 'noCrew');
    const preset = sim.content.schedules?.[cmd.preset];
    if (!preset) return reject(sim, cmd.type, 'badPreset');
    sim.world.add(cmd.id, ScheduleC, { hours: [...preset.hours] });
  },
  'crew.schedule.copy': (sim, cmd) => {
    if (!sim.world.has(cmd.id, CrewC) || !sim.world.has(cmd.from, CrewC)) return reject(sim, cmd.type, 'noCrew');
    const hours = hoursOf(sim, cmd.from);
    if (!hours) return reject(sim, cmd.type, 'noSchedule');
    sim.world.add(cmd.id, ScheduleC, { hours: [...hours] });
  },
};
