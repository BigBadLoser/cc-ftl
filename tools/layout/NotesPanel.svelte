<script lang="ts">
	import Trash from '@lucide/svelte/icons/trash-2';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { lab } from './lab.svelte';
	import { describeAnchor } from './pins';
</script>

<ScrollArea class="size-full">
	<div class="flex flex-col gap-1.5 p-3">
		{#each lab.pins as p (p.id)}
			<Card.Root size="sm" class="gap-1 py-2 hover:bg-muted {lab.openPin === p.id ? 'bg-muted' : ''}">
				<Card.Header class="gap-0">
					<Card.Title class="flex min-w-0 items-center gap-1.5 text-xs">
						<button class="font-medium" onclick={() => lab.focusPin(p.id)}>Note {p.id}</button>
						<span class="truncate font-normal text-muted-foreground">{lab.layout && lab.design ? describeAnchor(p, lab.layout, lab.design) : ''}</span>
						{#if p.orphan}<Badge variant="destructive">orphaned</Badge>{/if}
					</Card.Title>
					<Card.Action>
						<Button variant="ghost" size="icon-xs" aria-label="Delete note {p.id}" onclick={() => lab.removePin(p.id)}><Trash /></Button>
					</Card.Action>
				</Card.Header>
				<Card.Content>
					<button class="w-full text-left text-sm {p.text ? '' : 'text-muted-foreground italic'}" onclick={() => lab.focusPin(p.id)}>{p.text || 'empty note'}</button>
				</Card.Content>
			</Card.Root>
		{:else}
			<span class="text-sm text-muted-foreground">No notes. Pick the note tool (N) and click the grid; Alt drops a free note.</span>
		{/each}
	</div>
</ScrollArea>
