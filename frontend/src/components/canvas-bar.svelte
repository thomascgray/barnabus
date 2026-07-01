<script lang="ts">
  // The canvas switcher (issue #26 + follow-up): a compact dropdown that sits in
  // the centred top bar, immediately left of the camera controls. The trigger
  // shows the active canvas name; the menu lists every canvas (click to switch),
  // with per-row inline rename (pencil) + delete (trash), and a "New canvas" item.
  //
  // Built on shadcn-svelte's DropdownMenu (see CLAUDE/frontend-ui.md). Switch/new
  // are real DropdownMenu.Items so they close the menu + keep keyboard nav; the
  // rename/delete icons are *siblings* of the item (not children) so clicking them
  // never triggers the row's switch, and — being inside the portalled content —
  // they don't dismiss the menu, which lets the inline rename input stay open.
  import { cmState } from "../ConnectionManager.svelte";
  import * as Canvases from "../canvases.svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import CheckIcon from "@lucide/svelte/icons/check";

  const activeName = $derived(
    cmState.canvases.find((c) => c.id === cmState.activeCanvasId)?.name ??
      "Canvas"
  );

  // Inline rename state. `editingId` is the canvas being renamed; null when idle.
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

  // Handle our own Enter/Escape and stop the event reaching the window-level
  // canvas shortcuts (Listeners.key_DOWN) while typing a name.
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

  const onSwitch = (id: string) => {
    editingId = null;
    Canvases.switchCanvas(id);
  };

  const onNew = () => {
    editingId = null;
    Canvases.createCanvas();
  };

  const onDelete = (id: string, name: string) => {
    if (confirm(`Delete canvas "${name}"? This removes all of its objects.`)) {
      Canvases.deleteCanvas(id);
    }
  };

  // A row-action button (pencil/trash) must not bubble into the switch item.
  const rowAction = (fn: () => void) => (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  const autofocus = (node: HTMLInputElement) => {
    node.focus();
    node.select();
  };
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger
    title="Switch canvas"
    class="h-12 max-w-64 flex items-center gap-2 rounded-full bg-slate-600 hover:bg-slate-500 px-4 text-slate-100 pointer-events-auto active:scale-95 transition-colors outline-hidden"
  >
    <span class="truncate text-sm font-semibold">{activeName}</span>
    <ChevronDownIcon class="size-4 shrink-0 opacity-80" />
  </DropdownMenu.Trigger>

  <DropdownMenu.Content
    align="center"
    sideOffset={8}
    class="min-w-60 pointer-events-auto"
  >
    <DropdownMenu.Label class="text-muted-foreground text-xs font-normal">
      Canvases
    </DropdownMenu.Label>
    <DropdownMenu.Separator />

    {#each cmState.canvases as canvas, i (canvas.id)}
      {#if editingId === canvas.id}
        <div class="px-1 py-0.5">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            use:autofocus
            bind:value={editValue}
            onkeydown={onRenameKeydown}
            onblur={commitRename}
            class="w-full rounded-sm border border-input bg-background px-2 py-1 text-sm text-foreground outline-hidden focus:border-ring"
          />
        </div>
      {:else}
        <div class="group/row flex items-center">
          <DropdownMenu.Item
            onSelect={() => onSwitch(canvas.id)}
            class="flex-1 min-w-0 cursor-pointer"
          >
            <CheckIcon
              class="size-4 shrink-0 {canvas.id === cmState.activeCanvasId
                ? 'opacity-100'
                : 'opacity-0'}"
            />
            <span
              class="truncate {canvas.id === cmState.activeCanvasId
                ? 'font-semibold'
                : ''}"
            >
              {canvas.name}
            </span>
          </DropdownMenu.Item>

          <!-- Sibling actions: revealed on row hover / focus-within. -->
          <div
            class="flex items-center gap-0.5 pr-1 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100"
          >
            <button
              type="button"
              onclick={rowAction(() => startRename(canvas.id, canvas.name))}
              title="Rename"
              aria-label={`Rename ${canvas.name}`}
              class="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <PencilIcon class="size-3.5" />
            </button>
            <!-- delete: any canvas but the first/default one -->
            {#if i > 0}
              <button
                type="button"
                onclick={rowAction(() => onDelete(canvas.id, canvas.name))}
                title="Delete"
                aria-label={`Delete ${canvas.name}`}
                class="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2Icon class="size-3.5" />
              </button>
            {/if}
          </div>
        </div>
      {/if}
    {/each}

    <DropdownMenu.Separator />
    <DropdownMenu.Item onSelect={onNew} class="cursor-pointer">
      <PlusIcon class="size-4 shrink-0" />
      <span>New canvas</span>
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
