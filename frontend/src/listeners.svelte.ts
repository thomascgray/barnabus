import { appState, dom, exportObject } from "./global.svelte";
import * as Utils from "./utils.svelte";
import { CLASSES } from "./config.svelte";
import * as Interactions from "./interactions.svelte";
import * as ConnectionManager from "./ConnectionManager.svelte";
import { uploadImage } from "./uploads.svelte";
import { createImageElement, createTextElement } from "./factories.svelte";
import {
  performSelectedObjectsChangedUpdate,
  ui_popoverMenu,
} from "./ui_updaters.svelte";
import { toast } from "./toast.svelte";

let cameraZ = 1;
import {
  srcToWebP,
  blobToWebP,
  arrayBufferToWebP,
} from "webp-converter-browser";
import { ePenTool, eTool } from "./types";

export const preMouseDown = (e: MouseEvent) => {
  appState.isLeftMouseButtonDown = e.button === 0;
  appState.isMiddleMouseButtonDown = e.button === 1;
  appState.isRightMouseButtonDown = e.button === 2;
  appState.lastMouseDownScreenPos.x = e.clientX;
  appState.lastMouseDownScreenPos.y = e.clientY;

  appState.lastMouseDownCanvasPos = Utils.screenToCanvas(
    e.clientX,
    e.clientY,
    Number(dom.camera.dataset.x),
    Number(dom.camera.dataset.y),
    Number(dom.camera.dataset.z)
  );

  appState.lastMouseDownCameraZ = Number(dom.camera.dataset.z);
};

export const postMouseUp = (e: MouseEvent) => {
  switch (e.button) {
    case 0:
      appState.isLeftMouseButtonDown = false;
      break;
    case 1:
      appState.isMiddleMouseButtonDown = false;
      break;
    case 2:
      appState.isRightMouseButtonDown = false;
      break;
    default:
      break;
  }
  appState.hasMovedItems = false;
  appState.isDraggingObjects = false;

  appState.hasBrokenDampening = false;
  appState.previousSelectionSelectedObjects = appState.selectedObjects;
};

export const mouse_DOWN = (e: MouseEvent) => {
  // if the dialog is open, return out
  if (dom.dialogObjectImage.open) {
    return;
  }

  const clickedElement = document.elementFromPoint(
    e.clientX,
    e.clientY
  ) as HTMLElement;

  if (dom.leftToolbarMenu.contains(clickedElement)) {
    return;
  } else {
    // we've NOT clicked on the left toolbar, so we need to blur the active element
    (document.activeElement as HTMLElement)?.blur();
  }

  // if we just clicked on a text box and the text box is focused, return out
  if (
    clickedElement.classList.contains(CLASSES.TEXT_OBJECT) &&
    document.activeElement === clickedElement
  ) {
    return;
  }

  preMouseDown(e);

  e.preventDefault();
  e.stopPropagation();

  if (appState.isLeftMouseButtonDown) {
    // drawing — the pencil always draws, even when the click lands on the
    // background. This MUST come before the camera/background branch below,
    // which starts a selection-box drag for ANY tool that clicks the
    // background and would otherwise swallow the mousedown — leaving
    // startDrawing uncalled and shapes drawing from a stale origin.
    if (appState.currentTool === eTool.pencil) {
      Interactions.startDrawing(e);
      return;
    }

    // clicking on the selection box (this can only happen when we've already selected some objects remember)
    if (
      appState.currentTool === eTool.cursor &&
      clickedElement?.id === dom.selectedObjectsWrapper.id
    ) {
      Interactions.mouseDownOnSelectedObjectsWrapper(e);
      Interactions.startDraggingObjects(e);
      return;
    }

    // clicking on an object
    if (
      appState.currentTool === eTool.cursor &&
      clickedElement?.classList.contains(CLASSES.OBJECT)
    ) {
      if (clickedElement.dataset.isLocked === "true" && !e.ctrlKey) {
        if (appState.currentTool === eTool.cursor) {
          // also here we want to start a selection box drag
          Interactions.startDraggingSelectionBox(e);
          return;
        }
        // if we've jsut clicked on a locked object, then it SHOULD start the selection box drag under the right circumstances
        return;
      }

      Interactions.mouseDownOnObject(e, clickedElement.id);
      Interactions.startDraggingObjects(e);
      return;
    }

    // camera or background
    if (
      (appState.currentTool === eTool.cursor &&
        clickedElement?.id === dom.camera.id) ||
      clickedElement?.id === dom.background.id
    ) {
      // also here we want to start a selection box drag
      Interactions.startDraggingSelectionBox(e);
      return;
    }

    // resizing
    if (
      appState.currentTool === eTool.cursor &&
      clickedElement?.id === dom.selectedObjectsResizeHandleBR.id
    ) {
      Interactions.resizeFunctions.startResizingBR(e);
      return;
    }
    if (
      appState.currentTool === eTool.cursor &&
      clickedElement?.id === dom.selectedObjectsResizeHandleMR.id
    ) {
      Interactions.resizeFunctions.startResizingMR(e);
      return;
    }

    // the middle resize, todo
    if (
      appState.currentTool === eTool.cursor &&
      clickedElement?.id === dom.selectedObjectsResizeHandleMR.id
    ) {
      // TODO
    }

    if (appState.currentTool === eTool.measuring) {
      Interactions.startMeasuring(e);
      return;
    }
  }

  if (appState.isMiddleMouseButtonDown) {
    // middle mouse - we're always panning
    Interactions.startPan(e);
  }
};

export const mouse_MOVE = (e: MouseEvent) => {
  if (dom.dialogObjectImage.open) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  // if we're moving the mouse and the middle button is down, we're ALWAYS panning
  if (appState.isMiddleMouseButtonDown) {
    Interactions.doPan(e);
    return;
  }

  if (appState.isLeftMouseButtonDown && appState.isResizingBR) {
    Interactions.resizeFunctions.moveWhileResizingBR(e);
    return;
  }
  if (appState.isLeftMouseButtonDown && appState.isResizingMR) {
    Interactions.resizeFunctions.moveWhileResizingMR(e);
    return;
  }

  // we're drawing
  if (appState.isLeftMouseButtonDown && appState.currentTool === "pencil") {
    if (
      appState.penCurrentTool === ePenTool.square ||
      appState.penCurrentTool === ePenTool.circle ||
      appState.penCurrentTool === ePenTool.triangle ||
      appState.penCurrentTool === ePenTool.line
    ) {
      Interactions.moveWhileDrawingShape(e);
    } else {
      Interactions.moveWhileDrawing(e);
    }
    return;
  }

  if (appState.isLeftMouseButtonDown && appState.currentTool === "measuring") {
    Interactions.moveWhileMeasuring(e);
    return;
  }

  // move objects
  if (
    appState.isLeftMouseButtonDown &&
    appState.selectedObjects.length > 0 &&
    !appState.isDraggingSelectionBox
  ) {
    Interactions.moveWhileDraggingObjects(e);
  }

  // we're dragging a selection box
  if (
    appState.isLeftMouseButtonDown &&
    // appState.selectedObjects.length <= 0 &&
    appState.isDraggingSelectionBox === true
  ) {
    const mousePoint = Utils.screenToCanvas(
      e.clientX,
      e.clientY,
      Number(dom.camera.dataset.x),
      Number(dom.camera.dataset.y),
      Number(dom.camera.dataset.z)
    );

    const x = Math.min(mousePoint.x, appState.lastMouseDownCanvasPos.x);
    const y = Math.min(mousePoint.y, appState.lastMouseDownCanvasPos.y);
    const width = Math.abs(mousePoint.x - appState.lastMouseDownCanvasPos.x);
    const height = Math.abs(mousePoint.y - appState.lastMouseDownCanvasPos.y);

    dom.selectionBox.style.display = "block";
    dom.selectionBox.style.transform = `translate(${x}px, ${y}px)`;
    dom.selectionBox.style.width = `${width}px`;
    dom.selectionBox.style.height = `${height}px`;
  }
};

export const mouse_UP = (e: MouseEvent) => {
  dom.selectedObjectsWrapper.classList.remove("cursor-grabbing");
  dom.selectedObjectsWrapper.classList.add("cursor-grab");

  const mouseUpElement = document.elementFromPoint(e.clientX, e.clientY);

  // weve finished drawing
  if (appState.isLeftMouseButtonDown && appState.currentTool === eTool.pencil) {
    Interactions.endDrawing(e);
  }

  // we're placing a text object
  if (appState.isLeftMouseButtonDown && appState.currentTool === eTool.text) {
    Interactions.placeTextObject(e);
  }

  // if we've just finished dragging some objects around
  if (appState.isLeftMouseButtonDown && appState.isDraggingObjects) {
    Interactions.endDraggingObjects(e);
  }

  // we've just finished dragging a selection box, so we need to select some items now
  if (appState.isLeftMouseButtonDown && appState.isDraggingSelectionBox) {
    Interactions.endDraggingSelectionBoxDrag(e);
    dom.objectsContainer.style.pointerEvents = "auto";
  }

  // if we've just finished resizing
  if (appState.isLeftMouseButtonDown && appState.isResizingBR) {
    Interactions.resizeFunctions.endResizingBR(e);
  }
  if (appState.isLeftMouseButtonDown && appState.isResizingMR) {
    Interactions.resizeFunctions.endResizingMR(e);
  }

  if (appState.isLeftMouseButtonDown && appState.currentTool === "measuring") {
    Interactions.endMeasuring(e);
  }

  // if we've just finished panning
  if (appState.isMiddleMouseButtonDown) {
    Interactions.endPan(e);
  }

  performSelectedObjectsChangedUpdate();
  ui_popoverMenu();

  if (mouseUpElement?.id === "selectedItemsWrapper") {
    Interactions.mouseUpOnSelectItemsWrapper(e);
  }

  postMouseUp(e);
};

export const storeSelectedElementsOriginalPositions = () => {
  for (let elem of appState.selectedObjects) {
    appState.selectedElementsOriginalPositions[elem.id] = {
      x: Number(elem.dataset.x),
      y: Number(elem.dataset.y),
    };
  }
};

export const calculateSelectedItemsBoundingBox = () => {
  // Calculate the bounding box of all the selected elements
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  if (appState.selectedObjects.length === 0) {
    dom.selectedObjectsWrapper.style.display = "none";
    dom.selectedObjectsResizeHandleBR.style.display = "none";
    dom.selectedObjectsResizeHandleMR.style.display = "none";
    return;
  }

  for (let elem of appState.selectedObjects) {
    const elemX = Number(elem.dataset.x);
    const elemY = Number(elem.dataset.y);

    const elemWidth = Number(elem.dataset.width);
    const elemHeight = Number(elem.dataset.height);

    minX = Math.min(minX, elemX);
    minY = Math.min(minY, elemY);
    maxX = Math.max(maxX, elemX + elemWidth);
    maxY = Math.max(maxY, elemY + elemHeight);
  }

  let width = maxX - minX;
  let height = maxY - minY;

  dom.selectedObjectsWrapper.style.display = "block";
  dom.selectedObjectsWrapper.style.transform = `translate(${minX}px, ${minY}px)`;
  dom.selectedObjectsWrapper.dataset.x = String(minX);
  dom.selectedObjectsWrapper.dataset.y = String(minY);
  dom.selectedObjectsWrapper.style.width = `${width}px`;
  dom.selectedObjectsWrapper.style.height = `${height}px`;

  dom.selectedObjectsWrapper.dataset.width = String(width);
  dom.selectedObjectsWrapper.dataset.height = String(height);

  // TODO rewrite so somehow the sizing handles are "inside" the selected objects wrapper, so i can just
  // scale/move them relative to that and it all takes care of itself
  dom.selectedObjectsResizeHandleBR.style.display = "block";
  dom.selectedObjectsResizeHandleBR.style.transform = `translate(${maxX}px, ${maxY}px)`;
  dom.selectedObjectsResizeHandleBR.dataset.x = String(maxX);
  dom.selectedObjectsResizeHandleBR.dataset.y = String(maxY);

  if (
    appState.selectedObjects.every((el) =>
      el.classList.contains(CLASSES.TEXT_OBJECT)
    )
  ) {
    dom.selectedObjectsResizeHandleMR.style.display = "block";
    dom.selectedObjectsResizeHandleMR.style.transform = `translate(${maxX}px, ${
      maxY - height / 2
    }px)`;
    dom.selectedObjectsResizeHandleMR.dataset.x = String(maxX);
    dom.selectedObjectsResizeHandleMR.dataset.y = String(maxY - height / 2);
  } else {
    dom.selectedObjectsResizeHandleMR.style.display = "none";
  }
};

export const onWheel = (e: WheelEvent) => {
  // @ts-ignore
  e.preventDefault();
  e.stopPropagation();

  if (appState.isTrackpad === null) {
    const maxDeltaValue = Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY));
    appState.isTrackpad = maxDeltaValue > 0 && maxDeltaValue < 30;
  }

  if (appState.isTrackpad) {
    // this means we're on a trackpad and zooming, and if we're holding the ctrl key we're definitely zoomming
    if (!Number.isInteger(e.deltaY) || e.metaKey || e.altKey) {
      if (Math.sign(e.deltaY) === 1) {
        performCameraZoom(e.clientX, e.clientY, e.metaKey || e.altKey ? 6 : 3);
      } else {
        performCameraZoom(
          e.clientX,
          e.clientY,
          e.metaKey || e.altKey ? -6 : -3
        );
      }
    }
    // otherwise, we're panning
    else {
      const [x, y, z] = Utils.getDomElementTransformAsNumbers(dom.camera);
      const newX = x + (e.deltaX * -1) / z;
      const newY = y + (e.deltaY * -1) / z;
      dom.camera.style.transform = `scale(${z}) translate(${newX}px, ${newY}px)`;
      dom.camera.dataset.x = String(newX);
      dom.camera.dataset.y = String(newY);
      dom.camera.dataset.z = String(z);
      e.preventDefault();
      e.stopPropagation();
      ui_popoverMenu();
    }
  } else {
    if (Math.sign(e.deltaY) === 1) {
      performCameraZoom(e.clientX, e.clientY, 20);
    } else {
      performCameraZoom(e.clientX, e.clientY, -20);
    }
  }
};

const performUIStyleUpdatesForCameraZoom = () => {
  dom.selectionBox.style.borderWidth = `${4 / cameraZ}px`;
  dom.selectedObjectsWrapper.style.outlineWidth = `${4 / cameraZ}px`;
  dom.selectedObjectsWrapper.style.outlineOffset = `${4 / cameraZ}px`;
  dom.selectedObjectsResizeHandleBR.style.width = `${12 / cameraZ}px`;
  dom.selectedObjectsResizeHandleBR.style.height = `${12 / cameraZ}px`;
  dom.selectedObjectsResizeHandleBR.style.outlineWidth = `${4 / cameraZ}px`;

  dom.selectedObjectsResizeHandleMR.style.width = `${12 / cameraZ}px`;
  dom.selectedObjectsResizeHandleMR.style.height = `${12 / cameraZ}px`;
  dom.selectedObjectsResizeHandleMR.style.outlineWidth = `${4 / cameraZ}px`;

  // Resize the brush cursor to match the new zoom (its diameter is penSize ×
  // zoom). camera z isn't reactive state, so this is the imperative hook.
  Interactions.updatePenCursor();
};

const performCameraZoom = (xPos: number, yPos: number, distance: number) => {
  const [x, y, z] = Utils.getDomElementTransformAsNumbers(dom.camera);

  const newCamera = Utils.calculateNewCamera(
    x,
    y,
    z,
    { x: xPos, y: yPos },
    distance / 100
  );

  const newTransform = `scale(${newCamera.z}) translate(${newCamera.x}px, ${newCamera.y}px)`;
  dom.camera.style.transform = newTransform;

  dom.camera.dataset.x = String(newCamera.x);
  dom.camera.dataset.y = String(newCamera.y);
  dom.camera.dataset.z = String(newCamera.z);
  cameraZ = newCamera.z;

  performUIStyleUpdatesForCameraZoom();
  ui_popoverMenu();
};

// this fires BEFORE the textarea key down event
export const key_DOWN = (e: KeyboardEvent) => {
  if (dom.dialogObjectImage.open) {
    return;
  }

  // The image modal owns the keyboard while it's open (typing a URL, its own
  // Enter/Escape), so canvas shortcuts must not fire underneath it.
  if (appState.isImageModalOpen) {
    return;
  }

  if (dom.leftToolbarMenu.contains(document.activeElement)) {
    return;
  }

  // if we currently have 1 text box selected and its focussed, return
  if (
    appState.selectedObjects.length === 1 &&
    appState.selectedObjects[0].classList.contains(CLASSES.TEXT_OBJECT) &&
    appState.selectedObjects[0] === document.activeElement
  ) {
    return;
  }
  if (e.key === "Escape") {
    Interactions.deselectObjects();
  }
  if (e.key === "Backspace" || e.key === "Delete") {
    Interactions.deleteSelectedObjects();
  }
  if (e.key === "<") {
    Interactions.bringObjectsToFront(
      Array.from(document.querySelectorAll(`.${CLASSES.OBJECT}.selected`))
    );
  }
  if (e.key === ">") {
    Interactions.sendObjectsToBack(
      Array.from(document.querySelectorAll(`.${CLASSES.OBJECT}.selected`))
    );
  }
  if (e.key === "1") {
    Interactions.setActiveTool(eTool.cursor);
  }
  if (e.key === "2") {
    Interactions.setActiveTool(eTool.pencil);
  }
  if (e.key === "3") {
    Interactions.openImageModal();
  }
  if (e.key === "4") {
    Interactions.setActiveTool(eTool.text);
  }
  if (e.key === "f") {
    // TODO need to make this faster
    // if (appState.selectedElements.length >= 1) {
    //   e.preventDefault();
    //   e.stopPropagation();
    //   flipImage(appState.selectedElements);
    // }
  }

  if (e.key === "g") {
    if (appState.selectedObjects.length >= 1) {
      e.preventDefault();
      e.stopPropagation();
      Interactions.toggleGrid(appState.selectedObjects);
    }
  }
  if (e.key === "+") {
    if (appState.selectedObjects.length >= 1) {
      e.preventDefault();
      e.stopPropagation();
      Interactions.increaseGridSize(appState.selectedObjects);
    }
  }

  if (e.key === "d" || e.key === "D") {
    if (appState.selectedObjects.length >= 1) {
      e.preventDefault();
      e.stopPropagation();
      Interactions.duplicateSelectedObjects();
    }
  }

  if (e.key === "l" || e.key === "L") {
    if (appState.selectedObjects.length >= 1) {
      e.preventDefault();
      e.stopPropagation();
      Interactions.toggleLock();
    }
  }

  if (e.key === "t" || e.key === "T") {
    if (appState.selectedObjects.length >= 1) {
      e.preventDefault();
      e.stopPropagation();
      Interactions.toggleIsToken();
    }
  }
};

// Marker tagging our serialized objects on the clipboard, so paste can tell our
// payload apart from arbitrary copied text/images.
const CLIPBOARD_MARKER = "barnabus/objects";

// ctrl+c: copy the selected on-canvas objects (any type, any number) to the
// clipboard as serialized JSON. Without this, ctrl+v just re-pasted whatever
// image was in the OS clipboard — so only single images ever "pasted".
export const onCopy = (e: ClipboardEvent) => {
  // If a text object is focused/being edited, let the browser copy its text.
  if (
    appState.selectedObjects.length === 1 &&
    appState.selectedObjects[0].classList.contains(CLASSES.TEXT_OBJECT) &&
    document.activeElement === appState.selectedObjects[0]
  ) {
    return;
  }
  if (appState.selectedObjects.length === 0) return;

  e.preventDefault();
  const payload = {
    __type: CLIPBOARD_MARKER,
    objects: appState.selectedObjects.map((el) => exportObject(el)),
  };
  e.clipboardData?.setData("text/plain", JSON.stringify(payload));
};

// If the clipboard holds our serialized objects, recreate them and return true.
const tryPasteBarnabusObjects = (e: ClipboardEvent): boolean => {
  const plain = e.clipboardData?.getData("text/plain");
  if (!plain) return false;
  try {
    const parsed = JSON.parse(plain);
    if (parsed?.__type === CLIPBOARD_MARKER && Array.isArray(parsed.objects)) {
      Interactions.spawnObjectsFromExports(parsed.objects);
      const n = parsed.objects.length;
      toast(`Pasted ${n} object${n > 1 ? "s" : ""}`, "success");
      return true;
    }
  } catch {
    // not our payload — fall through to OS image/text handling
  }
  return false;
};

// Downscale a loaded image to a tiny thumbnail data URL for the instant blurry
// preview other clients see while the real upload is in flight (issue #13).
// Kept very small (longest side ~24px) so it's only a few hundred bytes on the
// wire; the receiver blurs it to hide the pixelation.
const makeBlurryThumbnailDataUrl = (
  image: HTMLImageElement,
  width: number,
  height: number
): string => {
  const MAX = 24;
  const scale = Math.min(MAX / width, MAX / height, 1);
  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(image, 0, 0, tw, th);
  return canvas.toDataURL("image/jpeg", 0.5);
};

// Shared pipeline for adding an image from a Blob (paste or drag-and-drop):
// convert to WebP → show instant local preview → upload to our backend →
// swap in the returned URL → broadcast/persist as addItem (with the URL, never
// the transient base64). On upload failure, the local preview is removed.
//
// Issue #13 — loading feedback while the upload is in flight:
//  - the uploader's own copy is dimmed/pulsing (CLASSES.IMAGE_UPLOADING),
//  - everyone else gets an instant blurry placeholder at the right size via a
//    broadcast-only `imagePreview` packet (never persisted; the real image
//    follows as the addItem below, or is cleaned up with removeItem on failure).
export const addImageFromBlob = async (
  blob: Blob,
  screenX: number,
  screenY: number
) => {
  // base64 for an instant local preview + to read the natural dimensions.
  const base64String: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target?.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("not a valid image"));
    img.src = base64String;
  });
  const { width, height } = image;

  const webpBlob = await blobToWebP(blob, { width, height });

  const spawnPoint = Utils.screenToCanvas(
    screenX,
    screenY,
    Number(dom.camera.dataset.x),
    Number(dom.camera.dataset.y),
    Number(dom.camera.dataset.z)
  );
  const x = spawnPoint.x - width / 2;
  const y = spawnPoint.y - height / 2;

  // Instant local feedback with the base64; we swap in the URL once uploaded.
  const el = createImageElement({ src: base64String, width, height, x, y });
  // Mark our own copy as still-uploading (dimmed/pulsing) until it's synced.
  el.classList.add(CLASSES.IMAGE_UPLOADING);

  // Give everyone else an instant blurry placeholder at the right size/position,
  // before the upload finishes. Broadcast-only — the relay never persists it.
  const thumbnail = makeBlurryThumbnailDataUrl(image, width, height);
  if (thumbnail) {
    ConnectionManager.sendMessage({
      type: "imagePreview",
      payload: { id: el.id, src: thumbnail, x, y, width, height },
    });
  }

  try {
    const url = await uploadImage(webpBlob);
    el.style.backgroundImage = `url(${url})`;
    el.dataset.src = url;
    el.classList.remove(CLASSES.IMAGE_UPLOADING);
    // Only now sync — so the persisted/broadcast src is the URL, not the blob.
    // Others swap their blurry placeholder for this real image (same id).
    ConnectionManager.sendMessage({
      type: "addItem",
      payload: { object: exportObject(el) },
    });
    toast("Image added", "success");
  } catch (err) {
    console.error("Image upload failed", err);
    toast("Image upload failed", "error");
    el.remove();
    // Tell everyone else to drop the blurry placeholder we asked them to show.
    if (thumbnail) {
      ConnectionManager.sendMessage({
        type: "removeItem",
        payload: { id: el.id },
      });
    }
  }
};

// Allow dropping files onto the canvas (without this the browser navigates to
// the dropped file).
export const onDragOver = (e: DragEvent) => {
  e.preventDefault();
};

// Drag-and-drop image upload: route each dropped image file through the same
// convert → upload → addItem pipeline as paste, spawning at the drop point.
export const onDrop = (e: DragEvent) => {
  e.preventDefault();
  // When the image modal is open it handles drops itself; bail so we don't also
  // drop a copy onto the canvas behind it. (preventDefault above still runs so
  // the browser doesn't navigate to a file dropped on the backdrop.)
  if (appState.isImageModalOpen) {
    return;
  }
  const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
    f.type.startsWith("image/")
  );
  for (const file of files) {
    addImageFromBlob(file, e.clientX, e.clientY);
  }
};

export const onPaste = async (e: ClipboardEvent) => {
  // The image modal handles its own paste (e.g. pasting a URL into its input),
  // so don't hijack the clipboard while it's open.
  if (appState.isImageModalOpen) {
    return;
  }
  // if we're focused in a text box, return - let the browser handle it
  if (
    appState.selectedObjects.length === 1 &&
    appState.selectedObjects[0].classList.contains(CLASSES.TEXT_OBJECT) &&
    document.activeElement === appState.selectedObjects[0]
  ) {
    return;
  }
  if (dom.leftToolbarMenu.contains(document.activeElement)) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  // Our own copied objects take priority over OS image/text handling.
  if (tryPasteBarnabusObjects(e)) {
    return;
  }

  const clipboardItems = e.clipboardData?.items;

  if (!clipboardItems) {
    return; // Exit if clipboard data is not available
  }

  const imagesFromClipboard = Array.from(clipboardItems).filter(
    (item) => item.type.indexOf("image") === 0
  );

  const textFromClipboard = Array.from(clipboardItems).filter(
    (item) => item.type.indexOf("text") === 0
  );

  for (const item of imagesFromClipboard) {
    const blob = item.getAsFile();
    if (!blob) {
      return; // Exit if we cannot get a file from the clipboard item
    }
    // Paste spawns at the centre of the screen.
    addImageFromBlob(blob, window.innerWidth / 2, window.innerHeight / 2);
  }

  if (imagesFromClipboard.length === 0 && textFromClipboard.length === 1) {
    // we've just got one, just use it
    toast("Created text from clipboard", "success");
    const spawnPoint = Utils.screenToCanvas(
      window.innerWidth / 2,
      window.innerHeight / 2,
      Number(dom.camera.dataset.x),
      Number(dom.camera.dataset.y),
      Number(dom.camera.dataset.z)
    );
    // this seems to be the scenario for when we've copied something from a website and it comes with a bunch of meta data.
    // in this case, only make the text element for the first one
    textFromClipboard[0].getAsString((text) => {
      createTextElement({
        text,
        x: spawnPoint.x,
        y: spawnPoint.y,
        shouldAdjustY: true,
        focusOnCreation: true,
      });
    });
  }
  if (imagesFromClipboard.length === 0 && textFromClipboard.length === 2) {
    toast("Created text from clipboard", "success");
    const spawnPoint = Utils.screenToCanvas(
      window.innerWidth / 2,
      window.innerHeight / 2,
      Number(dom.camera.dataset.x),
      Number(dom.camera.dataset.y),
      Number(dom.camera.dataset.z)
    );
    // this seems to be the scenario for when we've copied something from a website and it comes with a bunch of meta data.
    // in this case, only make the text element for the first one
    textFromClipboard[0].getAsString((text) => {
      createTextElement({
        text,
        x: spawnPoint.x,
        y: spawnPoint.y,
        shouldAdjustY: true,
        focusOnCreation: true,
      });
    });
  }
};

export const handler_clickPenColourSelector = (
  e: MouseEvent,
  color: string
) => {
  e.preventDefault();
  e.stopPropagation();
  dom.drawingSvgPath.style.fill = color;
  dom.drawingSvgPath.style.stroke = color;
};
