<script lang="ts">
  import Icon from '../Icon.svelte';
  import { ActionButton, Frame, KeyBadge } from '../kit';
  import { keyLabel, keymap } from '../keymap';

  /**
   * Battle stations with no fight on (`combat.battleStations`): crew at the consoles, guns run out, every weapon held. One line on what a shot
   * means here (the ship it hits turns hostile), and the way back.
   */
  let { held, onStandDown }: { held: boolean; onStandDown: () => void } = $props();
</script>

<Frame title="Battle stations" style="width:290px; pointer-events:auto; background: var(--panel)" testid="stations-card">
  <div class="body">
    <p class="line"><Icon name={held ? 'shield' : 'alert'} size={14} />{held ? 'Weapons held. No one here is hostile.' : 'Weapons free. A shot fired on a ship turns it hostile.'}</p>
    <ActionButton onclick={onStandDown} testid="stand-down">Stand down<KeyBadge tone="dim" size="sm" padX={5}>{keyLabel($keymap, 'combat.stations')}</KeyBadge></ActionButton>
  </div>
</Frame>

<style>
  .body { display: grid; gap: 8px; padding: 8px 10px 10px; }
  .line { margin: 0; display: flex; gap: 6px; align-items: flex-start; font-size: 12px; color: var(--dim); }
  .line :global(svg) { flex: none; margin-top: 1px; }
</style>
