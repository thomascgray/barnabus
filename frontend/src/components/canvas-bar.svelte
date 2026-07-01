<script lang="ts">
  // The "boards" bar (issue #26): a floating bar at the top-left, to the left of
  // the centred camera/zoom controls, for managing the canvases in this room.
  // Select a canvas (click → switch to it), create a new one (+), rename any
  // (double-click), and delete any but the first (× on hover).
  import { cmState } from "../ConnectionManager.svelte";
  import * as Canvases from "../canvases.svelte";

  // Like the other bars: use mousedown and swallow the event so the canvas
  // background listener underneath never starts a selection-box drag from a bar
  // click.
  const action = (fn: () => void) => (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  // Inline rename state. `editingId` is the canvas being renamed; null when not
  // editing.
  let editingId = $state<string | null>(null);
  let editValue = $state("");

  const startRename = (id: string, name: string) => {
    editingId = id;
    editValue = name;
  };

  const commitRename = () => {
    if (editingId === null) return;
    const id = editingId;
    editingId = null;
    Canvases.renameCanvas(id, editValue);
  };

  const cancelRename = () => {
    editingId = null;
  };

  // Stop canvas keyboard shortcuts (key_DOWN on window) from firing while typing
  // a canvas name; handle our own Enter/Escape.
  const onRenameKeydown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  const onDelete = (id: string, name: string) => {
    if (confirm(`Delete board "${name}"? This removes all of its objects.`)) {
      Canvases.deleteCanvas(id);
    }
  };

  const autofocus = (node: HTMLInputElement) => {
    node.focus();
    node.select();
  };
</script>

<div
  id="canvas-bar-wrapper"
  class="absolute left-0 top-0 flex flex-row items-center pointer-events-none"
>
  <div
    class="p-2 mt-4 ml-4 rounded-full flex flex-row items-center space-x-2 bg-slate-600 pointer-events-none max-w-[60vw] overflow-x-auto"
  >
    {#each cmState.canvases as canvas, i (canvas.id)}
      {#if editingId === canvas.id}
        <div
          class="px-2 py-1 rounded-full bg-slate-200 flex items-center pointer-events-auto"
        >
          <input
            use:autofocus
            bind:value={editValue}
            onkeydown={onRenameKeydown}
            onblur={commitRename}
            class="w-28 bg-transparent text-sm font-semibold text-slate-800 outline-none"
          />
        </div>
      {:else}
        <div
          class="group flex flex-row items-center rounded-full pointer-events-auto {canvas.id ===
          cmState.activeCanvasId
            ? 'bg-slate-200 text-slate-900'
            : 'bg-slate-400 text-slate-800 hover:bg-slate-300'}"
        >
          <button
            onmousedown={action(() => Canvases.switchCanvas(canvas.id))}
            ondblclick={() => startRename(canvas.id, canvas.name)}
            title={`Switch to "${canvas.name}" — double-click to rename`}
            class="px-3 py-1 text-sm font-semibold max-w-[10rem] truncate active:scale-95"
          >
            {canvas.name}
          </button>

          <!-- delete: available on any board but the first/default one -->
          {#if i > 0}
            <button
              onmousedown={action(() => onDelete(canvas.id, canvas.name))}
              title={`Delete "${canvas.name}"`}
              aria-label={`Delete board ${canvas.name}`}
              class="mr-1 w-5 h-5 flex items-center justify-center rounded-full text-slate-500 hover:text-white hover:bg-red-500 leading-none"
            >
              &times;
            </button>
          {/if}
        </div>
      {/if}
    {/each}

    <!-- create a new board -->
    <button
      onmousedown={action(() => Canvases.createCanvas())}
      title="New board"
      aria-label="New board"
      class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-400 hover:bg-slate-300 hover:scale-110 active:scale-95 pointer-events-auto text-slate-800 text-lg font-semibold leading-none"
    >
      +
    </button>
  </div>
</div>
