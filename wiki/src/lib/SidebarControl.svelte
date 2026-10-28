<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';

  let hidden = $state(false);
  const onWikiArticle = $derived(
    page.url.pathname.startsWith('/cc-ftl/wiki/') && page.url.pathname !== '/cc-ftl/wiki/'
  );

  function setHidden(next: boolean) {
    hidden = next;
    document.documentElement.classList.toggle('wiki-sidebar-hidden', hidden);
    try { localStorage.setItem('wiki-sidebar-hidden', hidden ? '1' : '0'); } catch { /* storage may be blocked */ }
  }

  onMount(() => {
    try { hidden = localStorage.getItem('wiki-sidebar-hidden') === '1'; } catch { /* storage may be blocked */ }
    document.documentElement.classList.toggle('wiki-sidebar-hidden', hidden);
    return () => document.documentElement.classList.remove('wiki-sidebar-hidden');
  });
</script>

{#if onWikiArticle}
  <button
    class="wiki-sidebar-toggle"
    type="button"
    title={hidden ? 'Show navigation sidebar' : 'Hide navigation sidebar'}
    aria-label={hidden ? 'Show navigation sidebar' : 'Hide navigation sidebar'}
    aria-pressed={hidden}
    onclick={() => setHidden(!hidden)}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8">
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M9 4v16" />
      {#if hidden}
        <path d="m13 9 3 3-3 3" />
      {:else}
        <path d="m16 9-3 3 3 3" />
      {/if}
    </svg>
  </button>
{/if}
