import { defineComponent } from '../ecs';
import type { Intent, Interrupt, Task } from './types';

/** The crew member's current task, mirroring the legacy components in Phase 1 (see ai/task.ts). */
export const TaskC = defineComponent<Task>('task');
/** What the crew member wants (policy.legacy in Phase 1, see ai/policy.ts). */
export const IntentC = defineComponent<Intent>('intent');
/** Present while a forced state holds the crew member out of the normal loop (ai/interrupt.ts, a detector in Phase 1). */
export const InterruptC = defineComponent<Interrupt>('interrupt');
