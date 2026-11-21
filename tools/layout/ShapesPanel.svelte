<script lang="ts">
	import BookmarkPlus from '@lucide/svelte/icons/bookmark-plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { move } from './move.svelte';
	import type { Piece } from './region';
	import { shapes } from './shapes.svelte';
	import ShapeThumb from './ShapeThumb.svelte';

	/** Pick a piece up: it follows the pointer over the grid until a click places it (R / H turn it, Esc drops it). */
	const pick = (p: Piece): void => move.paste(p);
	const held = (p: Piece): boolean => move.float?.source === p;
	const size = (p: Piece): string => `${p.w} x ${p.h}${p.modules.length ? ` · ${p.modules.length} ${p.modules.length === 1 ? 'module' : 'modules'}` : ''}`;
	const focus = (el: HTMLInputElement) => { el.focus(); el.select(); };
	function keys(e: KeyboardEvent, id: number) {
		if (e.key === 'Enter') shapes.rename(id, (e.currentTarget as HTMLInputElement).value);
		else if (e.key === 'Escape') shapes.editing = null;
		e.stopPropagation();
	}
</script>

<ScrollArea class="size-full">
	<div class="flex flex-col gap-2 p-3">
		<div class="flex items-center gap-2">
			<span class="flex-1 text-xs text-muted-foreground">{move.box ? `Box ${move.box.w} x ${move.box.h}` : 'Select a box with Move (S)'}</span>
			<Button variant="outline" size="sm" disabled={!move.box || !!move.float} onclick={() => move.saveShape()} title="Save the Move box as a shape (Ctrl+Shift+C)"><BookmarkPlus /> Save box</Button>
		</div>
		<span class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Clipboard</span>
		{#if move.clip}
			{@const c = move.clip}
			<button class="flex items-center gap-2 rounded-md border border-dashed p-1.5 text-left hover:bg-muted {held(c) ? 'bg-muted ring-1 ring-foreground' : ''}" onclick={() => pick(c)}>
				<ShapeThumb piece={c} />
				<span class="flex min-w-0 flex-col"><span class="truncate text-sm">Clipboard</span><span class="text-xs text-muted-foreground">{size(c)} · Ctrl+V</span></span>
			</button>
		{:else}
			<span class="text-sm text-muted-foreground">Empty. Ctrl+C copies the Move box.</span>
		{/if}
		<span class="mt-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Saved{shapes.list.length ? ` · ${shapes.list.length}` : ''}</span>
		{#each shapes.list as s (s.id)}
			<div class="group flex items-center gap-2 rounded-md p-1.5 hover:bg-muted {held(s.piece) ? 'bg-muted ring-1 ring-foreground' : ''}">
				<button class="shrink-0" onclick={() => pick(s.piece)} aria-label="Place {s.name}"><ShapeThumb piece={s.piece} /></button>
				<div class="flex min-w-0 flex-1 flex-col">
					{#if shapes.editing === s.id}
						<Input class="h-7 text-sm" value={s.name} {@attach focus} onkeydown={(e) => keys(e, s.id)} onblur={(e) => shapes.rename(s.id, e.currentTarget.value)} />
					{:else}
						<button class="truncate text-left text-sm" onclick={() => pick(s.piece)}>{s.name}</button>
					{/if}
					<span class="text-xs text-muted-foreground">{size(s.piece)}</span>
				</div>
				<div class="flex opacity-0 group-hover:opacity-100">
					<Button variant="ghost" size="icon-xs" aria-label="Rename {s.name}" onclick={() => (shapes.editing = s.id)}><Pencil /></Button>
					<Button variant="ghost" size="icon-xs" aria-label="Delete {s.name}" onclick={() => shapes.remove(s.id)}><Trash /></Button>
				</div>
			</div>
		{:else}
			<span class="text-sm text-muted-foreground">No saved shapes. Select a box with Move and press Save box.</span>
		{/each}
	</div>
</ScrollArea>
