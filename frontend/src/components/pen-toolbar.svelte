<script lang="ts">
  import { appState, dom } from "../global.svelte";
  import { eTool, ePenTool } from "../types";
  import * as Interactions from "../interactions.svelte";

  // The shape button is a single button (showing the currently-chosen shape)
  // plus a caret that opens a little menu to pick a different shape.
  let shapeMenuOpen = $state(false);
  let selectedShape = $state<ePenTool>(ePenTool.square);

  const isShapeTool = (t: ePenTool) =>
    t === ePenTool.square ||
    t === ePenTool.circle ||
    t === ePenTool.triangle ||
    t === ePenTool.line;

  const shapes: { tool: ePenTool; name: string }[] = [
    { tool: ePenTool.square, name: "Square" },
    { tool: ePenTool.circle, name: "Circle" },
    { tool: ePenTool.triangle, name: "Triangle" },
    { tool: ePenTool.line, name: "Line" },
  ];

  const selectPen = (e: Event, tool: ePenTool) => {
    e.preventDefault();
    e.stopPropagation();
    Interactions.setActivePenTool(tool);
    shapeMenuOpen = false;
  };

  const selectShape = (e: Event, shape: ePenTool) => {
    e.preventDefault();
    e.stopPropagation();
    selectedShape = shape;
    Interactions.setActivePenTool(shape);
    shapeMenuOpen = false;
  };

  const toggleShapeMenu = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    shapeMenuOpen = !shapeMenuOpen;
  };

  const colours = [
    { name: "Red", hex: "#ef4444", bg: "bg-red-500" },
    { name: "Green", hex: "#22c55e", bg: "bg-green-500" },
    { name: "Blue", hex: "#3b82f6", bg: "bg-blue-500" },
    { name: "Yellow", hex: "#eab308", bg: "bg-yellow-500" },
    { name: "Fuchsia", hex: "#d946ef", bg: "bg-fuchsia-500" },
    { name: "Brown", hex: "#713f12", bg: "bg-yellow-900" },
    { name: "White", hex: "#ffffff", bg: "bg-white" },
    { name: "Slate", hex: "#64748b", bg: "bg-slate-500" },
    { name: "Black", hex: "#000000", bg: "bg-black" },
  ];

  // Set the current pen colour. New strokes read appState.penColour via the SVG
  // factory; we also tint the live drawing-preview path so the in-progress
  // stroke shows the chosen colour.
  const selectColour = (e: Event, hex: string) => {
    e.preventDefault();
    appState.penColour = hex;
    if (dom?.drawingSvgPath) {
      dom.drawingSvgPath.style.fill = hex;
      // Fill only — a stroke would add a rim (and compound to a dark border for
      // the translucent highlighter). startDrawing re-tints this with the exact
      // drawing colour (incl. highlighter alpha) when a stroke begins.
      dom.drawingSvgPath.style.stroke = "none";
    }
  };
</script>

{#snippet shapeIcon(tool: ePenTool)}
  {#if tool === ePenTool.square}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      fill="currentColor"
      viewBox="0 0 16 16"
    >
      <path
        d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"
      />
    </svg>
  {:else if tool === ePenTool.circle}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      fill="currentColor"
      viewBox="0 0 16 16"
    >
      <path
        d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"
      />
    </svg>
  {:else if tool === ePenTool.triangle}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      fill="currentColor"
      viewBox="0 0 16 16"
    >
      <path
        d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057m1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.439-.989.98-1.767z"
      />
    </svg>
  {:else}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      fill="currentColor"
      viewBox="0 0 16 16"
    >
      <path
        fill-rule="evenodd"
        d="M13.854 2.146a.5.5 0 0 1 0 .708l-11 11a.5.5 0 0 1-.708-.708l11-11a.5.5 0 0 1 .708 0"
      />
    </svg>
  {/if}
{/snippet}

<div
  id="pen-toolbar-wrapper"
  class:hidden={appState.currentTool !== eTool.pencil}
  class="absolute left-0 bottom-16 w-screen flex flex-row justify-center items-center space-x-2 pointer-events-none"
>
  <!-- pen toolbar 1 -->
  <div
    id="pen-toolbar"
    class="p-2 mb-4 rounded-lg flex space-x-2 bg-slate-600 items-center pointer-events-auto"
  >
    <!-- different types of pen -->
    <div class="flex space-x-2 items-center">
      <!-- pen -->
      <button
        aria-label="Pen"
        title="Pen"
        data-is-selected={appState.penCurrentTool === ePenTool.pen
          ? "true"
          : null}
        onmousedown={(e) => selectPen(e, ePenTool.pen)}
        class="w-9 h-9 toolbar-button bg-slate-400 hover:bg-slate-300 rounded-full p-2 data-[is-selected]:bg-rose-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="currentColor"
          class="bi bi-pen"
          viewBox="0 0 16 16"
        >
          <path
            d="m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001m-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057 3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708z"
          />
        </svg>
      </button>

      <!-- highlighter -->
      <button
        aria-label="Highlighter"
        title="Highlighter"
        data-is-selected={appState.penCurrentTool === ePenTool.highlighter
          ? "true"
          : null}
        onmousedown={(e) => selectPen(e, ePenTool.highlighter)}
        class="w-9 h-9 toolbar-button bg-slate-400 hover:bg-slate-300 rounded-full p-2 data-[is-selected]:bg-rose-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="currentColor"
          class="bi bi-highlighter"
          viewBox="0 0 16 16"
        >
          <path
            fill-rule="evenodd"
            d="M11.096.644a2 2 0 0 1 2.791.036l1.433 1.433a2 2 0 0 1 .035 2.791l-.413.435-8.07 8.995a.5.5 0 0 1-.372.166h-3a.5.5 0 0 1-.234-.058l-.412.412A.5.5 0 0 1 2.5 15h-2a.5.5 0 0 1-.354-.854l1.412-1.412A.5.5 0 0 1 1.5 12.5v-3a.5.5 0 0 1 .166-.372l8.995-8.07zm-.115 1.47L2.727 9.52l3.753 3.753 7.406-8.254zm3.585 2.17.064-.068a1 1 0 0 0-.017-1.396L13.18 1.387a1 1 0 0 0-1.396-.018l-.068.065zM5.293 13.5 2.5 10.707v1.586L3.707 13.5z"
          />
        </svg>
      </button>

      <!-- shape (square/circle/triangle/line) with a caret to pick the shape -->
      <div class="relative">
        <button
          aria-label="Shape"
          title={shapes.find((s) => s.tool === selectedShape)?.name ?? "Shape"}
          data-is-selected={isShapeTool(appState.penCurrentTool)
            ? "true"
            : null}
          onmousedown={(e) => selectPen(e, selectedShape)}
          class="w-9 h-9 toolbar-button bg-slate-400 hover:bg-slate-300 rounded-full p-2 data-[is-selected]:bg-rose-500"
        >
          {@render shapeIcon(selectedShape)}
        </button>

        <!-- caret to open the shape submenu -->
        <button
          aria-label="Choose shape"
          title="Choose shape"
          onmousedown={toggleShapeMenu}
          class="absolute -bottom-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-slate-700 text-white hover:bg-slate-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path
              d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"
            />
          </svg>
        </button>

        {#if shapeMenuOpen}
          <div
            class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg bg-slate-700 flex space-x-2 shadow-lg"
          >
            {#each shapes as s (s.tool)}
              <button
                aria-label={s.name}
                title={s.name}
                data-is-selected={appState.penCurrentTool === s.tool
                  ? "true"
                  : null}
                onmousedown={(e) => selectShape(e, s.tool)}
                class="w-9 h-9 toolbar-button bg-slate-400 hover:bg-slate-300 rounded-full p-2 data-[is-selected]:bg-rose-500"
              >
                {@render shapeIcon(s.tool)}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- thickness slider -->
    <div class="flex items-center space-x-2 px-2">
      <span class="w-2 h-2 rounded-full bg-slate-300"></span>
      <input
        type="range"
        min="2"
        max="40"
        step="1"
        aria-label="Pen thickness"
        title="Pen thickness"
        bind:value={appState.penSize}
        class="w-24 cursor-pointer accent-rose-500"
      />
      <span class="w-4 h-4 rounded-full bg-slate-300"></span>
    </div>

    <!-- color selector buttons (2 rows, flowing into columns, to keep the bar short) -->
    <div class="grid grid-rows-2 grid-flow-col gap-2">
      {#each colours as c (c.hex)}
        <button
          aria-label={c.name}
          title={c.name}
          onmousedown={(e) => selectColour(e, c.hex)}
          class={`w-5 h-5 toolbar-button ${c.bg} rounded-full hover:outline hover:outline-white ${
            appState.penColour === c.hex
              ? "outline outline-2 outline-white outline-offset-2"
              : ""
          }`}
        ></button>
      {/each}
    </div>
  </div>

  <!-- pen toolbar 2 -->
</div>
