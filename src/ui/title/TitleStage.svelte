<script lang="ts">
  import type { TitleApi } from './titleApi';

  /** The live backdrop: the real renderer drawing `ship` over the space backdrop. Rebuilt only when the ship template changes. */
  let { api, ship }: { api: TitleApi; ship: string } = $props();
  let canvas: HTMLCanvasElement | undefined = $state();
  $effect(() => {
    if (!canvas) return;
    let stop: (() => void) | undefined;
    let gone = false;
    void api.stage(canvas, ship).then((s) => (gone ? s.dispose() : (stop = () => s.dispose())));
    return () => {
      gone = true;
      stop?.();
    };
  });
</script>

<canvas bind:this={canvas} data-testid="title-stage"></canvas>

<style>
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
</style>
