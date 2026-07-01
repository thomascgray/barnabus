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

  // Click-to-type an exact zoom %. The indicator swaps to a text input; Enter
  // commits (clamped to the camera-z range in setZoomPercent), Escape cancels,
  // blur commits. A non-numeric value is rejected and falls back to the current
  // zoom (the indicator just re-shows it).
  let isEditingZoom = $state(false);
  let zoomInput = $state("");

  const startEditingZoom = () => {
    zoomInput = String(boardToolsState.zoomPercent);
    isEditingZoom = true;
  };

  const commitZoom = () => {
    if (!isEditingZoom) return;
    isEditingZoom = false;
    const parsed = parseFloat(zoomInput);
    if (Number.isFinite(parsed)) {
      BoardTools.setZoomPercent(parsed);
    }
  };

  const cancelEditingZoom = () => {
    isEditingZoom = false;
  };

  // Stop canvas keyboard shortcuts (Listeners.key_DOWN on window) from firing
  // while typing into the zoom field; handle our own Enter/Escape.
  const onZoomKeydown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitZoom();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditingZoom();
    }
  };

  // Focus + select the input as soon as it renders.
  const autofocus = (node: HTMLInputElement) => {
    node.focus();
    node.select();
  };
</script>

<!-- Positioned by the shared centred top-bar container in App.svelte, next to the
     canvas switcher — so this is just the pill itself now. -->
<div
  id="board-tools-wrapper"
  class="p-2 rounded-full flex flex-row items-center space-x-2 bg-slate-600 pointer-events-none"
>
    <!-- zoom step out (-) -->
    <button
      onmousedown={action(BoardTools.zoomOut)}
      title="Zoom out (-)"
      aria-label="Zoom out"
      class="board-tools-button w-8 h-8 flex items-center justify-center rounded-full bg-slate-400 hover:bg-slate-300 hover:scale-110 active:scale-95 pointer-events-auto text-slate-800 text-lg font-semibold leading-none"
    >
      &minus;
    </button>

    <!-- zoom level indicator — click to type an exact zoom % -->
    {#if isEditingZoom}
      <div
        class="min-w-[3.75rem] px-2 py-2 rounded-full bg-slate-200 flex items-center pointer-events-auto"
      >
        <input
          use:autofocus
          bind:value={zoomInput}
          onkeydown={onZoomKeydown}
          onblur={commitZoom}
          inputmode="numeric"
          class="w-10 bg-transparent text-sm font-semibold text-slate-800 tabular-nums text-right outline-none"
        />
        <span class="text-sm font-semibold text-slate-800">%</span>
      </div>
    {:else}
      <button
        onmousedown={action(startEditingZoom)}
        title="Click to set an exact zoom %"
        class="board-tools-button min-w-[3.75rem] px-3 py-2 rounded-full bg-slate-400 hover:bg-slate-300 hover:scale-110 active:scale-95 pointer-events-auto text-sm font-semibold text-slate-800 tabular-nums text-center"
      >
        {boardToolsState.zoomPercent}%
      </button>
    {/if}

    <!-- zoom step in (+) -->
    <button
      onmousedown={action(BoardTools.zoomIn)}
      title="Zoom in (+)"
      aria-label="Zoom in"
      class="board-tools-button w-8 h-8 flex items-center justify-center rounded-full bg-slate-400 hover:bg-slate-300 hover:scale-110 active:scale-95 pointer-events-auto text-slate-800 text-lg font-semibold leading-none"
    >
      +
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
