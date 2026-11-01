<script lang="ts">
  import type { TitleApi } from './titleApi';

  /**
   * The live backdrop: the real renderer drawing `ship` over the space backdrop, rebuilt when the ship template changes.
   * Each build gets a new canvas: a disposed renderer loses its WebGL context, and a new one on the same canvas would get
   * that lost context (pixi then fails compiling shaders: the "null.split" error).
   */
  let { api, ship }: { api: TitleApi; ship: string } = $props();
  import { liftBootVeil } from '../bootVeil';
  /** Only the first stage (arriving at the menu) lifts the boot veil; ship switches on the menu and the ship picker are not. */
  let first = true;

  function stage(canvas: HTMLCanvasElement, of: string) {
    let stop: (() => void) | undefined;
    let gone = false;
    const veiled = first;
    first = false;
    const wait = new Promise<void>((done) => {
      api.stage(canvas, of).then(
        (s) => {
          if (gone) s.dispose();
          else stop = () => s.dispose();
          void s.ready.then(done, done);
        },
        () => done(),
      );
    });
    if (veiled) liftBootVeil(wait);
    return {
      destroy() {
        gone = true;
        stop?.();
      },
    };
  }
</script>

{#key ship}<canvas use:stage={ship} data-testid="title-stage"></canvas>{/key}

<style>
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
</style>
