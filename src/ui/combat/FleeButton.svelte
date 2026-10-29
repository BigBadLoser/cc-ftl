<script lang="ts">
  import Icon from '../Icon.svelte';

  /**
   * Flee (disengage) with its drive charge. Two placements are mocked for comparison (`?flee=a|b`, see CombatHud): `cap` is a slim vertical end cap on the
   * ship strip (the charge fills upward), `bar` is a compact button under the clock and time controls (the charge is a thin bar under it).
   */
  let { drive, layout, onFlee }: {
    drive: { charge: number; max: number; helmManned: boolean; active: boolean }; layout: 'cap' | 'bar'; onFlee: () => void;
  } = $props();
  const ready = $derived(drive.charge >= drive.max && drive.active);
  const pct = $derived(Math.min(100, Math.round((drive.charge / drive.max) * 100)));
  const tip = $derived(ready ? 'Flee: jump out of the fight, then pick where to go on the starmap (F)' : drive.helmManned ? `Flee: drive charging ${Math.floor(drive.charge)}/${drive.max} s (F)` : 'Helm unmanned: the drive is not charging (F)');
</script>

<button class="flee {layout}" class:ready disabled={!ready} title={tip} aria-label="Flee" data-testid="combat-flee" onclick={onFlee}>
  <span class="fill" style={layout === 'cap' ? `height:${pct}%` : `width:${pct}%`}></span>
  <span class="lab"><Icon name="fast" size={layout === 'cap' ? 22 : 16} /><span>Flee</span><kbd>F</kbd></span>
</button>

<style>
  .flee { position: relative; min-height: 0; min-width: 0; padding: 0; overflow: hidden; display: grid; place-items: center; font: 600 15px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--text); }
  .lab { position: relative; display: grid; justify-items: center; gap: 6px; }
  kbd { font: 700 10px/1 var(--head-font); padding: 2px 4px; border: 1px solid var(--line-hi); color: var(--cyan); background: #061020; }
  .fill { position: absolute; background: rgba(54, 212, 255, 0.28); }
  .cap { width: 100%; height: 100%; } .cap .fill { left: 0; right: 0; bottom: 0; border-top: 2px solid var(--cyan); }
  .bar { height: 30px; width: 100%; border: 0; border-top: 1px solid var(--line); background: transparent; }
  .bar .lab { display: flex; gap: 8px; align-items: center; }
  .bar .fill { left: 0; bottom: 0; height: 3px; background: var(--cyan); }
  .ready { border-color: var(--green); color: #fff; } .ready .fill { background: rgba(71, 224, 160, 0.3); border-color: var(--green); } .bar.ready .fill { background: var(--green); } .ready kbd { color: var(--green); border-color: var(--green); }
  .bar.ready { background: #0b4f3a; }
  .flee:disabled { opacity: 1; color: var(--dim); }
  .flee.ready:disabled { color: #fff; }
</style>
