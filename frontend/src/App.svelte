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
  import "./ConnectionManager.svelte";

  // import testDataSet from "../test_data_sets/1.txt";

  onMount(() => {
    loadDomIntoMemory();

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
    window.addEventListener("paste", Listeners.onPaste);

    return () => {
      dom.background.removeEventListener("mousedown", Listeners.mouse_DOWN);
      dom.background.removeEventListener("mousemove", Listeners.mouse_MOVE);
      dom.background.removeEventListener("mouseup", Listeners.mouse_UP);
      dom.background.removeEventListener("wheel", Listeners.onWheel);
      window.removeEventListener("keydown", Listeners.key_DOWN);
      window.removeEventListener("paste", Listeners.onPaste);

      // @ts-ignore
      window.exportObjects = null;
    };
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
<svg
  class="absolute top-0 left-0 pointer-events-none w-screen h-screen"
  id="drawingSvg"
>
  <path style="fill: black" id="drawingSvgPath" d="" />
</svg>

<!-- the drawing template -->
<svg class="absolute top-0 left-0 pointer-events-none" id="drawingSvgTemplate">
  <path class="pointer-events-auto" style="fill: black" d="" />
</svg>

<Toolbar />
<LeftToolbar />

<PenToolbar />
<PopoverMenu />

<dialog
  id="dialog-object-image"
  class="w-[50%] h-[50%] p-4 relative nice-shadow"
></dialog>
