<script lang="ts">
  import type { UiModuleDef, UiThumb } from './api';
  import { previewGeometry, rotateAccess } from './buildCatalog';

  let { def, thumb, rot }: { def: UiModuleDef; thumb?: UiThumb; rot: number } = $props();
  const W = 300, H = 200;
  const dims = $derived(rot % 2 ? { w: def.h, h: def.w } : { w: def.w, h: def.h });
  const access = $derived(def.access ? rotateAccess(def.w, def.h, rot, def.access[0], def.access[1]) : null);
  const g = $derived(previewGeometry(dims.w, dims.h, access, thumb && thumb.w ? thumb : null, { w: W, h: H }));
</script>

<div class="prev" style:width="{W}px" style:height="{H}px">
  <svg width={W} height={H} viewBox="0 0 {W} {H}" aria-hidden="true">
    {#each g.grid as p, i (i)}<polygon class="g" points={p} />{/each}
    {#each g.foot as p, i (i)}<polygon class="f" points={p} />{/each}
    {#if g.access}<polygon class="acc" points={g.access} />{/if}
  </svg>
  {#if g.sprite && thumb}<img src={thumb.url} alt="" style:left="{g.sprite.left}px" style:top="{g.sprite.top}px" style:width="{g.sprite.width}px" style:height="{g.sprite.height}px" />{/if}
  <svg width={W} height={H} viewBox="0 0 {W} {H}" aria-hidden="true">
    {#if g.accessLabel}<text x={g.accessLabel.x} y={g.accessLabel.y} class="lbl">USE</text>{/if}
  </svg>
</div>

<style>
  .prev { position: relative; overflow: hidden; background: #000; border: 1px solid #242424; box-sizing: content-box; }
  svg { position: absolute; inset: 0; }
  img { position: absolute; image-rendering: pixelated; }
  polygon { stroke-width: 1; }
  .g { fill: none; stroke: #2a2a2a; }
  .f { fill: rgba(54, 212, 255, 0.13); stroke: #36d4ff; }
  .acc { fill: rgba(240, 177, 58, 0.15); stroke: #f0b13a; stroke-dasharray: 4 3; }
  .lbl { paint-order: stroke; stroke: #000; stroke-width: 3px; fill: #f0b13a; font: 700 10px var(--head-font); letter-spacing: 0.08em; text-anchor: middle; }
</style>
