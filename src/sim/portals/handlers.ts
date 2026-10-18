import type { Command } from '../commands';
import { CrewC, DeadC } from '../crew/components';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { requestAirlock } from './airlock';
import { AirlockC, PORTAL_KINDS, PortalC, SuitC, type Portal, type PortalEnd } from './components';
import { PORTAL_DEFAULTS, createPortal, portalError, removePortal } from './graph';

type PortalCommandType = Extract<Command['type'], `portal.${string}` | `airlock.${string}` | `suit.${string}`>;
type Handler<T extends PortalCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/**
 * Portal links are made and broken by commands only. Nothing in the sim creates them by itself yet; the systems that
 * decide when a link exists (docking, an EVA tether, a teleporter pad) will issue these.
 */
export const portalHandlers: { [T in PortalCommandType]: Handler<T> } = {
  'portal.link': (sim, cmd) => {
    if (!PORTAL_KINDS.includes(cmd.kind)) return reject(sim, cmd.type, 'badKind');
    const a: PortalEnd = { gridId: cmd.a.gridId, x: cmd.a.x, y: cmd.a.y };
    const b: PortalEnd = { gridId: cmd.b.gridId, x: cmd.b.x, y: cmd.b.y };
    const err = portalError(sim, cmd.kind, a, b);
    if (err) return reject(sim, cmd.type, err);
    const requires = cmd.requires ?? [];
    for (const r of requires) {
      if (r.type !== 'suit' && !(r.type === 'powered' && sim.world.has(r.module, ModuleC))) return reject(sim, cmd.type, 'badRequirement');
    }
    const d = PORTAL_DEFAULTS[cmd.kind];
    const cost = cmd.cost ?? d.cost;
    const ticks = cmd.ticks ?? d.ticks;
    if (!Number.isInteger(ticks) || ticks < 0 || !Number.isFinite(cost) || cost < 0) return reject(sim, cmd.type, 'badValue');
    const portal: Portal = { kind: cmd.kind, a, b, cost, ticks, requires: requires.map((r) => ({ ...r })), ...(cmd.oneWay ? { oneWay: true } : {}) };
    const id = createPortal(sim, portal);
    sim.events.emit({ type: 'portal.linked', portal: id, kind: cmd.kind, a, b });
  },
  'portal.unlink': (sim, cmd) => {
    if (!sim.world.has(cmd.id, PortalC)) return reject(sim, cmd.type, 'noPortal');
    removePortal(sim, cmd.id);
    sim.events.emit({ type: 'portal.unlinked', portal: cmd.id });
  },
  'airlock.cycle': (sim, cmd) => {
    if (!sim.world.has(cmd.moduleId, AirlockC)) return reject(sim, cmd.type, 'noAirlock');
    if (cmd.to !== 'inner' && cmd.to !== 'outer') return reject(sim, cmd.type, 'badValue');
    requestAirlock(sim, cmd.moduleId, cmd.to);
  },
  'suit.set': (sim, cmd) => {
    if (!sim.world.has(cmd.crew, CrewC) || sim.world.has(cmd.crew, DeadC)) return reject(sim, cmd.type, 'noCrew');
    if (cmd.worn) sim.world.add(cmd.crew, SuitC, { worn: true });
    else sim.world.remove(cmd.crew, SuitC);
  },
};
