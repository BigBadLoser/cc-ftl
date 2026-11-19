<script lang="ts">
	import { TILE_H } from '../../src/render/iso';
	import { designFromLayout } from './design';
	import { DEFAULT_LAYERS, drawGrid } from './gridDraw';
	import { dpr } from './lab.svelte';
	import type { Piece } from './region';
	import { pieceLayout } from './shapes';

	/** A piece drawn with the grid's own drawing, fitted to a small box. */
	let { piece, w = 72, h = 54 }: { piece: Piece; w?: number; h?: number } = $props();
	let canvas: HTMLCanvasElement;
	$effect(() => {
		const r = dpr(), cw = Math.round(w * r), ch = Math.round(h * r);
		canvas.width = cw;
		canvas.height = ch;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const l = pieceLayout(piece);
		const s = Math.min(cw / l.width, ch / l.height);
		const view = { cx: (l.width - 1) / 2, cy: (l.height - 1) / 2, zoom: s / TILE_H };
		drawGrid(ctx, designFromLayout(l, 'shape'), view, 1, { w: cw, h: ch }, { ...DEFAULT_LAYERS, names: false }, []);
	});
</script>

<canvas bind:this={canvas} class="shrink-0 rounded-sm bg-background" style="width:{w}px;height:{h}px"></canvas>
