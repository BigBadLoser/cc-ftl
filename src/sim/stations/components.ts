import { defineComponent } from '../ecs';

type Tile = { x: number; y: number };

/**
 * On a station's ship entity: where its people go. `courts` are floor tiles of its open rooms (plazas, gardens, drill
 * halls) and messes, where idle crew wander; `posts` are the security patrol stops (armouries, docks, courts, the bridge).
 * Sector tiles.
 */
export interface Station {
  courts: Tile[];
  posts: Tile[];
  /** The next patrol stop the director posts a job at (stops rotate so guards spread out). */
  nextPost: number;
}
export const StationC = defineComponent<Station>('station');

/** On a station's crew: whose they are (station life, alarms). */
export interface StationCrew {
  station: number;
}
export const StationCrewC = defineComponent<StationCrew>('stationCrew');

/**
 * A station's alarm (on its ship entity). 'alarm' while intruders are aboard, it was provoked or something burns; it
 * decays to 'calm' after `quiet` ticks with none of that. `integrity` is the last seen value (a drop is an attack).
 */
export interface StationAlarm {
  state: 'calm' | 'alarm';
  reason: string;
  quiet: number;
  integrity: number;
}
export const StationAlarmC = defineComponent<StationAlarm>('stationAlarm');

/** On a crew member the station's people now treat as hostile (an intruder, or invited crew who attacked). */
export interface Wanted {
  station: number;
}
export const WantedC = defineComponent<Wanted>('wanted');

/**
 * A person aboard a station who can be hired (galaxy/recruit.ts keeps them in step with the port's candidates): `key` names the candidate,
 * `cost` is the hire price. Hiring sends the player's shuttle to pick them up (a trade Deal carrying `crew`).
 */
export interface ForHire {
  key: string;
  cost: number;
  station: number;
}
export const ForHireC = defineComponent<ForHire>('forHire');
