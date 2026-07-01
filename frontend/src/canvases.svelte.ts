// Multiple canvases per board/room (issue #26). A board holds many canvases; the
// boards bar lets you switch between them, create, rename, and delete them. This
// module owns the *client actions* (switch/create/rename/delete) and the
// receive-side applier for the server's `canvasState`.
//
// The canvas list + which canvas is active live on `cmState` (ConnectionManager)
// so the boards bar reacts to them. Objects themselves stay DOM-as-state (see
// CLAUDE.md): switching a canvas clears the current DOM objects and imports the
// incoming canvas's set — there is no reactive object store.
//
// Why a separate module and not ConnectionManager: these actions need to clear
// the current selection (interactions.svelte), and ConnectionManager must not
// import interactions at eval time. Keeping the actions here and having CM import
// only `applyCanvasState` keeps the dependency runtime-only.
import { nanoid } from "nanoid";
import { clearObjects, importObjects } from "./global.svelte";
import { cmState, sendMessage } from "./ConnectionManager.svelte";
import { deselectObjects } from "./interactions.svelte";
import type * as Types from "../../types";

// Drop the current selection + wipe the DOM objects. Shared by every canvas
// change so no stale selection chrome or object element survives the swap.
const teardownCurrentCanvas = () => {
  deselectObjects();
  clearObjects();
};

// Receive-side: the server told us which canvas we're now viewing and handed us
// its objects. Clear whatever's on screen and import the new set. Called from
// ConnectionManager's inbound switch (switch/create result, or a forced move off
// a deleted canvas).
export const applyCanvasState = (payload: {
  canvasId: string;
  boardInformation: Record<string, Types.Object>;
}) => {
  teardownCurrentCanvas();
  cmState.activeCanvasId = payload.canvasId;
  importObjects(JSON.stringify(Object.values(payload.boardInformation)));
};

// Switch to another canvas in this board. Optimistically clears the current view
// (instant feedback); the server replies with a `canvasState` carrying the target
// canvas's objects. No-op if we're already there.
export const switchCanvas = (canvasId: string) => {
  if (!cmState.boardId) return;
  if (canvasId === cmState.activeCanvasId) return;
  teardownCurrentCanvas();
  cmState.activeCanvasId = canvasId;
  sendMessage({ type: "switchCanvas", canvasId });
};

// Create a new (empty) canvas and switch to it. The id is minted here (like
// object ids) so we own it immediately; the server persists it, moves us onto it
// (via canvasState), and broadcasts the new list to the room. We optimistically
// append + switch so it feels instant; the server's canvasList reconciles.
export const createCanvas = (name?: string) => {
  if (!cmState.boardId) return;
  const canvasId = nanoid();
  const canvasName = (name ?? "").trim() || defaultCanvasName();
  cmState.canvases = [...cmState.canvases, { id: canvasId, name: canvasName }];
  teardownCurrentCanvas();
  cmState.activeCanvasId = canvasId;
  sendMessage({ type: "createCanvas", canvasId, name: canvasName });
};

// A sensible unique-ish default name for a freshly created canvas ("Board N").
const defaultCanvasName = () => `Board ${cmState.canvases.length + 1}`;

// Rename a canvas. Optimistically updates the local list; the server confirms
// with an authoritative canvasList.
export const renameCanvas = (canvasId: string, name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return;
  cmState.canvases = cmState.canvases.map((c) =>
    c.id === canvasId ? { ...c, name: trimmed } : c
  );
  sendMessage({ type: "renameCanvas", canvasId, name: trimmed });
};

// Delete a canvas. Guarded so the first/only canvas can never be removed (the
// server enforces the same rule). If we were viewing it, the server moves us to
// the first canvas via a canvasState.
export const deleteCanvas = (canvasId: string) => {
  if (cmState.canvases.length <= 1) return;
  if (isFirstCanvas(canvasId)) return;
  cmState.canvases = cmState.canvases.filter((c) => c.id !== canvasId);
  sendMessage({ type: "deleteCanvas", canvasId });
};

// The first canvas in display order is the board's default and can't be deleted.
export const isFirstCanvas = (canvasId: string) =>
  cmState.canvases.length > 0 && cmState.canvases[0].id === canvasId;
