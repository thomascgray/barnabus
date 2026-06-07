<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "../toast.svelte";
  import {
    adminState,
    authHeader,
    clearAdminSecret,
    joinLink,
    setAdminName,
    setAdminSecret,
  } from "../admin.svelte";

  let { onClose }: { onClose: () => void } = $props();

  type BoardMeta = {
    id: string;
    name: string;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  };

  // The secret typed into the unlock field. Seeded from the remembered secret so
  // a returning admin just hits "Unlock" (or we auto-unlock on mount below).
  let secretInput = $state(adminState.secret);
  let boards = $state<BoardMeta[]>([]);

  // new-board form
  let newName = $state("");
  let newPassphrase = $state("");
  // The creator name stamped onto new boards — remembered across visits.
  let creatorName = $state(adminState.name);

  // Try to load boards with whatever secret we have. On 401 the key is wrong or
  // was rotated server-side: forget it and fall back to the unlock prompt.
  const loadBoards = async (secret = secretInput): Promise<boolean> => {
    setAdminSecret(secret);
    const res = await fetch("/api/admin/boards", { headers: authHeader() });
    if (res.status === 401) {
      clearAdminSecret();
      secretInput = "";
      return false;
    }
    if (res.status === 503) {
      toast("Admin not configured (set BARNABUS_ADMIN_SECRET)", "error");
      return false;
    }
    if (!res.ok) {
      toast("Failed to load boards", "error");
      return false;
    }
    boards = await res.json();
    adminState.authed = true;
    return true;
  };

  const unlock = async () => {
    if (!secretInput.trim()) return;
    const ok = await loadBoards(secretInput);
    if (!ok && adminState.secret === "") toast("Wrong admin secret", "error");
  };

  // If we already have a remembered secret, verify it silently on mount so the
  // admin lands straight on their boards.
  onMount(() => {
    if (adminState.secret) loadBoards(adminState.secret);
  });

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
    setAdminName(creatorName.trim());
    const res = await fetch("/api/admin/boards", {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        passphrase: newPassphrase,
        createdBy: creatorName.trim(),
      }),
    });
    if (res.status === 401) {
      clearAdminSecret();
      secretInput = "";
      return toast("Admin secret rejected — please unlock again", "error");
    }
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

  const lock = () => {
    clearAdminSecret();
    secretInput = "";
    boards = [];
  };
</script>

<div class="flex items-center justify-between mb-4">
  <h2 class="text-lg font-semibold">Admin</h2>
  <div class="flex items-center gap-3">
    {#if adminState.authed}
      <button class="text-sm text-slate-400 hover:text-slate-600 underline" onclick={lock}>
        lock
      </button>
    {/if}
    <button class="text-sm text-slate-400 hover:text-slate-600 underline" onclick={onClose}>
      ← back
    </button>
  </div>
</div>

{#if !adminState.authed}
  <p class="text-sm text-slate-500 mb-2">Enter the admin secret to manage boards.</p>
  <div class="flex gap-2">
    <input
      class="flex-1 p-2 border border-slate-300 rounded-md"
      bind:value={secretInput}
      placeholder="BARNABUS_ADMIN_SECRET"
      type="password"
      onkeydown={(e) => e.key === "Enter" && unlock()}
    />
    <button class="px-3 py-2 bg-slate-800 text-white rounded-md" onclick={unlock}>
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
    <input
      class="w-full p-2 border border-slate-300 rounded-md"
      bind:value={creatorName}
      placeholder="your name (shown to people you invite)"
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
          <div class="text-xs text-slate-400 truncate">
            {b.id}{#if b.createdBy} · by {b.createdBy}{/if}
          </div>
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
