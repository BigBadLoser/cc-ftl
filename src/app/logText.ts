import { homeShip } from '../sim/index';
import { shipIdOf } from '../sim/regions';
import { AllegianceC, CrewC, ModuleC, PositionC, ShipC, TraderC, type Sim, type SimEvent } from '../sim';
import type { UiLogEntry, UiSubject } from '../ui/api';
import { describeBoarding } from './boardingText';
import { crewSubject, crewTile, enemyShip, roomOf, shipSubject, tileAt } from './subjects';

export type LogEntry = Pick<UiLogEntry, 'kind' | 'tone' | 'text' | 'fold'> & { subject?: UiSubject };

const BLOCKED = { noShuttle: 'no free shuttle', noPilot: 'no free pilot', noAirlock: 'no working airlock', noStock: 'nothing left to take', failed: 'trips keep failing' } as const;

/** The ship's log wording for sim events: every notable event, with the subject a click jumps to. Read-only. */
export function createDescriber(sim: Sim) {
  const home = () => homeShip(sim);
  const crewName = (id: number) => sim.world.get(id, CrewC)?.name ?? 'Crew';
  const player = (crew: number) => sim.world.get(crew, AllegianceC)?.faction === 'player';
  const ours = (crew: number) => player(crew) || shipIdOf(sim, sim.world.get(crew, PositionC)) === home();
  const ship = (id: number) => sim.world.get(id, ShipC);
  const mine = (id: number) => ship(id)?.faction === 'player';
  const shipName = (id: number) => ship(id)?.name ?? 'Ship';
  const hireOf = (deal: number) => sim.trade.deals.find((d) => d.id === deal)?.crew?.[0];
  const trader = (id: number) => sim.world.get(id, TraderC)?.name ?? 'trader';
  const handoverOf = (deal: number) => sim.trade.deals.find((d) => d.id === deal)?.handover;
  const factionName = (id: string) => sim.content.galaxy?.factions[id]?.name ?? id;
  const item = (id: string) => sim.content.items[id]?.name ?? id;
  const sub = (s: UiSubject | null): { subject?: UiSubject } => (s ? { subject: s } : {});
  const onShip = (id: number) => sub(shipSubject(sim, id));
  const node = (id: string) => sub({ kind: 'node', id });
  const here = () => node(sim.galaxy.current);
  const who = (faction: string, role: string) => `${sim.content.galaxy?.factions[faction]?.name ?? faction} ${role}`;

  return function describe(e: SimEvent): LogEntry | null {
    switch (e.type) {
      case 'fire.started': return e.ship === home() ? { kind: 'fire', tone: 'bad', text: 'Fire broke out', subject: tileAt(e.x, e.y) } : null;
      case 'hull.breach': return e.ship === home() ? { kind: 'breach', tone: 'bad', text: 'Hull breached', ...sub(roomOf(sim, e.ship, e.room)) } : null;
      case 'power.shortage': return e.ship === home() ? { kind: 'warning', tone: 'warn', text: `Power shortage (${Math.round(e.supply)}/${Math.round(e.demand)})` } : null;
      case 'o2.low': return e.ship === home() ? { kind: 'warning', tone: 'warn', text: 'Low oxygen', ...sub(roomOf(sim, e.ship, e.room)) } : null;
      case 'crew.downed': return ours(e.crew) ? { kind: e.type, tone: 'bad', text: `${crewName(e.crew)} went down`, ...sub(crewSubject(sim, e.crew)) } : null;
      case 'crew.died':
        // A death is a loss on our side and a kill on theirs.
        return ours(e.crew)
          ? { kind: e.type, tone: 'bad', text: `${crewName(e.crew)} died`, ...sub(crewTile(sim, e.crew)) }
          : { kind: 'kill', tone: 'good', text: `${crewName(e.crew)} killed`, ...sub(crewTile(sim, e.crew)) };
      case 'crew.rescued': return ours(e.crew) ? { kind: e.type, tone: 'good', text: `${crewName(e.crew)} was rescued`, ...sub(crewSubject(sim, e.crew)) } : null;
      case 'crew.starving': return player(e.crew) ? { kind: 'warning', tone: 'warn', text: `${crewName(e.crew)} is starving`, ...sub(crewSubject(sim, e.crew)) } : null;
      case 'crew.moodLow': return player(e.crew) ? { kind: 'warning', tone: 'warn', text: `${crewName(e.crew)} is very unhappy`, ...sub(crewSubject(sim, e.crew)) } : null;
      case 'suit.airLow': return player(e.crew) ? { kind: 'warning', tone: 'warn', text: `${crewName(e.crew)}: suit air low`, ...sub(crewSubject(sim, e.crew)) } : null;
      case 'suit.airOut': return player(e.crew) ? { kind: 'warning', tone: 'bad', text: `${crewName(e.crew)}: suit out of air`, ...sub(crewSubject(sim, e.crew)) } : null;
      case 'module.destroyed': {
        const name = sim.content.modules[e.def]?.name ?? 'Module';
        const m = sim.world.get(e.moduleId, ModuleC);
        const at = m ? sub(tileAt(m.x, m.y)) : onShip(e.ship); // an own module jumps to its tile; folded lines keep the first one
        return mine(e.ship)
          ? { kind: e.type, tone: 'bad', text: `${name} destroyed`, ...at, fold: { ship: e.ship, enemy: false, names: [name] } }
          : { kind: e.type, tone: 'good', text: `Enemy ${name} destroyed`, ...onShip(e.ship), fold: { ship: e.ship, enemy: true, names: [name] } };
      }
      case 'combat.started': return { kind: 'combat', tone: 'warn', text: 'Combat started', ...sub(enemyShip(sim, home())) };
      case 'combat.ended': return { kind: 'combat', tone: 'info', text: 'Combat over' };
      case 'ship.disabled': return { kind: e.type, tone: mine(e.ship) ? 'bad' : 'good', text: `${shipName(e.ship)} disabled`, ...onShip(e.ship) };
      case 'ship.destroyed': return mine(e.ship) ? { kind: 'lost', tone: 'bad', text: 'Your ship was destroyed' } : { kind: e.type, tone: 'good', text: `${shipName(e.ship)} destroyed` };
      case 'ship.fled': return { kind: e.type, tone: 'info', text: `${shipName(e.ship)} jumped away` };
      case 'station.alarm': return { kind: 'combat', tone: 'bad', text: `Alarm on ${shipName(e.ship)}: ${e.reason}`, ...onShip(e.ship) };
      case 'station.calm': return { kind: 'combat', tone: 'info', text: `${shipName(e.ship)} stands down its alarm`, ...onShip(e.ship) };
      case 'ship.provoked': return { kind: 'combat', tone: 'bad', text: `${shipName(e.ship)} is roused: its guns turn on you`, ...onShip(e.ship) };
      case 'ship.captured': return { kind: e.type, tone: e.by === 'player' ? 'good' : 'bad', text: e.by === 'player' ? `${shipName(e.ship)} captured` : `${shipName(e.ship)} was captured`, ...onShip(e.ship) };
      case 'eggsac.hatched': return { kind: 'creatures', tone: 'bad', text: `Hostile creatures aboard ${shipName(e.ship)}`, subject: tileAt(e.x, e.y) };
      case 'container.detached': return { kind: 'container', tone: 'info', text: 'A cargo container broke loose', subject: tileAt(e.x, e.y) };
      case 'production.done': return { kind: 'production', tone: 'good', text: `${sim.content.recipes[e.recipe]?.name ?? 'Batch'} finished`, subject: tileAt(e.x, e.y) };
      case 'job.missingMaterials': return { kind: 'job', tone: 'warn', text: `Missing ${item(e.item)}`, subject: tileAt(e.x, e.y) };
      case 'storage.full': return { kind: 'job', tone: 'warn', text: `Storage full (${item(e.item)})`, subject: tileAt(e.x, e.y) };
      case 'mining.waiting': return { kind: 'mining', tone: 'warn', text: 'Mining pod waits for a free pilot' };
      case 'mining.done': return { kind: 'mining', tone: 'info', text: e.reason === 'exhausted' ? `Mining done: ore used up (${e.trips} trips)` : e.reason === 'recalled' ? 'Mining pod recalled' : 'Mining pod lost its bay' };
      case 'transfer.queued': return e.auto ? { kind: 'transfer', tone: 'info', text: `Salvage from ${shipName(e.from)} queued for transfer`, ...onShip(e.from) } : null;
      case 'transfer.delivered': return e.final ? { kind: 'transfer', tone: 'good', text: `Transfer delivered to ${shipName(e.to)}`, ...onShip(e.to) } : null;
      case 'transfer.blocked': return { kind: 'transfer', tone: 'warn', text: `Transfer blocked: ${BLOCKED[e.reason]}` };
      case 'outpost.discovered': return { kind: 'outpost', tone: 'warn', text: 'Hidden base discovered', ...onShip(e.ship) };
      case 'trade.hailAnswered': return { kind: 'hail', tone: 'info', text: `${e.name} answered the hail`, ...onShip(e.ship) };
      case 'trade.hailRefused': return { kind: 'hail', tone: 'warn', text: `${e.name} refused to talk`, ...onShip(e.ship) };
      case 'trade.dealMade': {
        const hire = hireOf(e.deal);
        return { kind: 'trade', tone: 'good', text: hire ? `${crewName(hire)} hired: your shuttle is on its way to pick them up` : `Deal made with ${trader(e.ship)}` };
      }
      case 'crew.hired': return { kind: 'trade', tone: 'good', text: `${crewName(e.crew)} joins the crew`, ...sub(crewSubject(sim, e.crew)) };
      case 'trade.delivered': return { kind: 'trade', tone: 'good', text: e.to === 'player' ? `Cargo from ${trader(e.ship)} arrived` : `Cargo delivered to ${trader(e.ship)}` };
      // A payment to the player is the credit-gain entry (see eventLog.ts); one the player made is logged here.
      case 'trade.settled': return e.credits > 0 ? { kind: 'trade', tone: 'info', text: `Paid ${e.credits} ₵ to ${trader(e.ship)}` } : e.credits === 0 ? { kind: 'trade', tone: 'good', text: `Trade with ${trader(e.ship)} completed` } : null;
      case 'trade.failed': {
        const hire = hireOf(e.deal);
        if (handoverOf(e.deal)) return { kind: 'trade', tone: 'warn', text: `${trader(e.ship)} called its shuttle back (${e.reason === 'combat' ? 'combat' : 'it could not collect the crate'})` };
        return { kind: 'trade', tone: 'warn', text: hire ? `The hire of ${crewName(hire)} fell through: fee refunded` : `Deal with ${trader(e.ship)} called off` };
      }
      case 'job.completed': return { kind: 'trade', tone: 'good', text: e.kind === 'bounty' ? `Bounty done: hand it in at a ${factionName(e.issuer)} military station (${e.reward} ₵)` : `Survey done: hand it in at a ${factionName(e.issuer)} research station (${e.reward} ₵)` };
      case 'job.shuttleSent': return { kind: 'trade', tone: 'info', text: e.via === 'own' ? `Your shuttle takes the crate over to ${trader(e.station)}` : `${trader(e.station)} sends a shuttle for the crate`, ...onShip(e.station) };
      // job.handedIn and job.handedOver pay out: the credit-gain entry (eventLog.ts) carries them, named after the job.
      case 'story.started': {
        const def = sim.content.events?.[e.event];
        return def ? { kind: 'story', tone: 'info', text: def.title } : null;
      }
      case 'story.effect': return e.text ? { kind: 'story', tone: 'info', text: e.text } : null;
      case 'galaxy.jumped': return { kind: 'galaxy', tone: 'info', text: 'Jumped to a new node', ...node(e.to) };
      case 'galaxy.encounter': {
        const w = who(e.faction, e.role);
        const text = e.kind === 'interdict' ? `Interdicted by a ${w}: dropped out of hyperspace` : e.kind === 'hail' ? `A ${w} hails you in passing`
          : e.kind === 'scan' ? `A ${w} scans you` : `Distress call from a ${w}`;
        return { kind: 'galaxy', tone: e.kind === 'interdict' ? 'bad' : 'warn', text, ...node(e.node) };
      }
      case 'galaxy.evadeRoll': return { kind: 'galaxy', tone: e.success ? 'good' : 'bad', text: `${e.success ? 'Evaded' : 'Evade failed'}: rolled ${Math.round(e.roll * 100)}% against ${Math.round(e.odds * 100)}%`, ...here() };
      case 'scan.settled': return { kind: 'galaxy', tone: 'warn', text: e.outcome === 'bribed' ? `Paid a ${e.cost} ₵ bribe: the scan found nothing` : `Contraband confiscated and a ${e.cost} ₵ fine paid`, ...here() };
      case 'galaxy.bribed': return { kind: 'galaxy', tone: 'warn', text: `Paid ${e.cost} ₵ to pass`, ...here() };
      case 'truce.breached': return { kind: 'galaxy', tone: 'bad', text: 'Truce broken: everyone here is hostile to you for 30 turns', ...node(e.node) };
      case 'galaxy.eventEntered': return { kind: 'galaxy', tone: 'warn', text: e.kind === 'fight' ? 'Dropped into deep space: fight' : 'Dropped into deep space to help', ...here() };
      case 'game.lost': return { kind: 'lost', tone: 'bad', text: 'Game over' };
      default: return describeBoarding(sim, e);
    }
  };
}
