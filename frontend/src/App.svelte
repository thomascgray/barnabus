<script lang="ts">
  import { onMount } from "svelte";
  import { appState, dom } from "./global.svelte";
  import Background from "./components/background.svelte";
  import SelectionBox from "./components/selection-box.svelte";
  import Toolbar from "./components/toolbar.svelte";
  import Camera from "./components/camera.svelte";
  import Objects from "./components/objects.svelte";
  import SelectedObjectsWrapper from "./components/selected-objects-wrapper.svelte";
  import * as Interactions from "./interactions.svelte";
  import * as Listeners from "./listeners.svelte";
  import {
    createManyImageElements,
    exportObjects,
    importObjects,
    loadDomIntoMemory,
  } from "./global.svelte";
  import PopoverMenu from "./components/popover-menu.svelte";
  import PenToolbar from "./components/pen-toolbar.svelte";
  import LeftToolbar from "./components/left-toolbar.svelte";
  import ResizerHandle from "./components/resizer-handle.svelte";
  import PresenceStrip from "./components/presence-strip.svelte";
  import ImageUploadModal from "./components/image-upload-modal.svelte";
  import BoardToolsBar from "./components/board-tools-bar.svelte";
  import CanvasBar from "./components/canvas-bar.svelte";
  import Minimap from "./components/minimap.svelte";

  // import testDataSet from "../test_data_sets/1.txt";

  onMount(() => {
    loadDomIntoMemory();

    // App only mounts once connected (Container gates on connectionState), so
    // the connection itself is initiated from the Landing board-picker now.

    // @ts-ignore
    window.exportObjects = exportObjects;

    // import(`../test_data_sets/1.txt?raw`).then((text) => {
    //   importObjects(text.default);
    // });

    // createManyImageElements(100);

    dom.background.addEventListener("mousedown", Listeners.mouse_DOWN);
    dom.background.addEventListener("mousemove", Listeners.mouse_MOVE);
    dom.background.addEventListener("mouseup", Listeners.mouse_UP);
    dom.background.addEventListener("wheel", Listeners.onWheel, {
      passive: false,
    });
    window.addEventListener("keydown", Listeners.key_DOWN);
    window.addEventListener("copy", Listeners.onCopy);
    window.addEventListener("paste", Listeners.onPaste);
    window.addEventListener("dragover", Listeners.onDragOver);
    window.addEventListener("drop", Listeners.onDrop);

    return () => {
      dom.background.removeEventListener("mousedown", Listeners.mouse_DOWN);
      dom.background.removeEventListener("mousemove", Listeners.mouse_MOVE);
      dom.background.removeEventListener("mouseup", Listeners.mouse_UP);
      dom.background.removeEventListener("wheel", Listeners.onWheel);
      window.removeEventListener("keydown", Listeners.key_DOWN);
      window.removeEventListener("copy", Listeners.onCopy);
      window.removeEventListener("paste", Listeners.onPaste);
      window.removeEventListener("dragover", Listeners.onDragOver);
      window.removeEventListener("drop", Listeners.onDrop);

      // @ts-ignore
      window.exportObjects = null;
    };
  });

  // Recompute the native brush cursor whenever the tool or pen settings change.
  // (Zoom is handled imperatively in the wheel handler — camera z isn't reactive
  // state.) Reading these registers them as effect dependencies.
  $effect(() => {
    appState.currentTool;
    appState.penCurrentTool;
    appState.penColour;
    appState.penSize;
    Interactions.updatePenCursor();
  });
</script>

<Background>
  <Camera>
    <Objects />
    <SelectionBox />
    <SelectedObjectsWrapper />

    <ResizerHandle
      id="selectedItemsResizeHandleMR"
      cursorClass="cursor-ew-resize"
    />
    <ResizerHandle
      id="selectedItemsResizeHandleBR"
      cursorClass="cursor-nwse-resize"
    />
  </Camera>
</Background>

<!-- measuring things -->
<!-- <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"> -->
<svg
  class="left-0 top-0 z-[9999999999] overflow-visible pointer-events-none"
  class:absolute={appState.currentMeasuringPoint !== null}
  class:hidden={appState.currentMeasuringPoint === null}
  height={window.innerHeight}
  width={window.innerWidth}
>
  <line
    x1={appState.startMeasuringPoint?.x || 0}
    y1={appState.startMeasuringPoint?.y || 0}
    x2={appState.currentMeasuringPoint?.x || 0}
    y2={appState.currentMeasuringPoint?.y || 0}
    stroke="#e74c3c"
    fill="#e74c3c"
    width="6"
    stroke-width="6"
    stroke-linecap="round"
    style="opacity: 0.7; pointer-events: none"
  />
</svg>

<p
  class:absolute={appState.currentMeasuringPoint !== null}
  class:hidden={appState.currentMeasuringPoint === null}
  id="measuring-line-label"
  class="absolute top-0 left-0 z-[9999999999] pointer-events-none origin-top-left text-white font-bold bg-red-400/60 rounded-full px-2 py-1 text-center"
>
  hello
</p>

<!-- </svg> -->

<!-- the drawing svg -->
<!-- will-change + contain isolate this overlay onto its own compositor layer so
     the per-mousemove path `d` rewrites during freehand drawing repaint only the
     overlay, not the ~1000-object scene beneath it (issue #21). z-index sits
     above #camera but below the measuring overlay/toolbars. Do NOT add
     `contain: size` — the SVG must keep its class-based w-screen/h-screen size. -->
<svg
  class="absolute top-0 left-0 pointer-events-none w-screen h-screen"
  id="drawingSvg"
  style="will-change: transform; contain: layout paint; z-index: 9999;"
>
  <path style="fill: black" id="drawingSvgPath" d="" />
</svg>

<!-- the drawing template -->
<svg class="absolute top-0 left-0 pointer-events-none" id="drawingSvgTemplate">
  <path class="pointer-events-auto" style="fill: black" d="" />
</svg>

<PresenceStrip />

<Toolbar />

<!-- Centred top bar: the canvas switcher sits immediately left of the camera /
     zoom controls. The container is click-through (pointer-events-none); each bar
     re-enables pointer events on its own interactive chrome. -->
<div
  class="absolute left-0 top-0 w-screen mt-4 flex flex-row justify-center items-center gap-2 pointer-events-none"
>
  <CanvasBar />
  <BoardToolsBar />
</div>

<Minimap />
<LeftToolbar />

<PenToolbar />
<PopoverMenu />
<ImageUploadModal />

<dialog
  id="dialog-object-image"
  class="w-[50%] h-[50%] p-4 relative nice-shadow"
></dialog>
