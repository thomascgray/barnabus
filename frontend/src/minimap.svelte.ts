// Minimap / corner overview (issue #29, from issue #27 item 5): a small panel in
// the bottom-right that shows every object scaled into the world bounding box,
// plus a rectangle for the current viewport. Click/drag inside it to jump the
// camera there.
//
// Local-camera only — like board_tools it never touches the wire protocol. Each
// client draws its own overview from the DOM (objects ARE the DOM; the camera
// transform lives on dom.camera.dataset — see CLAUDE.md / frontend.md).
//
// Performance: the canvas is redrawn from a single requestAnimationFrame loop
// that is *throttled* to ~10fps and skips the draw entirely when nothing changed
// (cheap signature over object geometry + camera). So a drag/pan/zoom never
// thrashes the minimap, and an idle board does no canvas work at all. We render
// to a <canvas> (not DOM nodes) so hundreds of objects stay cheap.
import { dom } from "./global.svelte";
import * as BoardTools from "./board_tools.svelte";

// Logical (CSS px) size of the minimap drawing surface. The backing store is
// scaled by devicePixelRatio in bindCanvas so it stays crisp on HiDPI.
export const MINIMAP_W = 200;
export const MINIMAP_H = 140;

// Inset so content/viewport never sit flush against the panel edge.
const PADDING = 6;

// Throttle the redraw loop to ~10fps — an overview doesn't need 60fps and this
// keeps it from thrashing during a drag.
const TICK_MS = 100;

// Collapsed state persists per-browser (issue #35) so the minimap stays out of
// the way across reloads, same pattern as barnabus.username / adminName.
const COLLAPSED_KEY = "barnabus.minimapCollapsed";

// Whether there's at least one object to show. The component hides the panel
// when false (issue edge case: hide the minimap on an empty board). `collapsed`
// (issue #35) shrinks the panel to a floating reopen button instead.
export const minimapState = $state({
  hasObjects: false,
  collapsed: localStorage.getItem(COLLAPSED_KEY) === "true",
});

export const setMinimapCollapsed = (collapsed: boolean) => {
  minimapState.collapsed = collapsed;
  localStorage.setItem(COLLAPSED_KEY, String(collapsed));
};

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let rafId: number | null = null;
let lastTick = 0;

// Cheap fingerprint of the last drawn scene; when unchanged we skip the redraw.
let lastSignature = "";

// The world→minimap mapping from the last draw, so pointer handling can invert
// a click/drag back into a world-space point.
let lastTransform: {
  scale: number;
  offsetX: number;
  offsetY: number;
  minX: number;
  minY: number;
} | null = null;

interface Region {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// World region to display = union of every object's box AND the current viewport
// rect, so the viewport rectangle is always within the drawn area even after you
// pan away from all the objects (issue edge case). Returns the region plus a
// running checksum + count used for the redraw fingerprint, and the viewport
// rect (so draw doesn't recompute it).
const computeScene = () => {
  const camX = Number(dom.camera.dataset.x);
  const camY = Number(dom.camera.dataset.y);
  const camZ = Number(dom.camera.dataset.z) || 1;

  // Viewport in world space: screen (0,0)→(W,H) maps to (-camX,-camY) plus the
  // on-screen size divided by zoom (inverse of screenToCanvas at the corners).
  const vpX = -camX;
  const vpY = -camY;
  const vpW = window.innerWidth / camZ;
  const vpH = window.innerHeight / camZ;

  let minX = vpX;
  let minY = vpY;
  let maxX = vpX + vpW;
  let maxY = vpY + vpH;

  const objs = Array.from(dom.objects) as HTMLElement[];
  let count = 0;
  let checksum = 0;
  for (const el of objs) {
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
    count++;
    checksum += x * 0.31 + y * 0.57 + w * 0.13 + h * 0.19;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  const region: Region = { minX, minY, maxX, maxY };
  const signature = `${count}|${camX},${camY},${camZ}|${checksum.toFixed(2)}`;
  return {
    region,
    objs,
    count,
    signature,
    viewport: { x: vpX, y: vpY, w: vpW, h: vpH },
  };
};

const draw = (
  region: Region,
  objs: HTMLElement[],
  viewport: { x: number; y: number; w: number; h: number }
) => {
  if (!canvas || !ctx) return;

  // Fit the world region into the padded panel, preserving aspect ratio.
  const availW = MINIMAP_W - PADDING * 2;
  const availH = MINIMAP_H - PADDING * 2;
  const regW = Math.max(region.maxX - region.minX, 1);
  const regH = Math.max(region.maxY - region.minY, 1);
  const scale = Math.min(availW / regW, availH / regH);
  const offsetX = PADDING + (availW - regW * scale) / 2;
  const offsetY = PADDING + (availH - regH * scale) / 2;

  lastTransform = { scale, offsetX, offsetY, minX: region.minX, minY: region.minY };

  const toMiniX = (wx: number) => (wx - region.minX) * scale + offsetX;
  const toMiniY = (wy: number) => (wy - region.minY) * scale + offsetY;

  ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);

  // Objects. Tiny ones may render sub-pixel at extreme scales (acceptable for an
  // overview), but clamp to >=1px so they don't vanish entirely.
  ctx.fillStyle = "rgba(203, 213, 225, 0.9)"; // slate-300
  for (const el of objs) {
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
    ctx.fillRect(
      toMiniX(x),
      toMiniY(y),
      Math.max(w * scale, 1),
      Math.max(h * scale, 1)
    );
  }

  // Viewport rectangle. Clamp to a minimum size so it stays visible even when
  // zoomed far in on a huge board (issue edge case).
  const vx = toMiniX(viewport.x);
  const vy = toMiniY(viewport.y);
  const vw = Math.max(viewport.w * scale, 6);
  const vh = Math.max(viewport.h * scale, 6);
  ctx.fillStyle = "rgba(250, 204, 21, 0.18)"; // amber-400 fill
  ctx.fillRect(vx, vy, vw, vh);
  ctx.strokeStyle = "rgba(250, 204, 21, 0.95)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vx, vy, vw, vh);
};

const tick = (t: number) => {
  rafId = requestAnimationFrame(tick);
  if (t - lastTick < TICK_MS) return;
  lastTick = t;

  // dom is populated by loadDomIntoMemory on App mount; the loop may start a
  // frame earlier (child onMount runs before parent), so guard.
  if (!dom || !dom.camera || !dom.objects) return;

  const scene = computeScene();
  minimapState.hasObjects = scene.count > 0;
  // Empty board: panel is hidden by the component, so there's nothing to draw.
  if (scene.count === 0) return;
  if (!canvas || !ctx) return; // panel just became visible; canvas binds next frame

  if (scene.signature === lastSignature) return;
  lastSignature = scene.signature;
  draw(scene.region, scene.objs, scene.viewport);
};

// Called by the component once its <canvas> is in the DOM.
export const bindCanvas = (el: HTMLCanvasElement) => {
  canvas = el;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = MINIMAP_W * dpr;
  canvas.height = MINIMAP_H * dpr;
  ctx = canvas.getContext("2d");
  ctx?.scale(dpr, dpr);
  // Force a redraw on (re)bind — the panel may have just reappeared.
  lastSignature = "";
};

export const unbindCanvas = () => {
  canvas = null;
  ctx = null;
};

export const startMinimap = () => {
  if (rafId !== null) return;
  lastTick = 0;
  rafId = requestAnimationFrame(tick);
};

export const stopMinimap = () => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
};

// Convert a click/drag at minimap-local (offsetX, offsetY) into the world point
// it represents, and pan the camera to centre on it. No-op until the first draw
// has established the mapping.
export const jumpFromMinimapPoint = (localX: number, localY: number) => {
  if (!lastTransform) return;
  const { scale, offsetX, offsetY, minX, minY } = lastTransform;
  const wx = (localX - offsetX) / scale + minX;
  const wy = (localY - offsetY) / scale + minY;
  BoardTools.jumpToWorldPoint(wx, wy, false);
  // Reflect the camera move on the next frame without waiting for the throttle
  // window to compare signatures.
  lastSignature = "";
};
