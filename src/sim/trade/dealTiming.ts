import type { Deal } from './types';

/** Ticks between repeats of a flight command a deal keeps asking for until the shuttle obeys. */
export const REPEAT = 20;
/** Seconds a deal may wait for the shuttle to get ready at home and for the crew to load it before it is called off. */
export const DISPATCH_SEC = 120;
export const LOAD_SEC = 300;
export const FLIGHT_SEC = 240;
/** Seconds the shuttle gets to fly home and dock, and the crew to empty it, before the delivery is given up on (it must not block travel forever). */
export const BACK_SEC = 240;
export const UNLOAD_SEC = 300;

/** True on the ticks a deal repeats its flight command. */
export const due = (d: Deal): boolean => d.timer % REPEAT === 1;
