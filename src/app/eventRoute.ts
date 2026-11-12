import type { SimEvent } from '../sim';
import type { UiAlertKind } from '../ui/api';

/**
 * Where each sim event goes: the one table the ship's log (eventLog.ts) and the alert gate (alerts.ts) both read.
 * `log`: a line in the ship's log only. `both`: a log line, and an urgent alert when the event's own conditions hold (the alert code
 * narrows it: own ship only, player crew only...). An event missing here reaches neither (state-only or presentation events).
 * Alerts for ongoing problems also come from state (`deriveAlerts`); that is not routed here. The wording of log lines lives in
 * logText.ts and boardingText.ts; routing.test.ts fails when a described event has no entry here.
 */
export type Route = 'log' | 'both';
export const EVENT_ROUTE: Partial<Record<SimEvent['type'], Route>> = {
  'combat.started': 'both', 'fire.started': 'both', 'hull.breach': 'both', 'o2.low': 'both', 'power.shortage': 'both', 'crew.downed': 'both',
  'suit.airLow': 'both', 'suit.airOut': 'both', 'crew.airUnreachable': 'both', 'away.stranded': 'both', 'crew.starving': 'both',
  'eggsac.hatched': 'both', 'crew.break': 'both', 'crew.recallStarted': 'both', 'crew.recallFailed': 'both', 'story.started': 'both',
  'ship.disabled': 'both', 'vehicle.destroyed': 'both', 'core.torn': 'both', 'core.hacked': 'both',
  'away.homeEmpty': 'log', 'away.leftBehind': 'log', 'away.returned': 'log', 'combat.ended': 'log', 'container.detached': 'log',
  'crew.asksToJoin': 'log', 'crew.befriended': 'log', 'crew.died': 'log', 'crew.grieving': 'log', 'crew.hired': 'log', 'crew.interaction': 'log',
  'crew.joined': 'log', 'crew.leftWithShip': 'log', 'crew.moodLow': 'log', 'crew.rescued': 'log', 'crew.rivalry': 'log', 'crew.sabotageEnded': 'log',
  'crew.sabotagePaused': 'log', 'crew.sabotageResumed': 'log', 'crew.sabotageStarted': 'log', 'drone.lost': 'log', 'drone.recall': 'log',
  'drone.wrecked': 'log', 'galaxy.bribed': 'log', 'galaxy.encounter': 'log', 'galaxy.evadeRoll': 'log', 'galaxy.eventEntered': 'log',
  'galaxy.jumped': 'log', 'game.lost': 'log', 'inspect.bribeRefused': 'log', 'inspect.fought': 'log', 'inspect.settled': 'log',
  'inspect.started': 'log', 'inspect.waiting': 'log', 'job.alighted': 'log', 'job.completed': 'log', 'job.missingMaterials': 'log',
  'job.posted': 'log', 'job.shuttleSent': 'log', 'mining.done': 'log', 'mining.waiting': 'log', 'module.destroyed': 'log',
  'outpost.discovered': 'log', 'patrol.complied': 'log', 'patrol.ran': 'log', 'production.done': 'log', 'scene.aid': 'log', 'scene.observed': 'log',
  'ship.arrived': 'log', 'ship.captured': 'log', 'ship.destroyed': 'log', 'ship.fled': 'log', 'ship.provoked': 'log', 'ship.surrendered': 'log',
  'station.alarm': 'log', 'station.calm': 'log', 'storage.full': 'log', 'story.effect': 'log', 'trade.dealMade': 'log', 'trade.delivered': 'log',
  'trade.failed': 'log', 'trade.hailAnswered': 'log', 'trade.hailRefused': 'log', 'trade.settled': 'log', 'transfer.blocked': 'log',
  'transfer.delivered': 'log', 'transfer.queued': 'log', 'truce.breached': 'log', 'research.done': 'log', 'goal.done': 'log', 'goal.actDone': 'log',
  'combat.vented': 'log', 'combat.overheated': 'log', 'combat.overcharged': 'log', 'ftl.overcharged': 'log', 'crew.knockedDown': 'log',
  'crew.imprisoned': 'log', 'crew.surrendered': 'log', 'robot.wrecked': 'log', 'galaxy.hunt': 'log', 'galaxy.distressSent': 'log',
  'galaxy.towArrived': 'log', 'galaxy.stalled': 'log', 'galaxy.notoriety': 'log', 'eggsac.disturbed': 'log',
};

/** Whether an event gets a line in the ship's log. */
export const logged = (type: SimEvent['type']): boolean => EVENT_ROUTE[type] !== undefined;
/** Whether an event may raise an urgent alert. */
export const raisesAlert = (type: SimEvent['type']): boolean => EVENT_ROUTE[type] === 'both';

/**
 * How much an alert matters when the list is full (MAX shown): the lowest tier goes first, the oldest within a tier. Emergencies (tier 2)
 * always keep a slot ahead of the rest; asks, arrival warnings and the fight report (tier 0) are the first to give way.
 */
export const ALERT_PRIORITY: Record<UiAlertKind, 0 | 1 | 2> = {
  'fire.started': 2, 'hull.breach': 2, 'o2.low': 2, 'power.shortage': 2, 'crew.downed': 2, 'suit.airLow': 2, 'suit.airOut': 2, 'crew.airUnreachable': 2,
  'away.stranded': 2, 'boarders.stranded': 2, 'combat.started': 2, 'creatures.aboard': 2, 'ship.disabled': 2, 'fuel.out': 2, 'core.lost': 2, 'vehicle.lost': 2,
  'crew.starving': 1, 'crew.break': 1, 'fuel.low': 1, 'save.failed': 1, 'inspect.waiting': 1, 'inspect.blocked': 1, 'story.lead': 1,
  'galaxy.incomingHostile': 0, 'crew.asksToJoin': 0, 'fight.report': 0,
};
