import sft from "svelte-french-toast";

// Issue #16: toasting is delegated to svelte-french-toast. It owns the DOM
// lifecycle of each toast (mount + auto-dismiss + unmount), which also fixes
// the leftover-toast scrollbars from issue #15. The <Toaster /> host lives in
// Container.svelte. We keep this thin `toast(message, type)` wrapper so every
// existing call site stays unchanged; reach for `toastApi` directly when you
// want the richer features (e.g. `toastApi.promise(...)` for image uploads).
export const toastApi = sft;

export const toast = (message: string, type?: "success" | "error" | "info") => {
  switch (type) {
    case "success":
      return sft.success(message);
    case "error":
      return sft.error(message);
    case "info":
    default:
      return sft(message);
  }
};
