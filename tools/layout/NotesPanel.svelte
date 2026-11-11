<script lang="ts">
	import Trash from '@lucide/svelte/icons/trash-2';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { lab } from './lab.svelte';
	import { describeAnchor } from './pins';
</script>

<ScrollArea class="size-full">
	<div class="flex flex-col gap-1 p-3">
		{#each lab.pins as p (p.id)}
			<div class="flex items-start gap-1 rounded-md px-1.5 py-1 hover:bg-muted {lab.openPin === p.id ? 'bg-muted' : ''}">
				<button class="flex min-w-0 flex-1 flex-col gap-0.5 text-left" onclick={() => lab.focusPin(p.id)}>
					<span class="flex items-center gap-1.5 text-xs">
						<span class="font-medium">Note {p.id}</span>
						{#if p.orphan}<Badge variant="destructive">orphaned</Badge>{/if}
						<span class="truncate text-muted-foreground">{lab.layout && lab.design ? describeAnchor(p, lab.layout, lab.design) : ''}</span>
					</span>
					<span class="text-sm {p.text ? '' : 'text-muted-foreground italic'}">{p.text || 'empty note'}</span>
				</button>
				<Button variant="ghost" size="icon-xs" aria-label="Delete note {p.id}" onclick={() => lab.removePin(p.id)}><Trash /></Button>
			</div>
		{:else}
			<span class="text-sm text-muted-foreground">No notes. Pick the note tool (N) and click the grid; Alt drops a free note.</span>
		{/each}
	</div>
</ScrollArea>
