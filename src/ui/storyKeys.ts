import type { UiStory } from './api';
import { holdModal, isTypingTarget } from './keys';
import { keymap } from './keymap';

/** The next sensor action still to take on an open decision (scan, then probe): what the scan key raises. Null when none is left. */
export const nextSensorChoice = (active: NonNullable<UiStory['active']>): string | null =>
  active.choices.find((c) => c.remote && c.remote !== 'hail' && c.enabled && !c.done)?.id ?? null;

/**
 * The keyboard of an open story decision, for both windows (comms and plain): the game's own keys stand aside while it is open (a forced decision), and
 * the scan key (`ui.scan`, from the keymap) takes the next sensor action. `get` reads the current state, so it follows the decision. Returns the cleanup.
 */
export function storyKeys(get: () => { active: NonNullable<UiStory['active']>; busy: boolean; pick: (id: string) => void }): () => void {
  const release = holdModal();
  const keydown = (e: KeyboardEvent): void => {
    const { active, busy, pick } = get();
    if (busy || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e)) return;
    const next = nextSensorChoice(active);
    if (keymap.matches(e, 'ui.scan') && next) { e.preventDefault(); pick(next); }
  };
  window.addEventListener('keydown', keydown);
  return () => { window.removeEventListener('keydown', keydown); release(); };
}
