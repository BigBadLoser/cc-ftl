<script lang="ts">
	import { joinPopout } from './popout.svelte';
	import PreviewPane from './PreviewPane.svelte';

	// This window is the lab's preview, popped out: it mirrors the lab's tab over a channel (popout.svelte.ts).
	joinPopout();
</script>

<div class="h-screen w-screen bg-black"><PreviewPane /></div>
