<script lang="ts">
  import Icon from '../Icon.svelte';

  /** Flee with its drive charge: a vertical tab docked to the right edge of the ship strip, the charge filling upward (cyan, green when ready). */
  let { drive, onFlee }: { drive: { charge: number; max: number; helmManned: boolean; active: boolean }; onFlee: () => void } = $props();
  const ready = $derived(drive.charge >= drive.max && drive.active);
  const pct = $derived(Math.min(100, Math.round((drive.charge / drive.max) * 100)));
  const tip = $derived(ready ? 'Flee: jump out of the fight, then pick where to go on the starmap (F)' : drive.helmManned ? `Flee: drive charging ${Math.floor(drive.charge)}/${drive.max} s (F)` : 'Helm unmanned: the drive is not charging (F)');
</script>

<button class="flee" class:ready disabled={!ready} title={tip} aria-label="Flee" data-testid="combat-flee" onclick={onFlee}>
  <span class="fill" style="height:{pct}%"></span>
  <span class="lab"><Icon name="fast" size={22} /><span>Flee</span><kbd>F</kbd></span>
</button>

<style>
  .flee { position: relative; flex: none; width: 60px; min-height: 0; min-width: 0; padding: 0; overflow: hidden; display: grid; place-items: center; font: 600 15px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--text); background: var(--panel); border: 1px solid var(--line-hi); border-left: 0; }
  .lab { position: relative; z-index: 1; display: grid; justify-items: center; gap: 6px; }
  kbd { font: 700 10px/1 var(--head-font); padding: 2px 4px; border: 1px solid var(--line-hi); color: var(--cyan); background: #061020; }
  .fill { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(54, 212, 255, 0.26); box-shadow: inset 0 2px 0 var(--cyan); }
  .ready { color: #fff; } .ready .fill { background: rgba(71, 224, 160, 0.3); box-shadow: inset 0 2px 0 var(--green); } .ready kbd { color: var(--green); border-color: var(--green); }
  .flee:disabled { opacity: 1; } .flee:disabled:not(.ready) .lab { opacity: 0.55; } .flee.ready:disabled { color: #fff; }
</style>
