<script lang="ts">
  import Icon from './Icon.svelte';
  import { Dialog } from './kit';
  import type { UiJumpWarnings } from './starmapApi';
  import { holdModal } from './keys';

  /**
   * The one "before you jump" confirmation, for every way the player commits a jump (the starmap's Jump and Flee). It opens only when
   * something would stay behind: crew away from the ship, shuttles outside it, and (starmap only) a hostile shuttle docked at an airlock,
   * which can come along or be cut loose (`taking`). Nothing here blocks the jump: Confirm goes, Cancel stays.
   */
  let { warnings, taking = new Set<number>(), onToggle = () => {}, onConfirm, onCancel }: {
    warnings: UiJumpWarnings | null; taking?: Set<number>; onToggle?: (id: number) => void; onConfirm: () => void; onCancel: () => void;
  } = $props();
  // While open, game shortcuts (the combat HUD's Tab, weapon keys and so on) stand aside.
  $effect(() => {
    if (warnings) return holdModal();
  });
</script>

<Dialog open={!!warnings} onOpenChange={(o) => { if (!o) onCancel(); }} title="Before you jump" testId="jump-confirm">
  {#if warnings}
    <div class="body">
      {#if warnings.crew.length}<p class="warn"><Icon name="person" size={16} /><span>Left behind: <b>{warnings.crew.join(', ')}</b></span></p>{/if}
      {#if warnings.vehicles.length}<p class="warn"><Icon name="shuttle" size={16} /><span>Not aboard: <b>{warnings.vehicles.join(', ')}</b></span></p>{/if}
      {#each warnings.hostileDocked as d (d.id)}
        <label class="take"><input type="checkbox" checked={taking.has(d.id)} onchange={() => onToggle(d.id)} data-testid="starmap-take" />Take docked {d.name} along (else it is cut loose)</label>
      {/each}
      <div class="two">
        <button class="act" data-testid="jump-confirm-cancel" onclick={onCancel}>Cancel</button>
        <button class="go" data-testid="jump-confirm-go" onclick={onConfirm}><Icon name="fast" size={18} />Jump anyway</button>
      </div>
    </div>
  {/if}
</Dialog>

<style>
  /* Steel palette (the card itself lives in the dialog portal): graphite panel, amber for the warning, green commit, cyan interact. */
  :global(.kit-card[data-testid='jump-confirm']) { background: #0b0e11; border-color: #3a424a; border-radius: 0; }
  :global(.kit-card[data-testid='jump-confirm'] .kit-card-title) { font: 700 15px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .body { display: grid; gap: 10px; margin-top: 8px; }
  .warn { margin: 0; display: flex; gap: 8px; align-items: center; color: var(--amber); font-size: 14px; }
  .warn b { color: var(--text); font-weight: 600; }
  .take { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--text); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .two button { min-height: 38px; display: flex; gap: 6px; align-items: center; justify-content: center; font: 600 13px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; }
  .go { background: #11151a; border-color: var(--green); }
  .act { background: #11151a; border-color: var(--cyan); }
</style>
