<script lang="ts">
	import { onWheel } from './attach';
	import { panned, toTile, zoomed, type Box } from './camera';
	import { targetAt, tilesOf } from './design';
	import { drawGrid, type Mark } from './gridDraw';
	import { dpr, lab } from './lab.svelte';

	let canvas: HTMLCanvasElement;
	let box = $state<Box>({ w: 800, h: 500 });
	let drag: { x: number; y: number; moved: boolean } | null = null;

	const marks = $derived.by((): Mark[] => {
		const d = lab.design;
		if (!d) return [];
		return [
			{ tiles: tilesOf(d, lab.selected), color: 'rgba(255,196,64,1)' },
			{ tiles: tilesOf(d, lab.hover), color: 'rgba(80,220,255,1)' },
		];
	});

	$effect(() => {
		const d = lab.design;
		const r = dpr();
		canvas.width = Math.max(1, Math.round(box.w * r));
		canvas.height = Math.max(1, Math.round(box.h * r));
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(r, 0, 0, r, 0, 0);
		if (!d) { ctx.clearRect(0, 0, box.w, box.h); return; }
		drawGrid(ctx, d, lab.view, r, box, lab.layers, marks);
	});

	const observe = (el: HTMLElement) => {
		const ro = new ResizeObserver(() => {
			const first = !lab.sized;
			lab.sized = true;
			box = { w: el.clientWidth, h: el.clientHeight };
			lab.gridBox = box;
			if (first) lab.fit();
		});
		ro.observe(el);
		return () => ro.disconnect();
	};

	const local = (e: MouseEvent): { x: number; y: number } => {
		const r = canvas.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	};
	function pick(e: MouseEvent) {
		const d = lab.design;
		if (!d) return null;
		const p = local(e);
		const t = toTile('grid', lab.view, dpr(), box, p.x, p.y);
		return targetAt(d, Math.round(t.x), Math.round(t.y));
	}
	function down(e: PointerEvent) {
		canvas.setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY, moved: false };
	}
	function move(e: PointerEvent) {
		if (drag) {
			const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
			if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
			if (drag.moved) {
				lab.view = panned('grid', lab.view, dpr(), dx, dy);
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
		lab.view = zoomed('grid', lab.view, dpr(), box, p.x, p.y, -e.deltaY);
	}
</script>

<div class="relative size-full bg-background" {@attach observe}>
	<canvas
		bind:this={canvas}
		class="block size-full cursor-crosshair touch-none"
		{@attach onWheel(wheel)}
		style="width:{box.w}px;height:{box.h}px"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointerleave={() => lab.setHover(null)}
	></canvas>
	<div class="pointer-events-none absolute top-2 left-3 text-xs tracking-wide text-muted-foreground uppercase">Grid{lab.design ? ` · ${lab.design.label}` : ''}</div>
</div>
