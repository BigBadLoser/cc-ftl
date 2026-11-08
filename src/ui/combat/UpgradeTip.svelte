<script lang="ts">
  import type { UiApi, UiUpgradeInfo } from '../api';
  import Icon from '../Icon.svelte';
  import ItemIcon from '../ItemIcon.svelte';
  import { upgradeIconName } from '../upgradeIcon';

  /**
   * The fitted upgrade on a weapon row: a small line symbol; hovering it opens a card with the upgrade's item picture (40 px, as the inspector slot shows
   * it), its name and what it does. The card is moved to the page body, so no frame or transformed HUD ancestor clips or offsets it. Not a button: the
   * row it sits in is already clickable.
   */
  let { api, upgrade, size = 13, testid = 'weapon-upgrade', open = false, label }: {
    api: UiApi; upgrade: UiUpgradeInfo; size?: number; testid?: string;
    /** The weapon's (renamed) name as the trigger instead of the line symbol: a behaviour upgrade's name is its marker. */
    label?: string;
    /** Lab only: show the card without a hover. */
    open?: boolean;
  } = $props();
  let at = $state<{ x: number; y: number } | null>(null);
  const show = (e: Event) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    at = { x: r.left + r.width / 2, y: r.top };
  };
  const toBody = (node: HTMLElement, stay: boolean) => {
    if (stay) return {};
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  };
</script>

<span class="up" data-testid={testid} role="img" aria-label={upgrade.name} onmouseenter={show} onmouseleave={() => (at = null)}>
  {#if label !== undefined}<span class="lbl">{label}</span>{:else}<Icon name={upgradeIconName(upgrade.item)} {size} />{/if}
  {#if at || open}
    <span class="card" role="tooltip" data-testid="upgrade-card" use:toBody={open && !at} style:left="{at?.x ?? 0}px" style:top="{at?.y ?? 0}px" class:lab={open && !at}>
      <ItemIcon {api} item={upgrade.item} size={40} />
      <span class="txt"><b>{upgrade.name}</b>{#each upgrade.effects as line (line)}<small>{line}</small>{/each}</span>
    </span>
  {/if}
</span>

<style>
  .up { flex: none; display: inline-flex; color: var(--hud-key); opacity: 0.85; }
  .card {
    position: fixed; z-index: 70; transform: translate(-50%, calc(-100% - 8px)); display: flex; align-items: center; gap: 10px; box-sizing: border-box;
    width: 290px; padding: 8px 10px; background: var(--panel); border: 1px solid var(--cyan); box-shadow: var(--shadow-pop);
    color: var(--text); text-align: left; pointer-events: none;
  }
  .lbl { border-bottom: 1px dotted var(--dim); }
  .up:has(.lbl) { opacity: 1; color: inherit; }
  .card.lab { position: static; transform: none; }
  .txt { display: grid; gap: 2px; font-size: 12px; line-height: 1.3; }
  b { font: 600 13px var(--head-font); }
  small { color: var(--dim); font-size: 11px; }
</style>
