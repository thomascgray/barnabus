<script lang="ts">
  import { appState } from "../global.svelte";
  import type { Snippet } from "svelte";
  import type { eTool } from "../types";

  const { tool, children, onAction } : {
    tool: eTool;
    children: Snippet;
    onAction: () => void;
  } = $props();

  const onmousedown = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    onAction();
  }
</script>

<button
  {onmousedown}
  data-is-selected={appState.currentTool === tool ? 'true' : null}
  class="toolbar-button bg-slate-400 hover:bg-slate-300 rounded-full p-2 data-[is-selected]:bg-rose-500 hover:scale-110 active:scale-95 pointer-events-auto"
>{@render children()}</button>
