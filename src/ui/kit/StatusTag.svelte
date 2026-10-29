<script lang="ts">
  /** A two-line station tag: a short name over a one-word status, flat, with a coloured bottom edge (cyan when ok, amber when warn, red when down). */
  let { tag, status, ok, warn = false, title }: { tag: string; status: string; ok: boolean; warn?: boolean; title?: string } = $props();
</script>

<span class="tag" class:ok class:warn {title}>
  <b>{tag}</b>
  <em>{status}</em>
</span>

<style>
  .tag {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 3px;
    font-family: var(--head-font);
    color: var(--red);
    background: var(--hostile-fill);
    border-bottom: 2px solid var(--red);
  }
  .tag.ok {
    color: var(--cyan);
    background: var(--ok-fill);
    border-bottom-color: var(--cyan);
  }
  .tag.warn {
    color: var(--amber);
    background: var(--amber-fill);
    border-bottom-color: var(--amber);
  }
  b {
    font: 700 12px/1 var(--head-font);
    letter-spacing: 0.06em;
  }
  em {
    font: 600 10.5px/1 var(--head-font);
    font-style: normal;
    letter-spacing: 0.02em;
    color: inherit;
    opacity: 0.85;
  }
</style>
