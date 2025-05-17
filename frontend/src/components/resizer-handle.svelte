<script lang="ts">
  const {
    id,
    cursorClass,
  }: {
    id: string;
    cursorClass: string;
  } = $props();
</script>

<div
  {id}
  data-x="0"
  data-y="0"
  style="width: 12px; height: 12px; outline-width: 4px"
  class={`hidden absolute top-0 left-0 z-[9999] outline bg-white outline-sky-400 ${cursorClass}`}
></div>
