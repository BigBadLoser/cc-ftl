<script lang="ts">
  import type { Slot } from './blocks';
  import type { UiApi } from '../api';
  import SlotBox from './SlotBox.svelte';

  /**
   * A loadout on a body: a plain silhouette (placeholder until the real figure art, #245) with four slots around it, carrying
   * and weapon on the left, implant and armor on the right, each tied by a cyan square-cornered leader line to the shoulder
   * (carrying, implant) or the hand (weapon, armor) it belongs to. Hovering a filled slot opens its stats card.
   */
  let { api, carrying, weapon, implant, armor }: { api: UiApi; carrying: Slot; weapon: Slot; implant: Slot; armor: Slot } = $props();
  /** The figure's spot in the 458 x 300 doll, and the anchor points (figure coordinates) of the shoulders and hands. */
  const FX = 140;
  const FY = 6;
  const lead = (sx: number, sy: number, ex: number, ey: number): string => {
    const x = FX + ex;
    const y = FY + ey;
    const mid = sx < x ? sx + 40 : sx - 40;
    return `M${sx} ${sy} H${mid} V${y} H${x}`;
  };
  const LINES = [[92, 62, 54, 66], [366, 62, 126, 66], [92, 222, 49, 172], [366, 222, 131, 172]] as const;
  const BODY = 'M84.0 44.0 C81.8 45.3 86.0 49.8 83.0 52.0 C80.0 54.2 70.5 55.3 66.0 57.0 C61.5 58.7 58.5 59.5 56.0 62.0 C53.5 64.5 52.3 66.3 51.0 72.0 C49.7 77.7 48.8 87.7 48.0 96.0 C47.2 104.3 46.7 113.3 46.0 122.0 C45.3 130.7 44.3 141.3 44.0 148.0 C43.7 154.7 44.0 158.0 44.0 162.0 C44.0 166.0 43.3 168.8 44.0 172.0 C44.7 175.2 46.3 180.2 48.0 181.0 C49.7 181.8 52.7 179.7 54.0 177.0 C55.3 174.3 55.5 169.8 56.0 165.0 C56.5 160.2 56.5 154.8 57.0 148.0 C57.5 141.2 58.3 132.0 59.0 124.0 C59.7 116.0 60.2 106.7 61.0 100.0 C61.8 93.3 63.2 84.0 64.0 84.0 C64.8 84.0 65.3 94.0 66.0 100.0 C66.7 106.0 68.2 113.0 68.0 120.0 C67.8 127.0 65.8 132.7 65.0 142.0 C64.2 151.3 62.8 164.7 63.0 176.0 C63.2 187.3 65.5 200.0 66.0 210.0 C66.5 220.0 65.3 227.3 66.0 236.0 C66.7 244.7 70.3 255.7 70.0 262.0 C69.7 268.3 64.0 270.8 64.0 274.0 C64.0 277.2 66.3 279.8 70.0 281.0 C73.7 282.2 83.3 284.2 86.0 281.0 C88.7 277.8 86.0 269.5 86.0 262.0 C86.0 254.5 85.8 244.7 86.0 236.0 C86.2 227.3 86.7 220.0 87.0 210.0 C87.3 200.0 87.5 185.7 88.0 176.0 C88.5 166.3 89.3 152.0 90.0 152.0 C90.7 152.0 91.5 166.3 92.0 176.0 C92.5 185.7 92.7 200.0 93.0 210.0 C93.3 220.0 93.8 227.3 94.0 236.0 C94.2 244.7 94.0 254.5 94.0 262.0 C94.0 269.5 91.3 277.8 94.0 281.0 C96.7 284.2 106.3 282.2 110.0 281.0 C113.7 279.8 116.0 277.2 116.0 274.0 C116.0 270.8 110.3 268.3 110.0 262.0 C109.7 255.7 113.3 244.7 114.0 236.0 C114.7 227.3 113.5 220.0 114.0 210.0 C114.5 200.0 116.8 187.3 117.0 176.0 C117.2 164.7 115.8 151.3 115.0 142.0 C114.2 132.7 112.2 127.0 112.0 120.0 C111.8 113.0 113.3 106.0 114.0 100.0 C114.7 94.0 115.2 84.0 116.0 84.0 C116.8 84.0 118.2 93.3 119.0 100.0 C119.8 106.7 120.3 116.0 121.0 124.0 C121.7 132.0 122.5 141.2 123.0 148.0 C123.5 154.8 123.5 160.2 124.0 165.0 C124.5 169.8 124.7 174.3 126.0 177.0 C127.3 179.7 130.3 181.8 132.0 181.0 C133.7 180.2 135.3 175.2 136.0 172.0 C136.7 168.8 136.0 166.0 136.0 162.0 C136.0 158.0 136.3 154.7 136.0 148.0 C135.7 141.3 134.7 130.7 134.0 122.0 C133.3 113.3 132.8 104.3 132.0 96.0 C131.2 87.7 130.3 77.7 129.0 72.0 C127.7 66.3 126.5 64.5 124.0 62.0 C121.5 59.5 118.5 58.7 114.0 57.0 C109.5 55.3 100.0 54.2 97.0 52.0 C94.0 49.8 98.2 45.3 96.0 44.0 C93.8 42.7 86.2 42.7 84.0 44.0 Z';
</script>

<div class="doll" data-testid="paper-doll">
  <svg class="fig" width="180" height="285" viewBox="0 0 180 285" style:left="{FX}px" style:top="{FY}px" aria-hidden="true">
    <g fill="#2c3946" stroke="#a9bccd" stroke-width="2" stroke-linejoin="round"><ellipse cx="90" cy="25" rx="15" ry="19" /><path d={BODY} /></g>
    <g fill="none" stroke="#56677a" stroke-width="1.5" stroke-linecap="round"><path d="M80 57 Q90 70 100 57" /><path d="M67 120 Q90 126 113 120" /><path d="M70 208 Q77 211 84 208 M96 208 Q103 211 110 208" /></g>
  </svg>
  <svg class="lines" width="458" height="300" aria-hidden="true">
    <g stroke="var(--cyan)" stroke-width="2" fill="none" shape-rendering="crispEdges">
      {#each LINES as [sx, sy, ex, ey], i (i)}<path d={lead(sx, sy, ex, ey)} /><rect x={FX + ex - 4} y={FY + ey - 4} width="8" height="8" fill="var(--cyan)" stroke="none" />{/each}
    </g>
  </svg>
  <div class="at" style="left:8px;top:20px"><SlotBox {api} slot={carrying} /></div>
  <div class="at" style="left:8px;top:180px"><SlotBox {api} slot={weapon} /></div>
  <div class="at" style="left:366px;top:20px"><SlotBox {api} slot={implant} cardAt="left" /></div>
  <div class="at" style="left:366px;top:180px"><SlotBox {api} slot={armor} cardAt="left" /></div>
</div>

<style>
  .doll { position: relative; width: 458px; height: 300px; }
  .fig, .lines { position: absolute; display: block; pointer-events: none; }
  .lines { left: 0; top: 0; }
  .at { position: absolute; }
  .at:hover { z-index: 5; }
</style>
