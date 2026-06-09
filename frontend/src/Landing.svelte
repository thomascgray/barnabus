<script lang="ts">
  import { onMount } from "svelte";
  import * as ConnectionManager from "./ConnectionManager.svelte";
  import { membership, forget, type Membership } from "./membership.svelte";
  import { toast } from "./toast.svelte";
  import { adminState, joinLink, verifyAdmin } from "./admin.svelte";
  import AdminPanel from "./components/admin-panel.svelte";
  import JoinBoard from "./components/join-board.svelte";

  // Shared username — remembered across visits, defaulting to the last one used.
  const NAME_KEY = "barnabus.username";
  const initialName =
    localStorage.getItem(NAME_KEY) ?? membership.boards[0]?.username ?? "";
  let username = $state(initialName);
  // "your name" is shown read-only with an Edit button; editing toggles the
  // field on and persists the name when saved. Start in edit mode if unset.
  let editingName = $state(initialName.trim() === "");

  const saveName = () => {
    username = username.trim();
    localStorage.setItem(NAME_KEY, username);
    editingName = false;
  };

  // Routing: when a ?board=<id> link is open we show the dedicated invite/join
  // screen; otherwise the dashboard ("your boards" + admin). Kept in $state so
  // pasting a link / hitting back swaps screens without a reload.
  let boardParam = $state<string | null>(null);

  // "Paste a join link" input on the dashboard.
  let linkInput = $state("");

  const connecting = $derived(
    ConnectionManager.cmState.connectionState === "connecting",
  );

  // The example board is open (no passphrase). Offer a quick-join unless it's
  // already a saved membership.
  const hasExample = $derived(
    membership.boards.some((b) => b.boardId === "default"),
  );

  // Accept either a raw board id or a full join link (…/?board=<id>).
  const parseBoardId = (input: string): string => {
    const t = input.trim();
    const m = t.match(/[?&]board=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : t;
  };

  onMount(() => {
    boardParam = new URLSearchParams(location.search).get("board");
    // Pick up admin status from the remembered secret so "your boards" can show
    // copy-link buttons without opening the admin panel.
    verifyAdmin();
  });

  // Show the invite screen for a board id, reflecting it in the URL so the
  // screen survives a refresh and the link is shareable from the address bar.
  const goToInvite = (id: string) => {
    boardParam = id;
    const url = new URL(location.href);
    url.searchParams.set("board", id);
    history.replaceState(null, "", url);
  };

  const backToDashboard = () => {
    boardParam = null;
    const url = new URL(location.href);
    url.searchParams.delete("board");
    history.replaceState(null, "", url);
  };

  const openLink = () => {
    const id = parseBoardId(linkInput);
    if (!id) return toast("Paste a board link or id", "error");
    linkInput = "";
    goToInvite(id);
  };

  const joinSaved = (b: Membership) => {
    if (connecting) return;
    ConnectionManager.connect({
      boardId: b.boardId,
      boardName: b.name,
      passphrase: b.passphrase,
      name: username || b.username,
    });
  };

  const joinExample = () => {
    if (connecting) return;
    if (!username.trim()) return toast("Enter a username first", "error");
    ConnectionManager.connect({
      boardId: "default",
      boardName: "Example Board",
      passphrase: "",
      name: username.trim(),
    });
  };

  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(joinLink(id));
      toast("Join link copied", "success");
    } catch {
      toast(joinLink(id), "info");
    }
  };
</script>

{#if boardParam}
  <JoinBoard boardId={boardParam} onBack={backToDashboard} />
{:else}
  <div class="w-screen h-screen overflow-auto bg-slate-100 flex justify-center">
    <div class="w-full max-w-md p-6 mt-10">
      <h1 class="text-3xl font-bold mb-1">barnabus</h1>
      <p class="text-slate-500 mb-6">a self-hosted virtual tabletop</p>

      <!-- your name -->
      <h2
        class="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2"
      >
        Your name
      </h2>
      <div class="flex gap-2 mb-6">
        <input
          class="flex-1 p-2 rounded-md disabled:bg-transparent disabled:text-slate-700 {editingName
            ? 'border border-slate-300'
            : 'border border-dashed border-slate-400'}"
          bind:value={username}
          placeholder="e.g. Tom"
          type="text"
          disabled={!editingName}
          onkeydown={(e) => e.key === "Enter" && editingName && saveName()}
        />
        {#if editingName}
          <button
            class="px-3 py-2 bg-slate-200 text-slate-800 rounded-md"
            onclick={saveName}>save</button
          >
        {:else}
          <button
            class="px-3 py-2 bg-slate-200 text-slate-800 rounded-md"
            onclick={() => (editingName = true)}>edit</button
          >
        {/if}
      </div>

      <!-- saved boards -->
      <h2
        class="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2"
      >
        Boards you're on
      </h2>
      {#if membership.boards.length === 0 && hasExample}
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
              {#if adminState.authed}
                <button
                  class="px-2 py-1 text-sm border border-slate-300 rounded-md"
                  title="Copy join link"
                  onclick={() => copyLink(b.boardId)}>Copy join link</button
                >
              {/if}
              <button
                class="px-2 py-1 text-slate-400 hover:text-red-500 text-sm"
                title="Forget this board"
                onclick={() => forget(b.boardId)}>✕</button
              >
            </div>
          </li>
        {/each}

        {#if !hasExample}
          <li
            class="flex items-center justify-between gap-2 bg-white border border-dashed border-slate-300 rounded-md p-3"
          >
            <div>
              <div class="font-medium">Example Board</div>
              <div class="text-xs text-slate-400">open · no passphrase</div>
            </div>
            <button
              class="px-3 py-1 bg-slate-800 text-white rounded-md text-sm disabled:opacity-50"
              disabled={connecting}
              onclick={joinExample}>Join</button
            >
          </li>
        {/if}
      </ul>

      <!-- join via link -->
      <h2
        class="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2 mt-6"
      >
        Have an invite link?
      </h2>
      <div class="flex gap-2 bg-white border border-slate-200 rounded-md p-3">
        <input
          class="flex-1 p-2 border border-slate-300 rounded-md"
          bind:value={linkInput}
          placeholder="paste a board link or id"
          type="text"
          onkeydown={(e) => e.key === "Enter" && openLink()}
        />
        <button
          class="px-3 py-2 bg-slate-800 text-white rounded-md whitespace-nowrap"
          onclick={openLink}>Continue</button
        >
      </div>

      <!-- admin (inline) -->
      <div class="mt-8">
        <AdminPanel />
      </div>
    </div>
  </div>
{/if}
