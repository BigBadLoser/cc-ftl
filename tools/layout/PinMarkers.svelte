<script lang="ts">
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { previewView, toScreen, type Box, type Space } from './camera';
	import { dpr, lab } from './lab.svelte';
	import { describeAnchor } from './pins';

	/** The pins as markers over a pane: the grid's edit them in a popover, the preview's pick them (centring both panes). */
	let { space, box }: { space: Space; box: Box } = $props();
	const view = $derived(space === 'iso' ? previewView(lab.view, dpr()) : lab.view);
	const spots = $derived(lab.pins.map((p) => ({ p, ...toScreen(space, view, dpr(), box, p.x, p.y) })).filter((s) => s.x > -20 && s.y > -20 && s.x < box.w + 20 && s.y < box.h + 20));
	const tone = (orphan: boolean, open: boolean): string => (orphan ? 'text-destructive' : open ? 'text-primary' : 'text-amber-400');
</script>

<div class="pointer-events-none absolute inset-0 overflow-hidden">
	{#each spots as { p, x, y } (p.id)}
		<div class="pointer-events-auto absolute -translate-x-1/2 -translate-y-full" style="left:{x}px;top:{y}px">
			{#if space === 'grid'}
				<Popover.Root open={lab.openPin === p.id} onOpenChange={(o) => { if (o) lab.openPin = p.id; else if (lab.openPin === p.id) lab.openPin = null; }}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<button {...props} aria-label="Note {p.id}" class="block {tone(p.orphan, lab.openPin === p.id)}" oncontextmenu={(e) => { e.preventDefault(); if (lab.tool === 'note') lab.removePin(p.id); }}><MapPin class="size-6 fill-current stroke-black" /></button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content class="w-72">
						<Textarea value={p.text} placeholder="What is wrong, or what it should be" rows={4} oninput={(e) => lab.setPinText(p.id, e.currentTarget.value)} />
						<div class="flex items-center justify-between gap-2">
							<span class="truncate text-xs text-muted-foreground">{lab.layout && lab.design ? describeAnchor(p, lab.layout, lab.design) : ''}</span>
							<Button variant="ghost" size="icon-xs" aria-label="Delete note" onclick={() => lab.removePin(p.id)}><Trash /></Button>
						</div>
					</Popover.Content>
				</Popover.Root>
			{:else}
				<button aria-label="Note {p.id}" title={p.text || 'Note'} class="block {tone(p.orphan, lab.openPin === p.id)}" onclick={() => lab.focusPin(p.id)}><MapPin class="size-6 fill-current stroke-black" /></button>
			{/if}
		</div>
	{/each}
</div>
