// Uploads a WebP image blob to the backend and returns a same-origin URL to
// store in Object_Image.src. Auth reuses the current board's passphrase (the
// same check as join). Conversion to WebP happens at the call site.
import { cmState } from "./ConnectionManager.svelte";

export const uploadImage = async (webpBlob: Blob): Promise<string> => {
  const boardId = cmState.boardId;
  if (!boardId) throw new Error("not connected to a board");

  const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/images`, {
    method: "POST",
    headers: {
      "Content-Type": "image/webp",
      "X-Board-Passphrase": cmState.passphrase,
    },
    body: webpBlob,
  });

  if (!res.ok) {
    throw new Error(`upload failed (${res.status})`);
  }
  const json = await res.json();
  return json.url as string;
};
