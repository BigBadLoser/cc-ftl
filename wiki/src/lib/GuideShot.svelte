<script lang="ts">
  import { asset } from '$app/paths';

  // An in-game screenshot from `npm run capture` (scripts/guide-shots.mjs), with the recipe's numbered callouts drawn
  // over the elements they point at. Positions come from the capture, so they follow the UI when it's re-shot.
  type Mark = { label: string; anchor?: 'corner' | 'left'; x: number; y: number; w: number; h: number };
  const all = import.meta.glob<Mark[]>('../data/guide-shots/*.json', { eager: true, import: 'default' });

  let { name, alt, caption, width }: { name: string; alt: string; caption?: string; width?: string } = $props();
  const marks = $derived(all['../data/guide-shots/' + name.replaceAll('/', '__') + '.json'] ?? []);
  const pct = (v: number) => (v * 100).toFixed(2) + '%';
  // asset() is typed to the static files known at sync time; guide shots are checked by the capture script instead.
  const src = $derived(asset(('/guides/' + name + '.webp') as Parameters<typeof asset>[0]));
</script>

<figure class="wiki-guide-shot" style:max-width={width}>
  <div class="frame">
    <img {src} {alt} loading="lazy" />
    {#each marks as m (m.label)}
      <span class="box" style:left={pct(m.x)} style:top={pct(m.y)} style:width={pct(m.w)} style:height={pct(m.h)}></span>
      <!-- On the box's corner, or just outside its left edge; always kept inside the image. -->
      <span class="badge" style:left="max(2px, calc({pct(m.x)} - {m.anchor === 'left' ? '1.85rem' : '.75rem'}))"
        style:top="max(2px, calc({pct(m.anchor === 'left' ? m.y + m.h / 2 : m.y)} - .75rem))">{m.label}</span>
    {/each}
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .wiki-guide-shot { margin: 1.1rem 0 1.4rem; }
  .frame { position: relative; border-radius: .5rem; overflow: hidden; border: 1px solid var(--wiki-card-border, #283548); }
  img { display: block; width: 100%; height: auto; }
  .box { position: absolute; border: 2px solid #f0b43c; border-radius: 4px; pointer-events: none; }
  .badge {
    position: absolute;
    min-width: 1.5rem; height: 1.5rem; padding: 0 .3rem; border-radius: 999px;
    display: grid; place-items: center;
    background: #f0b43c; color: #14100a; font-weight: 800; font-size: .8rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, .6);
  }
  figcaption { margin-top: .45rem; font-size: .83rem; color: var(--wiki-subtle, #8a9bb0); }
</style>
