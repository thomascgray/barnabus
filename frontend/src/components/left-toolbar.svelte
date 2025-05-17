<script lang="ts">
  import { parseRoll } from "../dice.svelte";
  import { type RollResult } from "../types";
  import classnames from "classnames";
  import { sendMessage } from "../ConnectionManager.svelte";

  let inputVal = $state("");

  let hidden = $state(true);

  import { rollResults } from "../global.svelte";

  const onkeydown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      const rollResult = parseRoll(inputVal);
      if (rollResult) {
        // add the result to the top of the list
        rollResults.unshift(rollResult);
        inputVal = "";
        sendMessage(rollResult);
        // remove the last result if we've reached 30
        if (rollResults.length > 30) {
          rollResults.pop();
        }
      }
    }
  };

  const onclickhandle = () => {
    hidden = !hidden;
  };
</script>

<div
  id="left-toolbar"
  class={classnames(
    "flex flex-col absolute top-0 h-screen w-[350px] bg-slate-600 transition-[left] duration-300",
    {
      "-left-[350px]": hidden,
      "left-0": !hidden,
    }
  )}
>
  <!-- the handle to close the drawer -->
  <button
    id="left-toolbar-handle"
    class="absolute top-[0.6rem] left-[350px] h-8 w-8 bg-slate-700 cursor-pointer rounded-r-md"
    aria-label="left toolbar handle"
    onclick={onclickhandle}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      class={classnames("fill-white stroke-white ml-2", {
        "rotate-180": hidden,
      })}
      viewBox="0 0 16 16"
    >
      <path
        fill-rule="evenodd"
        d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"
      />
    </svg>
  </button>

  <div class="space-x-2 p-2 justify-around bg-slate-700 text-white">
    Dice Roller
  </div>

  <div
    class="rolls flex flex-col-reverse flex-grow gap-2 px-2 overflow-y-scroll"
  >
    {#each rollResults as rollResult}
      <div class="p-2 bg-slate-300 rounded-md">
        <span
          >You rolled <span class="font-bold"
            >[{rollResult.keptRolls.join(", ")}]</span
          >
          for a total of
          <span class="font-bold">{rollResult.total}</span></span
        >
      </div>
    {/each}
  </div>

  <input
    {onkeydown}
    bind:value={inputVal}
    class="m-2 p-2 text-sm"
    placeholder="try '3d6' or '1d20+5' and enter"
    type="text"
  />
</div>
