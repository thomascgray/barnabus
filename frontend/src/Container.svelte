<script lang="ts">
  import App from "./App.svelte";
  import Landing from "./Landing.svelte";
  import * as ConnectionManager from "./ConnectionManager.svelte";
  import { onDestroy, onMount } from "svelte";
</script>

<div class="flex flex-col h-screen w-screen">
  <App />
  <!-- {#if ConnectionManager.cmState.connectionState === "connected"}
  {:else}
    <Landing />
  {/if} -->
</div>
