<script lang="ts">
  import type { UiApi, UiCrop, UiModule } from '../api';
  import ItemIcon from '../ItemIcon.svelte';
  import { Meter, TipButton } from '../kit';

  /** A hydroponics bed's panel: pick the crop it sows, see what is growing and what it waits for. */
  let { api, m }: { api: UiApi; m: UiModule } = $props();
  const p = $derived(m.plot);
  const time = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const tip = (c: UiCrop): string => `${c.blurb} ${c.yield} ${c.itemName} per harvest, ${time(c.growSec)} to grow, ${c.water} water to sow.`;
  const pick = (crop: string | null): void => api.dispatch({ type: 'plot.setCrop', moduleId: m.id, crop });
</script>

{#if p}
  <section data-testid="plot-panel">
    <h3>Crop <small>sown after each harvest</small></h3>
    <div class="crops" data-testid="crop-picker">
      {#each p.crops as c (c.id)}
        <TipButton text={tip(c)} side="left" class="crop {p.crop === c.id ? 'on' : ''}" aria-pressed={p.crop === c.id} data-testid="crop-{c.id}" onclick={() => pick(c.id)}>
          <ItemIcon {api} item={c.item} size={30} />
          <span class="nm">{c.name}</span>
          <span class="dim">{c.yield} / {time(c.growSec)}</span>
        </TipButton>
      {/each}
      <button class="none" class:on={p.crop === null} aria-pressed={p.crop === null} data-testid="crop-none" onclick={() => pick(null)}>Leave empty</button>
    </div>
    <div class="state" data-testid="plot-state">
      <div class="jl">
        <span>{p.plantedName ?? 'Empty bed'}</span>
        <b class:bad={/No power/.test(p.note)} class:good={p.state === 'ready'}>{p.note}</b>
      </div>
      {#if p.planted}<Meter value={Math.round(p.progress * 100)} max={100} tone="good" height={6} title="{Math.round(p.progress * 100)}% grown" />{/if}
      {#if p.crop}<div class="dim small">{p.stock} {p.crops.find((c) => c.id === p.crop)?.itemName} in stock</div>{/if}
    </div>
  </section>
{/if}

<style>
  section { margin-top: 8px; }
  h3 { margin: 10px 0 4px; font-size: 13px; color: var(--ink-accent); }
  h3 small { color: var(--dim); font-weight: normal; margin-left: 6px; }
  .crops { display: grid; gap: 4px; }
  .crops :global(.crop) { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 2px 8px 2px 4px; text-align: left; }
  .crops :global(.crop.on), .none.on { border-color: var(--amber); color: var(--amber); }
  .nm { flex: 1; font-weight: 600; }
  .dim { color: var(--dim); }
  .small { font-size: 12px; margin-top: 2px; }
  .none { min-height: 32px; }
  .state { margin-top: 8px; }
  .jl { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
  .bad { color: var(--red); }
  .good { color: var(--good-ink); }
</style>
