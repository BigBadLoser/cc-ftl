<script lang="ts">
  import Icon from '../Icon.svelte';
  import { ActionButton, Frame, KeyBadge } from '../kit';
  import { anchor } from '../lessons/anchors';

  /** The ACTIONS frame: fire the charged weapons now, or put every weapon on hold (H; again to restore). */
  let { canVolley, holding, onVolley, onHold, style = '' }: {
    canVolley: boolean;
    holding: boolean;
    onVolley: () => void;
    onHold: () => void;
    style?: string;
  } = $props();
</script>

<Frame title="Actions" {style} lesson={anchor('combat.actions')}>
  <div class="acts">
    <span class="wide">
      <ActionButton tone="go" disabled={!canVolley} title="Fire every charged weapon now (V)" testid="combat-volley" onclick={onVolley}>
        <Icon name="volley" size={18} />Volley<KeyBadge tone="dim" size="sm" padX={5}>V</KeyBadge>
      </ActionButton>
    </span>
    <span class="wide">
      <ActionButton
        tone={holding ? 'active' : 'plain'}
        title={holding ? 'Restore every weapon to the mode it had (H)' : 'Put every weapon on hold: they charge but wait for a volley or an aim (H)'}
        testid="combat-hold"
        onclick={onHold}
      >
        <Icon name="hold" size={18} />{holding ? 'Held' : 'Hold all'}<KeyBadge tone="dim" size="sm" padX={5}>H</KeyBadge>
      </ActionButton>
    </span>
  </div>
</Frame>

<style>
  .acts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--gutter);
    grid-template-rows: 1fr;
    flex: 1;
    min-height: 42px;
  }
  .wide {
    grid-column: span 2;
    display: block;
    min-width: 0;
  }
</style>
