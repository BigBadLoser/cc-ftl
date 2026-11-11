<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { lab } from './lab.svelte';
</script>

<ScrollArea class="size-full">
	<div class="flex flex-col gap-2 p-3">
		<div class="flex items-center justify-between">
			<span class="text-xs text-muted-foreground">Since the imported design</span>
			<Badge variant="secondary">{lab.changes.length ? lab.changes.length : 'none'}</Badge>
		</div>
		<ul class="flex flex-col gap-1 text-sm">
			{#each lab.changes as c, i (i)}<li><button class="w-full rounded-md px-1.5 py-1 text-left hover:bg-muted" onclick={() => lab.flash(c.tiles)}>{c.text}</button></li>{/each}
		</ul>
	</div>
</ScrollArea>
