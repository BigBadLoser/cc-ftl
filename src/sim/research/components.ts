import { defineComponent } from '../ecs';

/**
 * On a player ship that has queued research. `queue[0]` is the active project once `paid` (its materials were taken from the ship's
 * stock); `progress` is the work done on it, in ticks at workSpeed 1 and science 0. Added by the first `research.queue`.
 */
export interface Research {
  queue: string[];
  progress: number;
  paid: boolean;
}
export const ResearchC = defineComponent<Research>('research');
