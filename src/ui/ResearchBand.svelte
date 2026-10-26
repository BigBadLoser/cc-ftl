<script lang="ts">
  import type { BandBox } from './researchLayout';

  let { band }: { band: BandBox } = $props();
</script>

<div class="band" style:top="{band.top}px" style:height="{band.height}px" style:min-width="{band.width}px" data-testid="band-{band.id}"><h4>{band.name}</h4></div>

<style>
  .band { position: absolute; left: 0; right: 0; box-sizing: border-box; border: 1px solid #1c1c1c; background: #050505; }
  h4 { position: absolute; top: 8px; left: 12px; margin: 0; font: 600 12px var(--head-font); letter-spacing: 0.08em; color: var(--amber); text-transform: uppercase; }
</style>
