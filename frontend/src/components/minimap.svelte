<script lang="ts">
  // Issue #29: the minimap / corner overview, bottom-right. The drawing + camera
  // math lives in the minimap module; this component just owns the <canvas>, the
  // rAF lifecycle, and translating pointer drags into "jump the camera there".
  //
  // Issue #35: the panel can be collapsed — the hide button shrinks it to a small
  // floating circle button in the same corner, which reopens it on click. The
  // collapsed choice persists per-browser (see minimap.svelte.ts).
  import { onMount } from "svelte";
  import * as Minimap from "../minimap.svelte";
  import {
    minimapState,
    setMinimapCollapsed,
    MINIMAP_W,
    MINIMAP_H,
  } from "../minimap.svelte";
  import MapIcon from "@lucide/svelte/icons/map";
  import XIcon from "@lucide/svelte/icons/x";

  let canvasEl = $state<HTMLCanvasElement | undefined>(undefined);
  let dragging = $state(false);

  onMount(() => {
    Minimap.startMinimap();
    return () => Minimap.stopMinimap();
  });

  // Bind/unbind the canvas as the panel shows/hides (empty board, or collapsed),
  // so the module always has a live context (or knows it has none).
  $effect(() => {
    if (minimapState.hasObjects && canvasEl) {
      Minimap.bindCanvas(canvasEl);
      return () => Minimap.unbindCanvas();
    }
  });

  // Use mousedown and swallow the event so the canvas background listener
  // underneath never starts a selection-box drag from a button click — matching
  // the toolbars' behaviour.
  const action = (fn: () => void) => (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  const jumpToEvent = (e: PointerEvent) => {
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    Minimap.jumpFromMinimapPoint(e.clientX - rect.left, e.clientY - rect.top);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!canvasEl) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    canvasEl.setPointerCapture(e.pointerId);
    jumpToEvent(e);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    jumpToEvent(e);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging || !canvasEl) return;
    dragging = false;
    canvasEl.releasePointerCapture(e.pointerId);
  };
</script>

{#if minimapState.hasObjects}
  {#if minimapState.collapsed}
    <!-- collapsed: a single floating circle in the minimap's corner that reopens it -->
    <button
      id="minimap-reopen"
      onmousedown={action(() => setMinimapCollapsed(false))}
      title="Show minimap"
      aria-label="Show minimap"
      class="absolute right-0 bottom-0 m-3 w-10 h-10 flex items-center justify-center rounded-full bg-slate-700/80 backdrop-blur-sm shadow-lg ring-1 ring-black/20 text-slate-200 hover:bg-slate-600 hover:scale-110 active:scale-95 pointer-events-auto"
    >
      <MapIcon class="size-[18px]" />
    </button>
  {:else}
    <div
      id="minimap-wrapper"
      class="absolute right-0 bottom-0 m-3 rounded-lg overflow-hidden bg-slate-700/80 backdrop-blur-sm shadow-lg ring-1 ring-black/20 pointer-events-auto"
      style="width: {MINIMAP_W}px; height: {MINIMAP_H}px;"
      title="Minimap — click or drag to jump the camera"
    >
      <canvas
        bind:this={canvasEl}
        class="block cursor-pointer"
        class:cursor-grabbing={dragging}
        style="width: {MINIMAP_W}px; height: {MINIMAP_H}px;"
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
      ></canvas>
      <!-- hide CTA, top-right of the panel (sits above the canvas, so a click
           here never jumps the camera) -->
      <button
        id="minimap-hide"
        onmousedown={action(() => setMinimapCollapsed(true))}
        onpointerdown={(e) => e.stopPropagation()}
        title="Hide minimap"
        aria-label="Hide minimap"
        class="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-slate-800/70 text-slate-300 hover:bg-slate-600 hover:text-white active:scale-95"
      >
        <XIcon class="size-3" />
      </button>
    </div>
  {/if}
{/if}
