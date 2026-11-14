import type { UiStory } from './api';
import type { DecisionOption } from './kit/types';

/**
 * The decision bar's buttons for an open story decision: its real choices only. Remote actions (hail, scan, probe) are info actions and are never
 * choices; each window shows them its own way (the comms panels' buttons, the decision window's body buttons). The first is the primary.
 */
export function storyOptions(choices: NonNullable<UiStory['active']>['choices'], testId?: string): DecisionOption[] {
  return choices.filter((x) => !x.remote).map((x, i) => ({
    id: x.id, label: x.label, primary: i === 0, disabled: !x.enabled,
    note: [x.hint, x.odds?.label, x.cost.length ? `Costs ${x.cost.join(', ')}` : ''].filter(Boolean).join(' · ') || undefined,
    ...(x.reasons.length ? { reason: x.reasons.join('. ') } : {}),
    ...(testId ? { testId } : {}),
  }));
}
