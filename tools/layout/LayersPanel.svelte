<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { keyOf, LAYER_LABELS, type Layers } from './gridDraw';
	import { lab } from './lab.svelte';

	const extras = $derived(lab.design ? keyOf(lab.design).extras : []);
	const names = Object.keys(LAYER_LABELS) as (keyof Layers)[];
</script>

<ScrollArea class="size-full">
	<div class="flex flex-col gap-3 p-3">
		<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Layers</span>
		{#each names as n (n)}
			<div class="flex items-center justify-between">
				<Label for="layer-{n}">{LAYER_LABELS[n]}</Label>
				<Switch id="layer-{n}" size="sm" checked={lab.layers[n]} onCheckedChange={(v) => (lab.layers[n] = v)} />
			</div>
		{/each}
		<Separator />
		<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Key</span>
		<!-- Room colours and furniture codes are the palette's lists; this is what else the grid draws. -->
		<div class="flex flex-col gap-1">
			{#each extras as e (e.name)}
				<div class="flex items-center gap-2 text-sm">
					<span class="flex size-3 shrink-0 items-center justify-center rounded-sm" style="background:{e.color}">{#if e.dot}<span class="size-1 rounded-full bg-yellow-300"></span>{/if}</span>{e.name}
				</div>
			{/each}
		</div>
	</div>
</ScrollArea>
