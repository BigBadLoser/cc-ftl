import { defineComponent } from './ecs';

/** A grid position marker. Placeholder component used by the debug command and tests. */
export interface Marker {
  x: number;
  y: number;
}

export const MarkerC = defineComponent<Marker>('marker');
