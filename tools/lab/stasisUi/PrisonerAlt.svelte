<script lang="ts">
  import type { UiCrew } from '../../../src/ui/api';
  import { Chip } from '../../../src/ui/kit';
  import Icon from '../../../src/ui/Icon.svelte';
  import StatBar from '../../../src/ui/inspector/StatBar.svelte';

  /** Mock (#116): a frozen prisoner's Overview in the normal crew layout: portrait and stat rows, the reserve as a row like health. */
  let { c, face, frost }: { c: UiCrew; face: string | null; frost: boolean } = $props();
  const st = $derived(c.stasis!);
</script>

<div class="top">
  <span class="face" class:frost>{#if face}<img src={face} alt="" />{/if}{#if frost}<span class="fx"></span>{/if}<span class="badge"><Icon name="snowflake" size={12} /></span></span>
  <div class="vitals">
    <div class="v"><span class="ic"><Icon name="heart" size={16} /></span><StatBar value={(c.hp / c.maxHp) * 100} health /><span class="n">{c.hp}/{c.maxHp}</span></div>
    <div class="v"><span class="ic"><Icon name="snowflake" size={16} /></span><StatBar value={st.reserve} color={st.draining ? 'var(--red)' : '#7fdcf0'} low={st.draining} /><span class="n" class:bad={st.draining}>{st.reserve}% reserve</span></div>
  </div>
</div>
<p class="doing"><Chip tone="bad">Prisoner</Chip><span class:bad={st.draining}>{st.draining ? 'Frozen, slab on its reserve' : 'Frozen in stasis'}</span></p>
<p class="where"><span class="ic"><Icon name="pin" size={14} /></span>
  {#if st.carrier}<span>On <button class="lk">{st.carrier.name}</button>'s cart{#if st.to}, to the {st.to.toLowerCase()}{/if}</span>
  {:else if st.wheel}<button class="lk">{st.where}</button>{:else}<span>{st.where}</span>{/if}</p>

<style>
  .top { display: grid; grid-template-columns: 64px 1fr; gap: 10px; margin-bottom: 10px; }
  .face { position: relative; width: 64px; height: 68px; background: var(--track); border: 1px solid var(--line); overflow: hidden; box-sizing: border-box; }
  .face.frost { border-color: #7fdcf0; }
  .face img { display: block; width: 100%; height: 100%; image-rendering: pixelated; object-fit: cover; }
  .face.frost img { filter: saturate(.45) brightness(1.05); }
  .fx { position: absolute; inset: 0; background: linear-gradient(160deg, rgba(160,225,240,.35), rgba(80,150,170,.1) 60%, rgba(180,235,245,.25)); }
  .badge { position: absolute; right: 2px; bottom: 2px; display: inline-flex; padding: 1px; background: #061a22; color: #7fdcf0; border: 1px solid #2c6878; }
  .vitals { display: grid; gap: 0; align-content: center; min-width: 0; }
  .v { display: grid; grid-template-columns: 18px 1fr 84px; gap: 8px; align-items: center; min-height: 18px; font-size: 13px; }
  .ic { display: inline-flex; color: var(--dim); }
  .n { text-align: right; white-space: nowrap; }
  .doing, .where { display: flex; gap: 6px; align-items: center; margin: 0 0 8px; font-size: 13px; }
  .doing span:last-child { color: #9fe7f5; }
  .bad, .doing span.bad { color: var(--red); }
  .lk { background: none; border: none; padding: 0; min-height: 0; font: inherit; color: var(--cyan); cursor: pointer; } .lk:hover { text-decoration: underline; }
</style>
