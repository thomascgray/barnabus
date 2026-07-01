<script lang="ts">
  import { appState } from "../global.svelte";
  import * as Interactions from "../interactions.svelte";
  import * as Listeners from "../listeners.svelte";
  import { toast } from "../toast.svelte";

  // A single "add an image" modal that replaces the old pair of toolbar buttons
  // (ask-for-URL + open-file-dialog). The user can either type a URL or stage a
  // file (file picker CTA or drag-and-drop), then submit the modal as a whole.
  //
  // Two underlying add paths:
  //  - a staged file → Listeners.addImageFromBlob (convert → upload → addItem)
  //  - a URL string  → Interactions.addImageFromUrl (kept as an external src)
  // A staged file takes precedence if both are provided.

  let url = $state("");
  let stagedFile = $state<File | null>(null);
  let previewUrl = $state<string | null>(null);
  let isDragging = $state(false);

  let urlInput = $state<HTMLInputElement | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  // Focus the URL field when the modal opens.
  $effect(() => {
    if (appState.isImageModalOpen && urlInput) {
      urlInput.focus();
    }
  });

  // The modal owns Enter (submit) / Escape (close) while it's open. key_DOWN in
  // listeners bails out when the modal is open, so these don't double-fire.
  $effect(() => {
    if (!appState.isImageModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const clearStagedFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    stagedFile = null;
  };

  const stageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("That file isn't an image", "error");
      return;
    }
    clearStagedFile();
    stagedFile = file;
    previewUrl = URL.createObjectURL(file);
  };

  const close = () => {
    Interactions.closeImageModal();
    url = "";
    isDragging = false;
    clearStagedFile();
    if (fileInput) fileInput.value = "";
  };

  const submit = () => {
    // No screen position is tied to the modal, so spawn at the viewport centre
    // (same as paste / the old file-picker).
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    if (stagedFile) {
      Listeners.addImageFromBlob(stagedFile, cx, cy);
      close();
      return;
    }

    const trimmed = url.trim();
    if (trimmed) {
      Interactions.addImageFromUrl(trimmed, cx, cy);
      close();
      return;
    }

    toast("Enter an image URL or choose a file", "error");
  };

  const pickFile = () => fileInput?.click();

  const onFileChange = () => {
    const file = Array.from(fileInput?.files ?? []).find((f) =>
      f.type.startsWith("image/")
    );
    if (file) stageFile(file);
  };

  // Accept drops anywhere on the modal card. stopPropagation + the
  // isImageModalOpen guard in Listeners.onDrop keep this from also dropping a
  // copy onto the canvas behind the modal.
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging = false;
    const file = Array.from(e.dataTransfer?.files ?? []).find((f) =>
      f.type.startsWith("image/")
    );
    if (file) stageFile(file);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
  };

  const onDragLeave = (e: DragEvent) => {
    // Only clear when the pointer actually leaves the card, not when moving
    // between its children.
    if (e.currentTarget === e.target) isDragging = false;
  };
</script>

{#if appState.isImageModalOpen}
  <!-- backdrop -->
  <div
    class="fixed inset-0 z-[10000000000] bg-black/40 flex items-center justify-center"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) close();
    }}
    role="presentation"
  >
    <!-- card -->
    <div
      class="bg-white rounded-lg shadow-xl w-[min(92vw,460px)] p-6 relative"
      ondrop={onDrop}
      ondragover={onDragOver}
      ondragleave={onDragLeave}
      role="presentation"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-slate-800">Add an image</h2>
        <button
          class="text-slate-400 hover:text-slate-700 text-xl leading-none"
          onclick={close}
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      <!-- URL -->
      <label class="block mb-4">
        <span class="text-sm font-medium text-slate-600">Image URL</span>
        <input
          bind:this={urlInput}
          bind:value={url}
          class="mt-1 w-full p-2 border border-slate-300 rounded-md disabled:opacity-50 disabled:bg-slate-50"
          placeholder="https://example.com/picture.png"
          type="url"
          disabled={stagedFile !== null}
        />
      </label>

      <div class="flex items-center gap-3 mb-4 text-slate-400">
        <span class="flex-1 h-px bg-slate-200"></span>
        <span class="text-xs uppercase tracking-wide">or</span>
        <span class="flex-1 h-px bg-slate-200"></span>
      </div>

      <!-- file: drop zone / picker, or staged preview -->
      {#if stagedFile}
        <div
          class="flex items-center gap-3 border border-slate-200 rounded-md p-3 mb-4"
        >
          {#if previewUrl}
            <img
              src={previewUrl}
              alt="preview"
              class="w-14 h-14 object-cover rounded-sm bg-slate-100 shrink-0"
            />
          {/if}
          <span class="text-sm text-slate-600 truncate flex-1"
            >{stagedFile.name}</span
          >
          <button
            class="text-sm text-slate-400 hover:text-slate-700 underline shrink-0"
            onclick={clearStagedFile}>Remove</button
          >
        </div>
      {:else}
        <button
          type="button"
          onclick={pickFile}
          class="w-full mb-4 flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-md p-6 transition-colors {isDragging
            ? 'border-rose-400 bg-rose-50'
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            fill="currentColor"
            class="bi bi-file-earmark-arrow-up text-slate-400"
            viewBox="0 0 16 16"
          >
            <path
              d="M8.5 11.5a.5.5 0 0 1-1 0V7.707L6.354 8.854a.5.5 0 1 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 7.707z"
            />
            <path
              d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2M9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"
            />
          </svg>
          <span class="text-sm font-medium text-slate-600"
            >Drag &amp; drop an image here</span
          >
          <span class="text-xs text-slate-400">or click to choose a file</span>
        </button>
      {/if}

      <input
        bind:this={fileInput}
        onchange={onFileChange}
        type="file"
        accept="image/*"
        class="hidden"
      />

      <div class="flex justify-end gap-2">
        <button
          class="px-4 py-2 text-sm rounded-md text-slate-600 hover:bg-slate-100"
          onclick={close}>Cancel</button
        >
        <button
          class="px-4 py-2 text-sm rounded-md bg-slate-800 text-white hover:bg-slate-700"
          onclick={submit}>Add image</button
        >
      </div>
    </div>
  </div>
{/if}
