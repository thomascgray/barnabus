<script lang="ts">
  import * as Interactions from "../interactions.svelte";
</script>

<div
  id="popover-menu"
  class="hidden absolute top-0 left-0 flex-row justify-center items-center bg-slate-500 p-2 rounded-full space-x-2 group"
>
  <!-- complex options -->
  <button
    title="Edit"
    class="pointer-events-none bg-slate-400 hover:bg-slate-300 rounded-full p-2"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      class="bi bi-three-dots"
      viewBox="0 0 16 16"
    >
      <path
        d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"
      />
    </svg>
  </button>

  <!-- lock -->
  <!-- <button
    onclick={Interactions.toggleLock}
    title="Toggle Lock"
    class="pointer-events-none bg-slate-400 hover:bg-slate-300 rounded-full p-2"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      class="bi bi-lock-fill group-data-[is-all-locked=true]:block group-data-[is-all-locked=false]:hidden"
      viewBox="0 0 16 16"
    >
      <path
        d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2m3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2"
      />
    </svg>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      class="bi bi-unlock-fill group-data-[is-all-locked=true]:hidden group-data-[is-all-locked=false]:block"
      viewBox="0 0 16 16"
    >
      <path
        d="M11 1a2 2 0 0 0-2 2v4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5V3a3 3 0 0 1 6 0v4a.5.5 0 0 1-1 0V3a2 2 0 0 0-2-2"
      />
    </svg>
  </button> -->

  <!-- text stuff -->
  <!-- bold -->
  <button
    title="Toggle Bold"
    onclick={Interactions.toggleSelectedTextBold}
    class="bg-slate-400 hover:bg-slate-300 rounded-full p-2 hidden group-data-[is-all-text=true]:block"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      class="bi bi-type-bold"
      viewBox="0 0 16 16"
    >
      <path
        d="M8.21 13c2.106 0 3.412-1.087 3.412-2.823 0-1.306-.984-2.283-2.324-2.386v-.055a2.176 2.176 0 0 0 1.852-2.14c0-1.51-1.162-2.46-3.014-2.46H3.843V13zM5.908 4.674h1.696c.963 0 1.517.451 1.517 1.244 0 .834-.629 1.32-1.73 1.32H5.908V4.673zm0 6.788V8.598h1.73c1.217 0 1.88.492 1.88 1.415 0 .943-.643 1.449-1.832 1.449H5.907z"
      />
    </svg>
  </button>
  <!-- italic -->
  <button
    title="Toggle Italic"
    onclick={Interactions.toggleSelectedTextItalic}
    class="bg-slate-400 hover:bg-slate-300 rounded-full p-2 hidden group-data-[is-all-text=true]:block"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      class="bi bi-type-italic"
      viewBox="0 0 16 16"
    >
      <path
        d="M7.991 11.674 9.53 4.455c.123-.595.246-.71 1.347-.807l.11-.52H7.211l-.11.52c1.06.096 1.128.212 1.005.807L6.57 11.674c-.123.595-.246.71-1.346.806l-.11.52h3.774l.11-.52c-1.06-.095-1.129-.211-1.006-.806z"
      />
    </svg>
  </button>
  <!-- the text colour -->
  <label
    title="Font Colour"
    style="background-color: var(--collective-font-color)"
    for="text-colour-picker-hidden"
    class="hidden group-data-[is-all-text=true]:flex w-[30px] h-[30px] rounded-full items-center justify-around cursor-pointer"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      fill="currentColor"
      class="bi bi-type mix-blend-difference fill-white"
      viewBox="0 0 16 16"
    >
      <path
        d="m2.244 13.081.943-2.803H6.66l.944 2.803H8.86L5.54 3.75H4.322L1 13.081zm2.7-7.923L6.34 9.314H3.51l1.4-4.156zm9.146 7.027h.035v.896h1.128V8.125c0-1.51-1.114-2.345-2.646-2.345-1.736 0-2.59.916-2.666 2.174h1.108c.068-.718.595-1.19 1.517-1.19.971 0 1.518.52 1.518 1.464v.731H12.19c-1.647.007-2.522.8-2.522 2.058 0 1.319.957 2.18 2.345 2.18 1.06 0 1.716-.43 2.078-1.011zm-1.763.035c-.752 0-1.456-.397-1.456-1.244 0-.65.424-1.115 1.408-1.115h1.805v.834c0 .896-.752 1.525-1.757 1.525"
      />
    </svg>
  </label>
  <input
    id="text-colour-picker-hidden"
    type="color"
    class="invisible w-0 h-0 !-mr-[8px]"
    oninput={(e) => Interactions.changeTextColor(e)}
  />

  <!-- the text background colour -->
  <label
    title="Background Colour"
    style="background-color: var(--collective-background-color)"
    for="bg-colour-picker-hidden"
    class="hidden group-data-[is-all-text=true]:flex w-[30px] h-[30px] rounded-full items-center justify-around cursor-pointer"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      class="bi bi-front mix-blend-difference fill-white"
      viewBox="0 0 16 16"
    >
      <path
        d="M0 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2H2a2 2 0 0 1-2-2zm5 10v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2v5a2 2 0 0 1-2 2z"
      />
    </svg>
  </label>
  <input
    id="bg-colour-picker-hidden"
    type="color"
    class="invisible w-0 h-0 !-mr-[8px]"
    oninput={(e) => Interactions.changeTextBackgroundColor(e)}
  />
</div>
