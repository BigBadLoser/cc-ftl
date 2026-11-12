<script lang="ts">
  import type { UiApi } from './api';
  import FloatingWindow from './FloatingWindow.svelte';
  import { centerTop } from './floatingWindow';
  import JobsBoard from './JobsBoard.svelte';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
</script>

<FloatingWindow id="jobs" title="Jobs" icon="list" min={{ w: 340, h: 160 }} defaultRect={(b) => centerTop(b, 560)} {onClose} testId="jobs-panel" closeTestId="jobs-close" padded>
  <JobsBoard {api} />
</FloatingWindow>
