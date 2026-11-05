<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The frame of a comms window: a title bar (`title` and a dim `subtitle`), three equal-height columns (named snippets `video`, `comms`, `sensors`; any
   * may be left out, and then its column goes) and a `footer`. It holds no state and does not position itself (the caller centres it).
   */
  let { title, subtitle, video, comms, sensors, footer, width = 1080 }: {
    title: string; subtitle?: string; video?: Snippet; comms?: Snippet; sensors?: Snippet; footer?: Snippet; width?: number;
  } = $props();
  const cols = $derived([video ? '220px' : '', comms ? '1fr' : '', sensors ? '340px' : ''].filter(Boolean).join(' '));
</script>

<section class="win" style:width={`min(${width}px, calc(100vw - 32px))`} data-testid="comms-window">
  <div class="title"><b>{title}</b>{#if subtitle}<span>{subtitle}</span>{/if}</div>
  <div class="cols" style:grid-template-columns={cols}>
    {#if video}<div class="pane">{@render video()}</div>{/if}
    {#if comms}<div class="pane">{@render comms()}</div>{/if}
    {#if sensors}<div class="pane">{@render sensors()}</div>{/if}
  </div>
  {#if footer}{@render footer()}{/if}
</section>

<style>
  .win { background: var(--panel-2); border: 1px solid var(--line-hi); border-radius: 0; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6); color: var(--text); }
  .title { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--line); font: 700 13px var(--head-font); letter-spacing: 0.14em; text-transform: uppercase; }
  .title b { color: var(--cyan); font-weight: 700; }
  .title span { color: var(--dim); }
  .cols { display: grid; align-items: stretch; }
  .pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; border-right: 1px solid var(--line); }
  .pane:last-child { border-right: 0; }
</style>
