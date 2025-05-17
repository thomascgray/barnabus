<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import { dom } from '../global.svelte'
    const {
    children
  } : {
    children: Snippet;
  } = $props();

</script>

<div
  id="background"
  draggable="false"
  class="w-screen h-screen cursor-auto touch-none overflow-clip"
>
{@render children()}
</div>
