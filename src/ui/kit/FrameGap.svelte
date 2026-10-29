<script lang="ts">
  /** A stretch of a frame's top line: fixed width, or `grow` to fill the space. Used between the title and right-hand items of a Frame. */
  let { width = 0, grow = false }: { width?: number; grow?: boolean } = $props();
</script>

<i class="gap" class:grow style:width={grow ? undefined : `${width}px`}></i>

<style>
  .gap {
    display: block;
    flex: none;
    height: var(--frame-w);
    background: var(--edge);
  }
  .gap.grow {
    flex: 1 1 0;
    min-width: 6px;
  }
</style>
