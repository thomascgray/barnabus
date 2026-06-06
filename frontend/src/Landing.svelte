<script lang="ts">
  import { onMount } from "svelte";
  import * as ConnectionManager from "./ConnectionManager.svelte";
  import { membership, forget, type Membership } from "./membership.svelte";
  import { toast } from "./toast.svelte";
  import AdminPanel from "./components/admin-panel.svelte";

  // Shared username — defaults to the last one used.
  let username = $state(membership.boards[0]?.username ?? "");
  // "Join a new board" form.
  let joinInput = $state("");
  let passphrase = $state("");
  let showAdmin = $state(false);

  const connecting = $derived(
    ConnectionManager.cmState.connectionState === "connecting"
  );

  // The default board is open (no passphrase). Offer a quick-join unless it's
  // already a saved membership.
  const hasDefault = $derived(
    membership.boards.some((b) => b.boardId === "default")
  );

  // Accept either a raw board id or a full join link (…/?board=<id>).
  const parseBoardId = (input: string): string => {
    const t = input.trim();
    const m = t.match(/[?&]board=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : t;
  };

  onMount(() => {
    const fromLink = new URLSearchParams(location.search).get("board");
    if (fromLink) joinInput = fromLink;
  });

  const joinSaved = (b: Membership) => {
    if (connecting) return;
    ConnectionManager.connect({
      boardId: b.boardId,
      boardName: b.name,
      passphrase: b.passphrase,
      name: username || b.username,
    });
  };

  const joinDefault = () => {
    if (connecting) return;
    if (!username.trim()) return toast("Enter a username first", "error");
    ConnectionManager.connect({
      boardId: "default",
      boardName: "Default Board",
      passphrase: "",
      name: username.trim(),
    });
  };

  const joinNew = async () => {
    if (connecting) return;
    const id = parseBoardId(joinInput);
    if (!id) return toast("Enter a board link or id", "error");
    if (!username.trim()) return toast("Enter a username", "error");

    // Look the board up so we can show/store its real name (and fail fast on a
    // bad link before opening a socket).
    let name = "Board";
    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(id)}`);
      if (!res.ok) return toast("No such board", "error");
      name = (await res.json()).name;
    } catch {
      return toast("Couldn't reach the server", "error");
    }

    ConnectionManager.connect({
      boardId: id,
      boardName: name,
      passphrase,
      name: username.trim(),
    });
  };
</script>

<div class="w-screen h-screen overflow-auto bg-slate-100 flex justify-center">
  <div class="w-full max-w-md p-6 mt-10">
    <h1 class="text-3xl font-bold mb-1">barnabus</h1>
    <p class="text-slate-500 mb-6">a self-hosted virtual tabletop</p>

    {#if showAdmin}
      <AdminPanel onClose={() => (showAdmin = false)} />
    {:else}
      <!-- username -->
      <label class="block mb-6">
        <span class="text-sm font-medium text-slate-600">Your username</span>
        <input
          class="mt-1 w-full p-2 border border-slate-300 rounded-md"
          bind:value={username}
          placeholder="e.g. Tom"
          type="text"
        />
      </label>

      <!-- saved boards -->
      <h2 class="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
        Your boards
      </h2>
      {#if membership.boards.length === 0 && hasDefault}
        <p class="text-slate-400 text-sm mb-3">No saved boards yet.</p>
      {/if}
      <ul class="flex flex-col gap-2 mb-3">
        {#each membership.boards as b (b.boardId)}
          <li
            class="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-md p-3"
          >
            <div class="min-w-0">
              <div class="font-medium truncate">{b.name}</div>
              <div class="text-xs text-slate-400 truncate">as {b.username}</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                class="px-3 py-1 bg-slate-800 text-white rounded-md text-sm disabled:opacity-50"
                disabled={connecting}
                onclick={() => joinSaved(b)}>Join</button
              >
              <button
                class="px-2 py-1 text-slate-400 hover:text-red-500 text-sm"
                title="Forget this board"
                onclick={() => forget(b.boardId)}>✕</button
              >
            </div>
          </li>
        {/each}

        {#if !hasDefault}
          <li
            class="flex items-center justify-between gap-2 bg-white border border-dashed border-slate-300 rounded-md p-3"
          >
            <div>
              <div class="font-medium">Default Board</div>
              <div class="text-xs text-slate-400">open · no passphrase</div>
            </div>
            <button
              class="px-3 py-1 bg-slate-800 text-white rounded-md text-sm disabled:opacity-50"
              disabled={connecting}
              onclick={joinDefault}>Join</button
            >
          </li>
        {/if}
      </ul>

      <!-- join a new board -->
      <h2 class="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2 mt-6">
        Join a board
      </h2>
      <div class="flex flex-col gap-2 bg-white border border-slate-200 rounded-md p-3">
        <input
          class="w-full p-2 border border-slate-300 rounded-md"
          bind:value={joinInput}
          placeholder="board link or id"
          type="text"
        />
        <input
          class="w-full p-2 border border-slate-300 rounded-md"
          bind:value={passphrase}
          placeholder="passphrase"
          type="password"
        />
        <button
          class="w-full p-2 bg-slate-800 text-white rounded-md disabled:opacity-50"
          disabled={connecting}
          onclick={joinNew}>{connecting ? "joining…" : "Join board"}</button
        >
      </div>

      <button
        class="mt-6 text-sm text-slate-400 hover:text-slate-600 underline"
        onclick={() => (showAdmin = true)}>Admin</button
      >
    {/if}
  </div>
</div>
