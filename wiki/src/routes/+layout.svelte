<script lang="ts">
  import '../styles/wiki.css';
  import SidebarControl from '../lib/SidebarControl.svelte';
  import TipHost from '../../../src/ui/kit/TipHost.svelte';
  import '../data/generated/game-ui.css';
  const { children } = $props();
</script>

<SidebarControl />
<!-- The game's one tooltip host, for the live game panels' tooltips (use:tip), in the game's theme. -->
<div class="game-ui" style="display: contents"><TipHost /></div>

{@render children?.()}
