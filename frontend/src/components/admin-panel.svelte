<script lang="ts">
  import { toast } from "../toast.svelte";

  let { onClose }: { onClose: () => void } = $props();

  type BoardMeta = { id: string; name: string; createdAt: number; updatedAt: number };

  let secret = $state("");
  let authed = $state(false);
  let boards = $state<BoardMeta[]>([]);

  // new-board form
  let newName = $state("");
  let newPassphrase = $state("");

  const authHeader = () => ({ Authorization: `Bearer ${secret}` });

  const loadBoards = async () => {
    const res = await fetch("/api/admin/boards", { headers: authHeader() });
    if (res.status === 401) {
      authed = false;
      return toast("Wrong admin secret", "error");
    }
    if (res.status === 503) {
      return toast("Admin not configured (set BARNABUS_ADMIN_SECRET)", "error");
    }
    if (!res.ok) return toast("Failed to load boards", "error");
    boards = await res.json();
    authed = true;
  };

  const joinLink = (id: string) => `${location.origin}/?board=${id}`;

  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(joinLink(id));
      toast("Join link copied", "success");
    } catch {
      toast(joinLink(id), "info");
    }
  };

  const createBoard = async () => {
    if (!newName.trim()) return toast("Board needs a name", "error");
    const res = await fetch("/api/admin/boards", {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), passphrase: newPassphrase }),
    });
    if (!res.ok) return toast("Failed to create board", "error");
    const created = await res.json();
    toast(`Created "${created.name}"`, "success");
    newName = "";
    newPassphrase = "";
    await copyLink(created.id);
    await loadBoards();
  };

  const deleteBoard = async (b: BoardMeta) => {
    if (!confirm(`Delete "${b.name}"? This removes its objects and uploads.`)) return;
    const res = await fetch(`/api/admin/boards/${b.id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    if (!res.ok) return toast("Failed to delete board", "error");
    toast(`Deleted "${b.name}"`, "success");
    await loadBoards();
  };
</script>

<div class="flex items-center justify-between mb-4">
  <h2 class="text-lg font-semibold">Admin</h2>
  <button class="text-sm text-slate-400 hover:text-slate-600 underline" onclick={onClose}>
    ← back
  </button>
</div>

{#if !authed}
  <p class="text-sm text-slate-500 mb-2">Enter the admin secret to manage boards.</p>
  <div class="flex gap-2">
    <input
      class="flex-1 p-2 border border-slate-300 rounded-md"
      bind:value={secret}
      placeholder="BARNABUS_ADMIN_SECRET"
      type="password"
      onkeydown={(e) => e.key === "Enter" && loadBoards()}
    />
    <button class="px-3 py-2 bg-slate-800 text-white rounded-md" onclick={loadBoards}>
      Unlock
    </button>
  </div>
{:else}
  <!-- create -->
  <div class="flex flex-col gap-2 bg-white border border-slate-200 rounded-md p-3 mb-4">
    <input
      class="w-full p-2 border border-slate-300 rounded-md"
      bind:value={newName}
      placeholder="new board name"
      type="text"
    />
    <input
      class="w-full p-2 border border-slate-300 rounded-md"
      bind:value={newPassphrase}
      placeholder="passphrase (blank = open board)"
      type="text"
    />
    <button class="w-full p-2 bg-green-600 text-white rounded-md" onclick={createBoard}>
      Create board
    </button>
  </div>

  <!-- list -->
  <ul class="flex flex-col gap-2">
    {#each boards as b (b.id)}
      <li class="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-md p-3">
        <div class="min-w-0">
          <div class="font-medium truncate">{b.name}</div>
          <div class="text-xs text-slate-400 truncate">{b.id}</div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button class="px-2 py-1 text-sm border border-slate-300 rounded-md" onclick={() => copyLink(b.id)}>
            Copy link
          </button>
          <button class="px-2 py-1 text-sm text-red-500 hover:text-red-700" onclick={() => deleteBoard(b)}>
            Delete
          </button>
        </div>
      </li>
    {/each}
  </ul>
{/if}
