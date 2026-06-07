<script lang="ts">
  import { onMount } from "svelte";
  import * as ConnectionManager from "../ConnectionManager.svelte";
  import { membership } from "../membership.svelte";
  import { toast } from "../toast.svelte";

  // The board to join (parsed from the ?board= link by Landing) and a way back
  // to the dashboard (clears the URL param).
  let { boardId, onBack }: { boardId: string; onBack: () => void } = $props();

  // If we've joined this board before, prefill the username and passphrase.
  const saved = membership.boards.find((b) => b.boardId === boardId);

  let username = $state(saved?.username ?? membership.boards[0]?.username ?? "");
  let passphrase = $state(saved?.passphrase ?? "");

  let loading = $state(true);
  let notFound = $state(false);
  let boardName = $state("");
  let createdBy = $state("");

  const connecting = $derived(
    ConnectionManager.cmState.connectionState === "connecting"
  );

  // Look the board up so we can show its real name (and who made it) before the
  // passphrase is entered. A bad link fails fast here, before opening a socket.
  onMount(async () => {
    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}`);
      if (!res.ok) {
        notFound = true;
        return;
      }
      const board = await res.json();
      boardName = board.name ?? "this board";
      createdBy = board.createdBy ?? "";
    } catch {
      toast("Couldn't reach the server", "error");
      notFound = true;
    } finally {
      loading = false;
    }
  });

  const join = () => {
    if (connecting) return;
    if (!username.trim()) return toast("Enter a username", "error");
    ConnectionManager.connect({
      boardId,
      boardName,
      passphrase,
      name: username.trim(),
    });
  };
</script>

<div class="w-screen h-screen overflow-auto bg-slate-100 flex justify-center">
  <div class="w-full max-w-md p-6 mt-10">
    <h1 class="text-3xl font-bold mb-1">barnabus</h1>
    <p class="text-slate-500 mb-6">a self-hosted virtual tabletop</p>

    {#if loading}
      <p class="text-slate-400">Looking up board…</p>
    {:else if notFound}
      <div class="bg-white border border-slate-200 rounded-md p-4">
        <p class="font-medium mb-1">That board doesn't exist</p>
        <p class="text-sm text-slate-500 mb-4">
          The invite link may be wrong, or the board was deleted.
        </p>
        <button
          class="text-sm text-slate-500 hover:text-slate-700 underline"
          onclick={onBack}>← back to your boards</button
        >
      </div>
    {:else}
      <div class="bg-white border border-slate-200 rounded-md p-5">
        <p class="text-lg mb-5">
          You're being invited to join
          <span class="font-semibold">{boardName}</span>{#if createdBy}
            by <span class="font-semibold">{createdBy}</span>{/if}.
        </p>

        <label class="block mb-3">
          <span class="text-sm font-medium text-slate-600">Your username</span>
          <input
            class="mt-1 w-full p-2 border border-slate-300 rounded-md"
            bind:value={username}
            placeholder="e.g. Tom"
            type="text"
          />
        </label>

        <label class="block mb-4">
          <span class="text-sm font-medium text-slate-600">Passphrase</span>
          <input
            class="mt-1 w-full p-2 border border-slate-300 rounded-md"
            bind:value={passphrase}
            placeholder="leave blank if this is an open board"
            type="password"
            onkeydown={(e) => e.key === "Enter" && join()}
          />
        </label>

        <button
          class="w-full p-2 bg-slate-800 text-white rounded-md disabled:opacity-50"
          disabled={connecting}
          onclick={join}>{connecting ? "joining…" : "Join board"}</button
        >
      </div>

      <button
        class="mt-6 text-sm text-slate-400 hover:text-slate-600 underline"
        onclick={onBack}>← back to your boards</button
      >
    {/if}
  </div>
</div>
