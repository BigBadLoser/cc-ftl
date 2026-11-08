<script lang="ts">
  import { Chip, chipTone } from '../kit';
  import FlickerText from './FlickerText.svelte';
  import type { CallerInfo } from './types';

  /** Who is calling: a large name (flickering to `caller.alt` if set), "<role> <ship>", the faction with its swatch, and a status pill. `force` holds the flicker for stills. */
  let { caller, force = false }: { caller: CallerInfo; force?: boolean } = $props();
</script>

<div class="card">
  <div class="name"><FlickerText value={caller.name} alt={caller.alt ?? null} {force} /></div>
  {#if caller.ship}<div class="sub">{caller.role ? `${caller.role} ` : ''}<b>{caller.ship}</b></div>{/if}
  <div class="sub"><i class="swatch" style:background={caller.swatch ?? 'var(--dim)'}></i>{caller.faction}</div>
  {#if caller.status}<div class="pills"><Chip tone={chipTone(caller.status.tone)}>{caller.status.label}</Chip></div>{/if}
</div>

<style>
  .card { display: grid; gap: 2px; min-width: 0; }
  .name { font: 700 18px/1.15 var(--head-font); letter-spacing: 0.02em; color: var(--text); }
  .sub { color: var(--dim); font-size: 12.5px; }
  .sub b { color: var(--text); font-weight: 600; }
  .swatch { display: inline-block; width: 8px; height: 8px; margin-right: 6px; }
  .pills { margin-top: 5px; }
</style>
