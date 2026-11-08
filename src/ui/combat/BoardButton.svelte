<script lang="ts">
  import { keyLabel, keymap } from '../keymap';
  import DockTab from './DockTab.svelte';

  /** Board: the dock's left-hand tab. Blocked, it is dimmed and says why on the tab and in its tooltip. */
  let { onBoard, blocker }: { onBoard: () => void; blocker: string | null } = $props();
</script>

<DockTab
  icon="shuttle"
  label="Board"
  keyText={keyLabel($keymap, 'combat.board')}
  disabled={!!blocker}
  dim={!!blocker}
  note={blocker}
  tip={blocker ?? 'Send a boarding party in a shuttle'}
  testid="combat-board"
  onclick={onBoard}
/>
