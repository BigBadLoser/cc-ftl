import { callPod } from '../vehicles/escape';
import { CombatC } from '../combat/components';
import type { Command } from '../commands';
import type { Sim } from '../sim';
import { FTL_CHARGE_SEC } from '../tuning';
import { playerShipInfo } from './arrivals';
import { chunkOfId } from './generator';
import { ensureChunk, ensureChunkOf, galaxyIndex } from './state';
import { drop, isAdrift, jump, leaveAdrift, teleport } from './hyperspace';
import { discover } from './travel';
import { leave, respond } from './respond';
import { addNotoriety, clearNotoriety } from './heat';
import { hireCrew } from './recruit';
import { buyBlueprint } from './blueprintShop';
import { callForHelp } from './stranded';
import { jobScenario } from './jobsDebug';
import { answerVisit, setAmbush } from '../scene/visit';
import { offerAid } from '../scene/aid';
import { setArrivals } from '../scene/debug';
import { abandonJob, acceptJob, handIn, openCrate } from './jobs';
import { refusePassage } from './passage';
import { answerJoin } from './joinOffer';
import { debugPatrol } from '../inspect/patrolDebug';
import { debugPirates } from './pirateDebug';

type GalaxyCommandType = Extract<Command['type'], `galaxy.${string}` | `jobs.${string}` | 'crew.hire' | 'blueprint.buy' | 'debug.ambush' | 'debug.sceneArrivals' | 'debug.galaxyReveal' | 'debug.galaxyTeleport' | 'debug.chargeFtl' | 'debug.notoriety' | 'debug.jobScenario' | 'debug.patrol' | 'debug.pirates'>;
type Handler<T extends GalaxyCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

export const galaxyHandlers: { [T in GalaxyCommandType]: Handler<T> } = {
  'galaxy.jump': (sim, cmd) => void (isAdrift(sim) ? leaveAdrift(sim, cmd.ship, cmd.route) : jump(sim, cmd.ship, cmd.route, cmd.withDocked, 'galaxy.jump', cmd.overcharge)),
  'galaxy.drop': (sim) => void drop(sim),
  'galaxy.respond': (sim, cmd) => void respond(sim, cmd.encounter, cmd.choice),
  'galaxy.leaveEvent': (sim) => void leave(sim),
  'galaxy.visit': (sim, cmd) => void answerVisit(sim, cmd.ship, cmd.grant),
  'galaxy.aid': (sim, cmd) => offerAid(sim, cmd.ship),
  'galaxy.recoverPod': (sim, cmd) => {
    const pod = sim.galaxy.event?.scene.pods?.find((p) => p.id === cmd.pod);
    const why = !pod || pod.vehicle === undefined ? 'noPod' : callPod(sim, pod.vehicle);
    if (why) return void sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: why });
    (pod as NonNullable<typeof pod>).called = true;
  },
  'debug.ambush': (sim, cmd) => void setAmbush(sim, cmd.trap, cmd.tell),
  'debug.sceneArrivals': (sim, cmd) => setArrivals(sim, cmd.mode),
  'galaxy.clearNotoriety': (sim) => void clearNotoriety(sim),
  'galaxy.distress': (sim) => void callForHelp(sim),
  'crew.hire': (sim, cmd) => hireCrew(sim, cmd.key),
  'blueprint.buy': (sim, cmd) => buyBlueprint(sim, cmd.port, cmd.def),
  'jobs.accept': (sim, cmd) => void acceptJob(sim, cmd.key),
  'jobs.abandon': (sim, cmd) => void abandonJob(sim, cmd.id),
  'jobs.refuse': (sim, cmd) => void refusePassage(sim, cmd.key),
  'jobs.join': (sim, cmd) => void answerJoin(sim, cmd.crew, cmd.accept),
  'jobs.handIn': (sim, cmd) => void handIn(sim, cmd.id),
  'jobs.openCrate': (sim, cmd) => void openCrate(sim, cmd.id),
  'debug.galaxyReveal': (sim, cmd) => {
    const r = Math.max(0, Math.min(12, Math.floor(cmd.radius)));
    const [cx, cy] = (chunkOfId(sim.galaxy.current) ?? '0,0').split(',').map(Number) as [number, number];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) ensureChunk(sim, cx + dx, cy + dy);
    for (const id of galaxyIndex(sim.galaxy).nodes.keys()) sim.galaxy.discovered[id] ??= sim.tick;
    sim.galaxy.rev++;
    discover(sim);
  },
  'debug.galaxyTeleport': (sim, cmd) => {
    ensureChunkOf(sim, cmd.node);
    if (!galaxyIndex(sim.galaxy).nodes.has(cmd.node)) return void sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'noNode' });
    if (sim.galaxy.event) return void sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'inEvent' });
    if (cmd.node !== sim.galaxy.current) teleport(sim, cmd.node);
  },
  'debug.notoriety': (sim, cmd) => addNotoriety(sim, (Number.isFinite(cmd.value) ? cmd.value : 0) - sim.galaxy.heat.notoriety),
  'debug.jobScenario': (sim, cmd) => void jobScenario(sim, cmd.name),
  'debug.patrol': (sim, cmd) => {
    if (!debugPatrol(sim, cmd.node, cmd.faction ?? 'navy')) sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'noPatrol' });
  },
  'debug.pirates': (sim, cmd) => {
    if (!debugPirates(sim, cmd.node, cmd.faction ?? 'pirates', !!cmd.hunt)) sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'noFleet' });
  },
  'debug.chargeFtl': (sim) => {
    const me = playerShipInfo(sim);
    const combat = me ? sim.world.get(me.id, CombatC) : undefined;
    if (combat) combat.ftl = FTL_CHARGE_SEC;
  },
};
