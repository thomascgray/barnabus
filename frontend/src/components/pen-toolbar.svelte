<script lang="ts">
  import { appState } from "../global.svelte";
  import { eTool } from "../types";
  // import { classnames } from "classnames";
  const onMouseDownToolbarButton = (e: Event, id: string) => {
    //   e.preventDefault();
    //   e.stopPropagation();
    //   const button = document.getElementById(id)!;
    //   for (let btn of dom.toolbarButtons) {
    //     delete (btn as HTMLElement).dataset.isSelected;
    //   }
  };

  const onMouseDownColourSelector = (e: Event, id: string) => {};
</script>

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
    <div class="grid grid-cols-3 gap-2">
      <!-- pen -->
      <button
        aria-label="Pen"
        title="Pen"
        data-is-selected
        onmousedown={(e) => onMouseDownToolbarButton(e, "cursor")}
        id="btn-cursor"
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

      <!-- brush -->
      <button
        aria-label="Brush"
        title="Brush"
        id="btn-hand"
        class="w-9 h-9 toolbar-button bg-slate-400 hover:bg-slate-300 rounded-full p-2 data-[is-selected]:bg-rose-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="currentColor"
          class="bi bi-brush"
          viewBox="0 0 16 16"
        >
          <path
            d="M15.825.12a.5.5 0 0 1 .132.584c-1.53 3.43-4.743 8.17-7.095 10.64a6.1 6.1 0 0 1-2.373 1.534c-.018.227-.06.538-.16.868-.201.659-.667 1.479-1.708 1.74a8.1 8.1 0 0 1-3.078.132 4 4 0 0 1-.562-.135 1.4 1.4 0 0 1-.466-.247.7.7 0 0 1-.204-.288.62.62 0 0 1 .004-.443c.095-.245.316-.38.461-.452.394-.197.625-.453.867-.826.095-.144.184-.297.287-.472l.117-.198c.151-.255.326-.54.546-.848.528-.739 1.201-.925 1.746-.896q.19.012.348.048c.062-.172.142-.38.238-.608.261-.619.658-1.419 1.187-2.069 2.176-2.67 6.18-6.206 9.117-8.104a.5.5 0 0 1 .596.04M4.705 11.912a1.2 1.2 0 0 0-.419-.1c-.246-.013-.573.05-.879.479-.197.275-.355.532-.5.777l-.105.177c-.106.181-.213.362-.32.528a3.4 3.4 0 0 1-.76.861c.69.112 1.736.111 2.657-.12.559-.139.843-.569.993-1.06a3 3 0 0 0 .126-.75zm1.44.026c.12-.04.277-.1.458-.183a5.1 5.1 0 0 0 1.535-1.1c1.9-1.996 4.412-5.57 6.052-8.631-2.59 1.927-5.566 4.66-7.302 6.792-.442.543-.795 1.243-1.042 1.826-.121.288-.214.54-.275.72v.001l.575.575zm-4.973 3.04.007-.005zm3.582-3.043.002.001h-.002z"
          />
        </svg>
      </button>

      <!-- highlighter -->
      <button
        aria-label="Highlighter"
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

      <!-- square -->
      <button
        aria-label="Square"
        class="toolbar-button bg-slate-400 hover:bg-slate-300 rounded-full p-2 data-[is-selected]:bg-rose-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="currentColor"
          class="bi bi-square"
          viewBox="0 0 16 16"
        >
          <path
            d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"
          />
        </svg>
      </button>

      <!-- circle -->
      <button
        aria-label="Circle"
        class="toolbar-button bg-slate-400 hover:bg-slate-300 rounded-full p-2 data-[is-selected]:bg-rose-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="currentColor"
          class="bi bi-circle"
          viewBox="0 0 16 16"
        >
          <path
            d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"
          />
        </svg>
      </button>
    </div>

    <!-- color selector buttons -->
    <div class="grid grid-cols-3 gap-2">
      <button
        aria-label="Red"
        onmousedown={(e) => onMouseDownColourSelector(e, "#ef4444")}
        class="w-5 h-5 toolbar-button bg-red-500 hover:outline-white hover:outline rounded-full p-2 data-[is-selected]:bg-rose-500"
      ></button>

      <button
        aria-label="Green"
        onmousedown={(e) => onMouseDownColourSelector(e, "#22c55e")}
        class="w-5 h-5 toolbar-button bg-green-500 hover:outline-white hover:outline rounded-full p-2 data-[is-selected]:bg-rose-500"
      ></button>

      <button
        onmousedown={(e) => onMouseDownColourSelector(e, "#3b82f6")}
        id="btn-pencil"
        class="w-5 h-5 toolbar-button bg-blue-500 hover:outline-white hover:outline rounded-full p-2 data-[is-selected]:bg-rose-500"
      ></button>

      <button
        onmousedown={(e) => onMouseDownColourSelector(e, "#eab308")}
        id="btn-pencil"
        class="w-5 h-5 toolbar-button bg-yellow-500 hover:outline-white hover:outline rounded-full p-2 data-[is-selected]:bg-rose-500"
      ></button>

      <button
        onmousedown={(e) => onMouseDownColourSelector(e, "#d946ef")}
        id="btn-pencil"
        class="w-5 h-5 toolbar-button bg-fuchsia-500 hover:outline-white hover:outline rounded-full p-2 data-[is-selected]:bg-rose-500"
      ></button>

      <button
        onmousedown={(e) => onMouseDownColourSelector(e, "#713f12")}
        id="btn-pencil"
        class="w-5 h-5 toolbar-button bg-yellow-900 hover:outline-white hover:outline rounded-full p-2 data-[is-selected]:bg-rose-500"
      ></button>

      <button
        onmousedown={(e) => onMouseDownColourSelector(e, "#ffffff")}
        id="btn-pencil"
        class="w-5 h-5 toolbar-button bg-white hover:outline-white hover:outline rounded-full p-2 data-[is-selected]:bg-rose-500"
      ></button>

      <button
        onmousedown={(e) => onMouseDownColourSelector(e, "#64748b")}
        id="btn-pencil"
        class="w-5 h-5 toolbar-button bg-slate-500 hover:outline-white hover:outline rounded-full p-2 data-[is-selected]:bg-rose-500"
      ></button>

      <button
        onmousedown={(e) => onMouseDownColourSelector(e, "#000000")}
        id="btn-pencil"
        class="w-5 h-5 toolbar-button bg-black hover:outline-white hover:outline rounded-full p-2 data-[is-selected]:bg-rose-500"
      ></button>
    </div>
  </div>

  <!-- pen toolbar 2 -->
</div>
