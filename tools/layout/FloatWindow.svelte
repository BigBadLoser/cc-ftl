<script lang="ts">
	import type { Snippet } from 'svelte';
	import { clampRect, MIN_RECT, type PanelId, type Rect } from './dock';
	import { docks } from './dock.svelte';
	import PanelFrame from './PanelFrame.svelte';

	let { id, children, bounds }: { id: PanelId; children: Snippet; bounds: { w: number; h: number } } = $props();
	const p = $derived(docks.state.panels[id]);
	let live = $state<Rect | null>(null);
	const rect = $derived(live ?? p.rect);
	const TITLE_H = 33;

	/** Drag handler shared by the title bar (move) and the corner (resize): a pointer-captured gesture on a copy of the rect. */
	function gesture(kind: 'move' | 'size') {
		return (e: PointerEvent) => {
			if (e.button !== 0) return;
			e.preventDefault();
			const el = e.currentTarget as HTMLElement;
			el.setPointerCapture(e.pointerId);
			const start = { ...p.rect }, ox = e.clientX, oy = e.clientY;
			const next = (ev: PointerEvent): Rect => {
				const dx = ev.clientX - ox, dy = ev.clientY - oy;
				if (kind === 'move') return clampRect({ ...start, x: Math.min(Math.max(0, start.x + dx), Math.max(0, bounds.w - 80)), y: Math.min(Math.max(0, start.y + dy), Math.max(0, bounds.h - TITLE_H)) });
				return clampRect({ ...start, w: Math.min(start.w + dx, bounds.w - start.x), h: Math.min(start.h + dy, bounds.h - start.y) });
			};
			const move = (ev: PointerEvent) => (live = next(ev));
			const up = (ev: PointerEvent) => {
				el.removeEventListener('pointermove', move);
				el.removeEventListener('pointerup', up);
				live = null;
				docks.dispatch({ type: 'rect', id, rect: next(ev) });
			};
			el.addEventListener('pointermove', move);
			el.addEventListener('pointerup', up);
		};
	}
</script>

<div
	class="absolute z-20 flex flex-col overflow-hidden rounded-lg border bg-card shadow-2xl ring-1 ring-foreground/10"
	style="left:{rect.x}px;top:{rect.y}px;width:{rect.w}px;height:{p.collapsed ? TITLE_H : rect.h}px;min-width:{MIN_RECT.w}px"
>
	<PanelFrame {id} drag={gesture('move')}>{@render children()}</PanelFrame>
	{#if !p.collapsed}
		<div class="absolute right-0 bottom-0 z-10 size-4 cursor-nwse-resize touch-none" role="separator" aria-label="Resize" onpointerdown={gesture('size')}></div>
	{/if}
</div>
