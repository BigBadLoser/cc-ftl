import { defineComponent } from '../ecs';
import type { Intent, Interrupt, Task } from './types';

/** The crew member's current task, mirroring the legacy components in Phase 1 (see ai/task.ts). */
export const TaskC = defineComponent<Task>('task');
/** What the crew member wants (policy.legacy in Phase 1, see ai/policy.ts). */
export const IntentC = defineComponent<Intent>('intent');
/** Present while a forced state holds the crew member out of the normal loop (ai/interrupt.ts, a detector in Phase 1). */
export const InterruptC = defineComponent<Interrupt>('interrupt');
/**
 * A pickup request (#286): a suited crew member in thin air who can reach no air source while the tank still has air. Set and cleared by
 * the scheduler's turn from `Intent.blocked === 'air'`; the alert reads it. A shuttle answering it is the pickup run (slice 2b).
 */
export const PickupC = defineComponent<{ since: number }>('pickup');
