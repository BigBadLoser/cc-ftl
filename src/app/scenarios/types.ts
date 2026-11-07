import type { Command, Sim } from '../../sim';
import type { Speed } from '../loop';

/**
 * What a `?scenario=` start may use of the running game: the sim to read, a way to send commands, the clock, the selection and a couple of debug
 * spawners. A scenario is `(ctx) => void`; it sets the game up and returns (waiting for the sim with timers where it must).
 */
export interface ScenarioCtx {
  sim: Sim;
  params: URLSearchParams;
  dispatch(cmd: Command): void;
  setSpeed(speed: Speed): void;
  selectCrew(id: number | null, focus?: boolean): void;
  setTool(tool: { tool: 'build'; build: 'hull'; hull: { brush: 'rect'; erase: boolean; mirror: boolean } }): void;
  /** Debug: a station east of everything in the node (`frame`: the camera frames it with the ship). */
  spawnStation(kind: string, size: 'outpost' | 'station' | 'hub', frame?: boolean): void;
  /** Debug: a raider (or the `?shipgen` ship) a fair distance from the player's ship. */
  spawnRaider(): void;
}

export type Scenario = (ctx: ScenarioCtx) => void;
