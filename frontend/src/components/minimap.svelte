<script lang="ts">
  // Issue #29: the minimap / corner overview, bottom-right. The drawing + camera
  // math lives in the minimap module; this component just owns the <canvas>, the
  // rAF lifecycle, and translating pointer drags into "jump the camera there".
  import { onMount } from "svelte";
  import * as Minimap from "../minimap.svelte";
  import { minimapState, MINIMAP_W, MINIMAP_H } from "../minimap.svelte";

  let canvasEl = $state<HTMLCanvasElement | undefined>(undefined);
  let dragging = $state(false);

  onMount(() => {
    Minimap.startMinimap();
    return () => Minimap.stopMinimap();
  });

  // Bind/unbind the canvas as the panel shows/hides on an empty board, so the
  // module always has a live context (or knows it has none).
  $effect(() => {
    if (minimapState.hasObjects && canvasEl) {
      Minimap.bindCanvas(canvasEl);
      return () => Minimap.unbindCanvas();
    }
  });

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
  <div
    id="minimap-wrapper"
    class="absolute right-0 bottom-0 m-3 rounded-lg overflow-hidden bg-slate-700/80 backdrop-blur shadow-lg ring-1 ring-black/20 pointer-events-auto"
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
  </div>
{/if}
