// Board-view tools (issue #27): the camera/viewport controls that live on the
// top "board tools" bar — zoom indicator + reset, recenter to origin, frame all
// objects, and frame the current selection.
//
// These ONLY touch the local camera (`dom.camera` transform + dataset). Nothing
// here syncs over the wire, so there are no protocol/types.ts changes — each
// client drives its own view independently.
//
// Why a separate module (and not listeners.svelte.ts where the wheel-zoom
// lives): listeners owns the *interactive* pan/zoom path with its own private
// `cameraZ`/UI-sync. These are *programmatic* camera moves that also animate, so
// they get their own self-contained home and re-sync the same camera-dependent
// UI locally. listeners imports this module (for syncZoomIndicator) — keep the
// dependency one-way (this module must NOT import listeners).
import { appState, dom } from "./global.svelte";
import * as Utils from "./utils.svelte";
import * as Interactions from "./interactions.svelte";
import { ui_popoverMenu } from "./ui_updaters.svelte";
import { toast } from "./toast.svelte";

// Must match the clamp used by the interactive wheel-zoom (calculateNewCamera).
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 10;

// Relative zoom change for one `+`/`-` step (button or keyboard). Matches the
// per-notch feel of the mouse-wheel zoom (distance 20 → dz 0.2 in onWheel).
const ZOOM_STEP = 0.2;

// Programmatic camera moves ease instead of teleporting, so "where did my view
// go?" reads as a glide. Matches the easing used for remote object updates.
const ANIM_MS = 320;
const EASING = "cubic-bezier(0.25, 0.1, 0.25, 1)";

// Reactive mirror of the camera zoom for the on-bar indicator. Camera z lives on
// the DOM (dom.camera.dataset.z), which isn't reactive, so we surface it here and
// re-read it whenever the camera changes (here + listeners' wheel-zoom path).
export const boardToolsState = $state({
  zoomPercent: 100,
});

export const syncZoomIndicator = () => {
  const z = Number(dom.camera.dataset.z) || 1;
  boardToolsState.zoomPercent = Math.round(z * 100);
};

// Re-apply the camera-z-dependent UI sizing (selection chrome scales inversely
// with zoom so it stays a constant on-screen thickness) and refresh the indicator
// + popover. Mirrors performUIStyleUpdatesForCameraZoom in listeners, kept local
// to avoid a circular import (see module header).
const syncCameraDependentUI = (z: number) => {
  dom.selectionBox.style.borderWidth = `${4 / z}px`;
  dom.selectedObjectsWrapper.style.outlineWidth = `${4 / z}px`;
  dom.selectedObjectsWrapper.style.outlineOffset = `${4 / z}px`;
  dom.selectedObjectsResizeHandleBR.style.width = `${12 / z}px`;
  dom.selectedObjectsResizeHandleBR.style.height = `${12 / z}px`;
  dom.selectedObjectsResizeHandleBR.style.outlineWidth = `${4 / z}px`;
  dom.selectedObjectsResizeHandleMR.style.width = `${12 / z}px`;
  dom.selectedObjectsResizeHandleMR.style.height = `${12 / z}px`;
  dom.selectedObjectsResizeHandleMR.style.outlineWidth = `${4 / z}px`;
  Interactions.updatePenCursor();
  syncZoomIndicator();
  ui_popoverMenu();
};

// One pending "clear the transition" timer so a new animated move can't have its
// transition wiped early by the previous move's cleanup.
let clearTransitionTimer: ReturnType<typeof setTimeout> | null = null;

// The single funnel for programmatic camera writes. Writes the transform +
// dataset (the source of truth the rest of the app reads) and optionally eases.
const applyCamera = (x: number, y: number, z: number, animateMove: boolean) => {
  if (clearTransitionTimer !== null) {
    clearTimeout(clearTransitionTimer);
    clearTransitionTimer = null;
  }

  if (animateMove) {
    dom.camera.style.transition = `transform ${ANIM_MS}ms ${EASING}`;
    clearTransitionTimer = setTimeout(() => {
      dom.camera.style.transition = "";
      clearTransitionTimer = null;
    }, ANIM_MS);
  } else {
    dom.camera.style.transition = "";
  }

  dom.camera.style.transform = `scale(${z}) translate(${x}px, ${y}px)`;
  dom.camera.dataset.x = String(x);
  dom.camera.dataset.y = String(y);
  dom.camera.dataset.z = String(z);

  syncCameraDependentUI(z);
};

// Place a canvas-space point at the centre of the viewport at zoom `z`.
// Inverse of screenToCanvas at the screen centre: camX = (W/2)/z - pointX.
const centerOnCanvasPoint = (cx: number, cy: number, z: number) => {
  const newX = window.innerWidth / 2 / z - cx;
  const newY = window.innerHeight / 2 / z - cy;
  applyCamera(newX, newY, z, true);
};

// Change zoom to `targetZ` while keeping the canvas point currently under
// (screenX, screenY) pinned there — so a reset-zoom keeps you looking at the
// same thing rather than jumping to the origin.
const zoomAboutScreenPoint = (
  targetZ: number,
  screenX: number,
  screenY: number
) => {
  const x = Number(dom.camera.dataset.x);
  const y = Number(dom.camera.dataset.y);
  const z = Number(dom.camera.dataset.z) || 1;
  const newZ = Utils.util_withMinMax(targetZ, ZOOM_MIN, ZOOM_MAX);
  const anchor = Utils.screenToCanvas(screenX, screenY, x, y, z);
  const newX = screenX / newZ - anchor.x;
  const newY = screenY / newZ - anchor.y;
  applyCamera(newX, newY, newZ, true);
};

interface BoundingBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

// World-space bounding box over a set of object elements, read from their
// data-x/y/width/height (objects ARE the DOM — see CLAUDE.md). Skips any element
// with non-finite geometry; returns null if nothing usable is found.
const getBoundingBox = (els: HTMLElement[]): BoundingBox | null => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of els) {
    const x = Number(el.dataset.x);
    const y = Number(el.dataset.y);
    const w = Number(el.dataset.width);
    const h = Number(el.dataset.height);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(w) ||
      !Number.isFinite(h)
    ) {
      continue;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  if (minX === Infinity) return null;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
};

// Fit a world-space box into the viewport, centred, with a margin.
const frameBox = (box: BoundingBox) => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const MARGIN = 0.9; // leave ~10% breathing room around the content

  // Guard against a zero-size box (e.g. a single zero-dimension object) so we
  // never divide by zero into an Infinity zoom.
  const bw = Math.max(box.width, 1);
  const bh = Math.max(box.height, 1);

  // The zoom needed to fit the whole box on screen.
  const fitZoom = Math.min(W / bw, H / bh) * MARGIN;

  // Never zoom *in* past 100% when framing — otherwise a single small object
  // slams the camera to max zoom. We only ever zoom out to reveal more.
  let newZ = Math.min(fitZoom, 1);

  // Edge case from the issue: the content is bigger than fits even at the zoom
  // floor. We can't fit it — so clamp to the floor and centre on the box, letting
  // the outer edges overflow, and say so rather than silently cutting it off.
  if (newZ < ZOOM_MIN) {
    newZ = ZOOM_MIN;
    toast("Zoomed out as far as possible — the board is too big to fit fully", "info");
  }

  const cx = box.minX + box.width / 2;
  const cy = box.minY + box.height / 2;
  centerOnCanvasPoint(cx, cy, newZ);
};

// ---- Public operations (wired to the top bar + keyboard shortcuts) ----

// Reset zoom to 100% (z = 1) about the viewport centre, keeping x/y intent so the
// thing you were looking at stays put.
export const resetZoom = () => {
  zoomAboutScreenPoint(1, window.innerWidth / 2, window.innerHeight / 2);
};

// Pan so canvas (0,0) sits at the viewport centre; zoom is left untouched. The
// "I panned off into the void, get me home" button.
export const recenterToOrigin = () => {
  const z = Number(dom.camera.dataset.z) || 1;
  centerOnCanvasPoint(0, 0, z);
};

// Frame every object on the board. With nothing on the board, fall back to
// recenter-at-100% (no bbox to fit).
export const frameAllObjects = () => {
  const box = getBoundingBox(Array.from(dom.objects) as HTMLElement[]);
  if (!box) {
    centerOnCanvasPoint(0, 0, 1);
    return;
  }
  frameBox(box);
};

// Frame the current selection. No-op when nothing is selected (the bar button is
// disabled in that state too).
export const frameSelection = () => {
  if (appState.selectedObjects.length === 0) return;
  const box = getBoundingBox(appState.selectedObjects);
  if (!box) return;
  frameBox(box);
};

// Zoom one step about the viewport centre, easing via the shared animated path.
// Reuses calculateNewCamera (the same delta-zoom math the wheel-zoom uses), so
// the clamp and the keep-the-anchored-point-still behaviour match. `dz > 0`
// zooms out and `dz < 0` zooms in (see calculateNewCamera: z*(1 - dz)).
const stepZoomAboutCentre = (dz: number) => {
  const x = Number(dom.camera.dataset.x);
  const y = Number(dom.camera.dataset.y);
  const z = Number(dom.camera.dataset.z) || 1;
  const centre = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const next = Utils.calculateNewCamera(x, y, z, centre, dz);
  applyCamera(next.x, next.y, next.z, true);
};

// `+` step button / shortcut — zoom in one notch about the viewport centre.
export const zoomIn = () => stepZoomAboutCentre(-ZOOM_STEP);

// `-` step button / shortcut — zoom out one notch about the viewport centre.
export const zoomOut = () => stepZoomAboutCentre(ZOOM_STEP);

// Set an exact zoom % (typed into the indicator) about the viewport centre,
// keeping what you're looking at pinned and easing into the new zoom. The value
// is clamped to the camera-z range; a non-finite value is a no-op so a bad typed
// value falls back to the current zoom (the indicator just re-shows it).
export const setZoomPercent = (percent: number) => {
  if (!Number.isFinite(percent)) return;
  zoomAboutScreenPoint(
    percent / 100,
    window.innerWidth / 2,
    window.innerHeight / 2
  );
};

// Pan so a world-space point sits at the viewport centre, keeping the current
// zoom. Used by the minimap's click/drag-to-jump (animate off so dragging is
// responsive); reuses the same camera funnel + UI re-sync as everything here.
export const jumpToWorldPoint = (
  cx: number,
  cy: number,
  animate = false
) => {
  const z = Number(dom.camera.dataset.z) || 1;
  const newX = window.innerWidth / 2 / z - cx;
  const newY = window.innerHeight / 2 / z - cy;
  applyCamera(newX, newY, z, animate);
};

// Read the current camera transform straight off the DOM (the source of truth).
// Used by per-canvas camera memory (canvases.svelte.ts) to snapshot the view of
// the canvas you're leaving.
export const readCamera = (): { x: number; y: number; z: number } => ({
  x: Number(dom.camera.dataset.x) || 0,
  y: Number(dom.camera.dataset.y) || 0,
  z: Number(dom.camera.dataset.z) || 1,
});

// Set the camera to an exact transform via the same funnel as every other
// programmatic move (writes transform + dataset, re-syncs the zoom indicator and
// selection chrome). `animate` defaults off — restoring a remembered view should
// snap into place, since the canvas's objects were swapped in instantly.
export const setCamera = (
  x: number,
  y: number,
  z: number,
  animate = false
) => {
  applyCamera(x, y, z, animate);
};
