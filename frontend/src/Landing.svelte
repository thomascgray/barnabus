<script lang="ts">
  let serverUrl = "localhost:8080";
  import * as ConnectionManager from "./ConnectionManager.svelte";

  const onConnect = () => {
    ConnectionManager.tryConnection(serverUrl);
  };
</script>

<div class="container mx-auto mt-4">
  <h1 class="text-2xl font-bold">barnabus</h1>

  <p>connect to a server</p>

  <div class="flex items-center gap-2">
    <input
      class="p-2 border border-slate-300"
      bind:value={serverUrl}
      type="text"
    />

    <button
      onclick={() => {
        onConnect();
      }}
      class="p-2 bg-slate-300 rounded-md"
      >{ConnectionManager.cmState.connectionState === "connecting"
        ? "loading..."
        : "connect"}</button
    >
  </div>
</div>
