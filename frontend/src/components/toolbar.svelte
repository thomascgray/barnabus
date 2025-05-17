<script lang="ts">
  import { appState } from "../global.svelte";
  import { eTool } from "../types";
  import ToolbarButton from "./toolbar-button.svelte";
  import * as Interactions from "../interactions.svelte";
</script>

<div
  id="toolbar-wrapper"
  class="absolute left-0 bottom-0 w-screen flex flex-row justify-center items-center pointer-events-none"
>
  <div
    id="toolbar"
    class="p-2 mb-4 rounded-full space-x-2 bg-slate-600 pointer-events-none"
  >
    <ToolbarButton
      onAction={() => Interactions.setActiveTool(eTool.cursor)}
      tool={eTool.cursor}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        fill="currentColor"
        class="bi bi-cursor-fill"
        viewBox="0 0 16 16"
      >
        <path
          d="M14.082 2.182a.5.5 0 0 1 .103.557L8.528 15.467a.5.5 0 0 1-.917-.007L5.57 10.694.803 8.652a.5.5 0 0 1-.006-.916l12.728-5.657a.5.5 0 0 1 .556.103z"
        />
      </svg>
    </ToolbarButton>

    <ToolbarButton
      onAction={() => Interactions.setActiveTool(eTool.pencil)}
      tool={eTool.pencil}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        fill="currentColor"
        class="bi bi-pencil-fill"
        viewBox="0 0 16 16"
      >
        <path
          d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"
        />
      </svg>
    </ToolbarButton>
    <ToolbarButton
      onAction={() => Interactions.setActiveTool(eTool.image)}
      tool={eTool.image}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        fill="currentColor"
        class="bi bi-image"
        viewBox="0 0 16 16"
      >
        <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0" />
        <path
          d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1z"
        />
      </svg>
    </ToolbarButton>

    <!-- text -->
    <ToolbarButton
      onAction={() => Interactions.setActiveTool(eTool.text)}
      tool={eTool.text}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        fill="currentColor"
        class="bi bi-type"
        viewBox="0 0 16 16"
      >
        <path
          d="m2.244 13.081.943-2.803H6.66l.944 2.803H8.86L5.54 3.75H4.322L1 13.081zm2.7-7.923L6.34 9.314H3.51l1.4-4.156zm9.146 7.027h.035v.896h1.128V8.125c0-1.51-1.114-2.345-2.646-2.345-1.736 0-2.59.916-2.666 2.174h1.108c.068-.718.595-1.19 1.517-1.19.971 0 1.518.52 1.518 1.464v.731H12.19c-1.647.007-2.522.8-2.522 2.058 0 1.319.957 2.18 2.345 2.18 1.06 0 1.716-.43 2.078-1.011zm-1.763.035c-.752 0-1.456-.397-1.456-1.244 0-.65.424-1.115 1.408-1.115h1.805v.834c0 .896-.752 1.525-1.757 1.525"
        />
      </svg>
    </ToolbarButton>

    <!-- measuring -->

    <ToolbarButton
      onAction={() => {
        Interactions.setActiveTool(eTool.measuring);
      }}
      tool={eTool.measuring}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        ><path
          d="M0.5 4C0.223858 4 0 4.22386 0 4.5V10.5C0 10.7761 0.223858 11 0.5 11H14.5C14.7761 11 15 10.7761 15 10.5V4.5C15 4.22386 14.7761 4 14.5 4H0.5ZM1 10V5H2.075V7.5C2.075 7.73472 2.26528 7.925 2.5 7.925C2.73472 7.925 2.925 7.73472 2.925 7.5V5H4.075V6.5C4.075 6.73472 4.26528 6.925 4.5 6.925C4.73472 6.925 4.925 6.73472 4.925 6.5V5H6.075V6.5C6.075 6.73472 6.26528 6.925 6.5 6.925C6.73472 6.925 6.925 6.73472 6.925 6.5V5H8.075V7.5C8.075 7.73472 8.26528 7.925 8.5 7.925C8.73472 7.925 8.925 7.73472 8.925 7.5V5H10.075V6.5C10.075 6.73472 10.2653 6.925 10.5 6.925C10.7347 6.925 10.925 6.73472 10.925 6.5V5H12.075V6.5C12.075 6.73472 12.2653 6.925 12.5 6.925C12.7347 6.925 12.925 6.73472 12.925 6.5V5H14V10H1Z"
          fill="currentColor"
          fill-rule="evenodd"
          clip-rule="evenodd"
        ></path></svg
      >
    </ToolbarButton>
  </div>
</div>
