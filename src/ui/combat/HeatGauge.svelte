<script lang="ts">
  import Icon from '../Icon.svelte';

  /**
   * MOCK: ship heat has no sim yet. `heat` (0..1) is a fake value fed in by CombatHud, and Vent / Overcharge only change local mock state.
   * Draws one large horizontal gauge (cyan, amber from 70%, red from 90%), a Vent button and three Overcharge buttons, one shown active with a countdown ring.
   */
  let { heat, active, left, onVent, onOvercharge }: {
    heat: number; active: 'weapons' | 'shields' | 'engines' | null; left: number; onVent: () => void; onOvercharge: (k: 'weapons' | 'shields' | 'engines') => void;
  } = $props();

  const kinds = [
    { k: 'weapons', icon: 'target', label: 'Weapons' },
    { k: 'shields', icon: 'shield', label: 'Shields' },
    { k: 'engines', icon: 'bolt', label: 'Engines' },
  ] as const;
  const pct = $derived(Math.round(heat * 100));
  const tone = $derived(heat >= 0.9 ? 'red' : heat >= 0.7 ? 'amber' : 'cool');
  const R = 15;
  const C = 2 * Math.PI * R;
</script>

<div class="heat" data-testid="heat-gauge">
  <div class="top">
    <span class="cap"><Icon name="fire" size={14} />Heat</span>
    <b class={tone}>{pct}%</b>
    <button class="vent" title="Vent heat: shed it fast, weapons and shields pause (G)" onclick={onVent}><Icon name="wind" size={15} />Vent<kbd>G</kbd></button>
  </div>
  <div class="gauge {tone}" role="meter" aria-label="Ship heat" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
    <i style="width:{pct}%"></i>
    <u style="left:70%"></u><u style="left:90%"></u>
  </div>
  <div class="oc">
    {#each kinds as o (o.k)}
      <button class="ocb" class:on={active === o.k} title="Overcharge {o.label}: more output, adds heat" onclick={() => onOvercharge(o.k)}>
        <span class="ring">
          {#if active === o.k}
            <svg viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r={R} class="trk" /><circle cx="18" cy="18" r={R} class="arc" stroke-dasharray={C} stroke-dashoffset={C * (1 - left)} transform="rotate(-90 18 18)" /></svg>
          {/if}
          <Icon name={o.icon} size={18} />
        </span>
        <span class="lb">{o.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .heat { display: grid; gap: 6px; }
  .top { display: flex; align-items: center; gap: 8px; }
  .cap { display: inline-flex; align-items: center; gap: 5px; font: 600 13px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  b { font: 700 22px/1 var(--head-font); } b.cool { color: var(--cyan); } b.amber { color: var(--amber); } b.red { color: var(--red); }
  .vent { margin-left: auto; min-height: 0; min-width: 0; height: 28px; padding: 0 8px; display: inline-flex; align-items: center; gap: 5px; font: 600 14px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  kbd { font: 600 10px/1 var(--head-font); padding: 2px 4px; border: 1px solid var(--line-hi); color: var(--dim); }
  .gauge { position: relative; height: 22px; background: #061020; border: 1px solid var(--line-hi); }
  .gauge > i { display: block; height: 100%; background: linear-gradient(90deg, #1b8fb3, var(--cyan)); transition: width 0.3s; }
  .gauge.amber > i { background: linear-gradient(90deg, #1b8fb3, var(--amber)); }
  .gauge.red > i { background: linear-gradient(90deg, var(--amber), var(--red)); animation: pulse 0.9s infinite alternate; }
  .gauge > u { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(216, 240, 255, 0.45); }
  @keyframes pulse { to { filter: brightness(1.35); } }
  .oc { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
  .ocb { min-height: 0; min-width: 0; height: 52px; padding: 0 2px; display: grid; justify-items: center; align-content: center; gap: 2px; color: var(--cyan); }
  .ocb.on { border-color: var(--amber); color: #fff; background: #2a2210; }
  .ring { position: relative; width: 36px; height: 36px; display: grid; place-items: center; }
  .ring svg { position: absolute; inset: 0; }
  .trk { fill: none; stroke: #3a2f10; stroke-width: 3; }
  .arc { fill: none; stroke: var(--amber); stroke-width: 3; }
  .lb { font: 600 10px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); }
  .ocb.on .lb { color: var(--amber); }
</style>
