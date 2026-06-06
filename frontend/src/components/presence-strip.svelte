<script lang="ts">
  import * as ConnectionManager from "../ConnectionManager.svelte";

  const { cmState, presence, identity } = ConnectionManager;

  // A stable-ish colour per member, derived from their id.
  const colourFor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return `hsl(${Math.abs(hash) % 360} 65% 45%)`;
  };
</script>

<div
  class="fixed top-0 right-0 z-[9999999999] m-3 flex items-center gap-3 bg-white/90 backdrop-blur rounded-full shadow px-3 py-1.5 text-sm"
>
  <span class="font-semibold text-slate-700 max-w-[12rem] truncate">
    {cmState.boardName ?? "Board"}
  </span>

  <div class="flex -space-x-2">
    {#each presence.members as m (m.id)}
      <div
        class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white"
        style={`background:${colourFor(m.id)}`}
        title={m.id === identity.id ? `${m.name} (you)` : m.name}
      >
        {(m.name || "?").slice(0, 1).toUpperCase()}
      </div>
    {/each}
  </div>

  <button
    class="text-slate-400 hover:text-red-500 text-xs font-medium"
    title="Leave this board"
    onclick={() => ConnectionManager.leaveBoard()}
  >
    Leave
  </button>
</div>
