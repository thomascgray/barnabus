<script lang="ts">
  import type { Snippet } from "svelte";

  const {
    children,
  }: {
    children: Snippet;
  } = $props();
</script>

<div
  id="camera"
  class="w-screen h-screen origin-top-left select-none"
  data-x="0"
  data-y="0"
  data-z="1"
  draggable="false"
  style="transform: scale(1) translate(0px, 0px)"
>
    {@render children()}
</div>
