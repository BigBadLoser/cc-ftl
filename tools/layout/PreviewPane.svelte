<script lang="ts">
	import { onWheel } from './attach';
	import { onDestroy, onMount } from 'svelte';
	import { panned, percentOf, previewView, zoomed, type Box } from './camera';
	import { lab, dpr } from './lab.svelte';
	import { preview } from './previewHost';
	import { targetAt, tilesOf } from './design';
	import PinMarkers from './PinMarkers.svelte';

	let slot: HTMLDivElement;
	let box = $state<Box>({ w: 400, h: 300 });
	let drag: { x: number; y: number; moved: boolean } | null = null;

	onMount(() => {
		// The preview's canvas outlives its pane (docking remounts panes), so its element is moved in, not rendered.
		// eslint-disable-next-line svelte/no-dom-manipulating
		slot.appendChild(preview.host);
		preview.pause(false);
		const ro = new ResizeObserver(() => {
			box = { w: slot.clientWidth, h: slot.clientHeight };
			preview.resize();
		});
		ro.observe(slot);
		return () => ro.disconnect();
	});
	onDestroy(() => preview.pause(true));

	// the preview follows the shared view and the design; its marks follow the lists and the grid
	$effect(() => preview.setView(previewView(lab.view, dpr())));
	// An edited design restamps the preview a moment after the last change (the first one at once).
	let built = false;
	$effect(() => {
		const d = lab.previewDesign;
		if (!d) return;
		const t = setTimeout(() => { built = true; void preview.setDesign(d).then(() => preview.setView(previewView(lab.view, dpr()))); }, built ? 60 : 0);
		return () => clearTimeout(t);
	});
	$effect(() => preview.setShields(lab.layers.shields));
	$effect(() => preview.setRoof(lab.layers.roof));
	$effect(() => {
		const d = lab.previewDesign;
		preview.setMarks(d ? [{ tiles: tilesOf(d, lab.selected), tint: 0xffc440, solid: true }, { tiles: lab.showsHover ? tilesOf(d, lab.hover) : [], tint: 0x50dcff }, { tiles: lab.flag, tint: 0xff4646, solid: true }] : []);
	});

	const local = (e: MouseEvent) => {
		const r = slot.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	};
	function pick(e: MouseEvent) {
		const d = lab.previewDesign;
		if (!d) return null;
		const p = local(e);
		const hit = preview.pick(p.x, p.y);
		if (!hit) return null;
		// the pick is on the design the preview shows (the original on the Generated tab): by stable id into the edited one
		return lab.toEdited(hit.module !== null ? (d.modules[hit.module] ? ({ kind: 'module', id: (d.modules[hit.module] as { id: number }).id } as const) : null) : targetAt(d, hit.x, hit.y));
	}
	function down(e: PointerEvent) {
		slot.setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY, moved: false };
	}
	function move(e: PointerEvent) {
		if (drag) {
			const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
			if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
			if (drag.moved) {
				lab.view = { ...panned('iso', previewView(lab.view, dpr()), dpr(), dx, dy), zoom: lab.view.zoom }; // the shared zoom stays a grid step
				drag.x = e.clientX;
				drag.y = e.clientY;
			}
			return;
		}
		lab.setHover(pick(e));
	}
	function up(e: PointerEvent) {
		if (drag && !drag.moved) lab.select(pick(e));
		drag = null;
	}
	function wheel(e: WheelEvent) {
		e.preventDefault();
		const p = local(e);
		lab.view = zoomed('iso', lab.view, dpr(), box, p.x, p.y, -e.deltaY);
	}
</script>

<div class="relative size-full">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={slot}
		class="size-full cursor-grab touch-none bg-black active:cursor-grabbing"
		{@attach onWheel(wheel)}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointerleave={() => lab.setHover(null)}
	></div>
	<PinMarkers space="iso" {box} />
	<div class="pointer-events-none absolute right-3 bottom-2 text-xs text-white/60 tabular-nums" aria-label="Preview zoom">{percentOf(previewView(lab.view, dpr()).zoom, dpr())}%</div>
</div>
