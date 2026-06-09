<script lang="ts">
  import App from "./App.svelte";
  import Landing from "./Landing.svelte";
  import * as ConnectionManager from "./ConnectionManager.svelte";
  import { Toaster } from "svelte-french-toast";
</script>

<!-- Issue #16: single Toaster host for the whole app. Lives here (above the
     Landing/App switch) so toasts survive joining a board. -->
<Toaster position="bottom-left" />

<div class="flex flex-col h-screen w-screen">
  {#if ConnectionManager.cmState.connectionState === "connected"}
    <App />
  {:else}
    <Landing />
  {/if}
</div>
