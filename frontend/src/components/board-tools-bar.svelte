<script lang="ts">
  // Issue #27: the floating "board tools" bar at the TOP of the screen, mirroring
  // the canvas-tools bar at the bottom. Holds viewport controls: a live zoom
  // indicator (click to reset to 100%), frame-all, frame-selection, and
  // recenter-to-origin. All operations are local-camera only (see board_tools).
  import { appState } from "../global.svelte";
  import * as BoardTools from "../board_tools.svelte";
  import { boardToolsState } from "../board_tools.svelte";

  // Use mousedown (not click) and swallow the event so the canvas background
  // listener underneath never starts a selection-box drag from a bar click —
  // matching the bottom toolbar's behaviour.
  const action = (fn: () => void) => (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  const hasSelection = $derived(appState.selectedObjects.length > 0);
</script>

<div
  id="board-tools-wrapper"
  class="absolute left-0 top-0 w-screen flex flex-row justify-center items-center pointer-events-none"
>
  <div
    class="p-2 mt-4 rounded-full flex flex-row items-center space-x-2 bg-slate-600 pointer-events-none"
  >
    <!-- zoom level indicator — click to reset zoom to 100% -->
    <button
      onmousedown={action(BoardTools.resetZoom)}
      title="Reset zoom to 100%"
      class="board-tools-button min-w-[3.75rem] px-3 py-2 rounded-full bg-slate-400 hover:bg-slate-300 hover:scale-110 active:scale-95 pointer-events-auto text-sm font-semibold text-slate-800 tabular-nums text-center"
    >
      {boardToolsState.zoomPercent}%
    </button>

    <!-- frame all objects (zoom to fit) -->
    <button
      onmousedown={action(BoardTools.frameAllObjects)}
      title="Zoom to fit all (F)"
      aria-label="Zoom to fit all objects"
      class="board-tools-button p-2 rounded-full bg-slate-400 hover:bg-slate-300 hover:scale-110 active:scale-95 pointer-events-auto text-slate-800"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        fill="currentColor"
        viewBox="0 0 16 16"
      >
        <path
          fill-rule="evenodd"
          d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707zm4.344 0a.5.5 0 0 1 .707 0l4.096 4.096V11.5a.5.5 0 1 1 1 0v3.975a.5.5 0 0 1-.5.5H11.5a.5.5 0 0 1 0-1h2.768l-4.096-4.096a.5.5 0 0 1 0-.707zm0-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707zm-4.344 0a.5.5 0 0 1-.707 0L1.025 1.732V4.5a.5.5 0 0 1-1 0V.525a.5.5 0 0 1 .5-.5H4.5a.5.5 0 0 1 0 1H1.732l4.096 4.096a.5.5 0 0 1 0 .707z"
        />
      </svg>
    </button>

    <!-- frame current selection (disabled when nothing is selected) -->
    <button
      onmousedown={action(BoardTools.frameSelection)}
      disabled={!hasSelection}
      title="Zoom to selection (Shift+F)"
      aria-label="Zoom to selection"
      class="board-tools-button p-2 rounded-full bg-slate-400 hover:bg-slate-300 hover:scale-110 active:scale-95 pointer-events-auto text-slate-800 disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-slate-400 disabled:cursor-not-allowed"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
      >
        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke-dasharray="2 2" />
        <rect x="5" y="5" width="6" height="6" rx="1" fill="currentColor" stroke="none" />
      </svg>
    </button>

    <!-- recenter viewport to canvas origin (0,0) -->
    <button
      onmousedown={action(BoardTools.recenterToOrigin)}
      title="Recenter to origin (Home)"
      aria-label="Recenter viewport to origin"
      class="board-tools-button p-2 rounded-full bg-slate-400 hover:bg-slate-300 hover:scale-110 active:scale-95 pointer-events-auto text-slate-800"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
      >
        <circle cx="8" cy="8" r="4" />
        <line x1="8" y1="0.5" x2="8" y2="3" />
        <line x1="8" y1="13" x2="8" y2="15.5" />
        <line x1="0.5" y1="8" x2="3" y2="8" />
        <line x1="13" y1="8" x2="15.5" y2="8" />
        <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    </button>
  </div>
</div>
