<script lang="ts">
  import '../styles/wiki.css';
  import SidebarControl from '../lib/SidebarControl.svelte';
  const { children } = $props();
</script>

<SidebarControl />

{@render children?.()}
