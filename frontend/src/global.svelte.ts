import type { Object } from "../../types";
import { CLASSES } from "./config.svelte";
import {
  createFreehandSvgElement,
  createImageElement,
  createTextElement,
} from "./factories.svelte";
import app from "./main";
import {
  eMeasuringTool,
  ePenTool,
  eTool,
  type iAppState,
  type RollResult,
} from "./types";

export let rollResults = $state<RollResult[]>([]);

export let appState = $state<iAppState>({
  isLeftMouseButtonDown: false,
  isMiddleMouseButtonDown: false,
  isRightMouseButtonDown: false,
  lastMouseDownScreenPos: { x: 0, y: 0 },
  lastMouseDownCanvasPos: { x: 0, y: 0 },
  isDraggingSelectionBox: false,
  leftClickElementId: null,
  selectedElementsOriginalPositions: {},
  currentTool: eTool.cursor,
  penCurrentTool: ePenTool.pen,
  currentMeasuringTool: eMeasuringTool.line,
  canvasDrawingTopLeftPoint: { x: 0, y: 0 },
  canvasDrawingBottomRightPoint: { x: 0, y: 0 },
  penSize: 12,
  penColour: "#000000",
  selectedObjects: [],
  drawingPoints: [],
  isResizingBR: false,
  isResizingMR: false,
  isTrackpad: null,
  zIndexCounter: 0,
  hasMovedItems: false,
  isDraggingObjects: false,
  lastMouseDownCameraZ: 1,
  previousSelectionSelectedObjects: [],
  hasBrokenDampening: false,

  // some measuring stuff
  startMeasuringPoint: null,
  currentMeasuringPoint: null,
});

export let dom: {
  camera: HTMLElement;
  background: HTMLElement;
  objectsContainer: HTMLElement;
  // canvas: HTMLCanvasElement;
  // canvasContext: CanvasRenderingContext2D;
  selectionBox: HTMLElement;
  objects: HTMLCollectionOf<Element>;
  toolbarButtons: HTMLCollectionOf<Element>;

  selectedObjectsWrapper: HTMLElement;
  /**
   * the "middle right" resize handle
   */
  selectedObjectsResizeHandleMR: HTMLElement;
  /**
   * the "bottom right" resize handle
   */
  selectedObjectsResizeHandleBR: HTMLElement;
  drawingSvg: HTMLElement;
  drawingSvgPath: SVGPathElement;
  penToolBarWrapper: HTMLElement;
  dialogObjectImage: HTMLDialogElement;
  popoverMenu: HTMLElement;
  leftToolbarMenu: HTMLElement;
};

export const exportObject = (obj: HTMLElement | SVGElement): Object => {
  const type = obj.dataset.objtype;

  if (type !== "image" && type !== "text" && type !== "svg") {
    throw new Error("Unknown object type");
  }

  switch (type) {
    case "image":
      return {
        id: obj.id,
        type: "image",
        src: obj.dataset.src!,
        x: Number(obj.dataset.x),
        y: Number(obj.dataset.y),
        width: Number(obj.dataset.width),
        height: Number(obj.dataset.height),
        isGrid: obj.dataset.isGrid === "true",
      };
    case "text":
      return {
        id: obj.id,
        type: "text",
        text: (obj as HTMLTextAreaElement).value,
        x: Number(obj.dataset.x),
        y: Number(obj.dataset.y),
        width: Number(obj.dataset.width),
        height: Number(obj.dataset.height),
        fontSize: Number(obj.dataset.fontSize),
        color: obj.dataset.color!,
        backgroundColor: obj.dataset.backgroundColor!,
        scale: Number(obj.dataset.scale),
        isBold: obj.dataset.isBold === "true",
        isItalic: obj.dataset.isItalic === "true",
      };
    case "svg":
      return {
        id: obj.id,
        type: "svg",
        pathValue: obj.children[0].getAttribute("d")!,
        x: Number(obj.dataset.x),
        y: Number(obj.dataset.y),
        width: Number(obj.dataset.width),
        height: Number(obj.dataset.height),
        // The resize scale and colour live on the inner <path>.
        scale: Number((obj.children[0] as HTMLElement).dataset.scale) || 1,
        colour:
          (obj.children[0] as HTMLElement).dataset.colour ||
          (obj.children[0] as HTMLElement).style.fill ||
          "#000000",
      };
  }
};

export const importObject = (json: any) => {
  if (json.type === "image") {
    return createImageElement({
      id: json.id || undefined,
      src: json.src,
      width: json.width,
      height: json.height,
      x: json.x,
      y: json.y,
      isGrid: json.isGrid,
    });
  }
  if (json.type === "text") {
    return createTextElement({
      id: json.id || undefined,
      text: json.text,
      x: json.x,
      y: json.y,
      focusOnCreation: false,
      shouldAdjustY: false,
      fontSize: json.fontSize,
      width: json.width,
      height: json.height,
      color: json.color,
      backgroundColor: json.backgroundColor,
      scale: json.scale,
      isBold: json.isBold,
      isItalic: json.isItalic,
    });
  }
  if (json.type === "svg") {
    return createFreehandSvgElement({
      id: json.id || undefined,
      pathValue: json.pathValue,
      x: json.x,
      y: json.y,
      width: json.width,
      height: json.height,
      scale: json.scale,
      colour: json.colour,
    });
  }
};

// a function that takes all the objects and turns them into json
export const exportObjects = () => {
  const objects = Array.from(dom.objects)
    .map((o) => exportObject(o as HTMLElement))
    .filter((o) => !!o);

  return JSON.stringify(objects);
};

export const importObjects = (json: string) => {
  // todo this needs to do some mad z index shit too to make sure the objects are in the right order
  // maybe everything we import should go on top of everything else? but still be OK relative to itself?
  const jsonObjects: any = JSON.parse(json);

  jsonObjects.forEach((json: any) => {
    importObject(json);
  });
};

// Show a blurry placeholder for an image another client is currently uploading
// (issue #13). It's a normal image element (so it sits at the right size and z
// in the DOM) tagged as a preview: blurred, non-interactive, and replaced by
// the real image when its addItem arrives (see receiveAddItem). Ignored if an
// element with this id already exists (e.g. the real image already landed).
export const showImagePreview = (preview: {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) => {
  if (document.getElementById(preview.id)) return;
  const el = createImageElement({
    id: preview.id,
    src: preview.src,
    width: preview.width,
    height: preview.height,
    x: preview.x,
    y: preview.y,
  });
  el.classList.add(CLASSES.IMAGE_PREVIEW);
  el.dataset.preview = "true";
  // Not a real board object yet — keep it out of selection/drag interactions.
  el.style.pointerEvents = "none";
};

// Apply a remote addItem. Normally this just imports the new object, but if a
// blurry upload placeholder (issue #13) is already standing in for this id, we
// reveal the real image in place — waiting for it to load first so there's no
// blank flash, then transitioning the blur away so it sharpens into focus.
export const receiveAddItem = (obj: Object) => {
  const existing = document.getElementById(obj.id);

  if (existing?.dataset.preview === "true") {
    if (obj.type === "image") {
      const real = new Image();
      const reveal = () => {
        updateObject(obj, false); // real src + final geometry
        existing.style.pointerEvents = "";
        delete existing.dataset.preview;
        // Animate the blur away (the class still supplies the blur(8px) base, so
        // this transitions from 8px → 0). Clear the class + inline styles only
        // once the transition has finished.
        existing.style.transition = "filter 300ms ease-out";
        existing.style.filter = "blur(0px)";
        setTimeout(() => {
          existing.classList.remove(CLASSES.IMAGE_PREVIEW);
          existing.style.transition = "";
          existing.style.filter = "";
        }, 300);
      };
      real.onload = reveal;
      real.onerror = reveal; // swap anyway if the real image fails to preload
      real.src = obj.src;
    } else {
      // Shouldn't happen (previews are image-only) — just apply it.
      updateObject(obj, false);
    }
    return;
  }

  // Defensive: if the id already exists for any other reason, update in place
  // rather than creating a duplicate element with the same id.
  if (existing) {
    updateObject(obj, false);
    return;
  }

  importObject(obj);
};

// Remove a board object's DOM element by id. The bridge counterpart to
// importObject/updateObject, used when another client removes an object.
export const removeObjectById = (id: string) => {
  document.getElementById(id)?.remove();
};

// Tear down every board object in the DOM. Used when switching/leaving a board:
// since objects ARE the DOM (see CLAUDE.md), clearing a board means removing its
// elements before importing the next board's set.
export const clearObjects = () => {
  Array.from(dom.objects).forEach((o) => o.remove());
};

export const createManyImageElements = (num: number) => {
  let rowLength = 50;
  for (let i = 0; i < num; i++) {
    createImageElement({
      src: "https://i.imgur.com/mDI8zsZ.png",
      width: 100,
      height: 100,
      x: (i % rowLength) * 100 + (i % rowLength) * 10,
      y: Math.floor(i / rowLength) * 100 + Math.floor(i / rowLength) * 10,
    });
  }
};

export const loadDomIntoMemory = () => {
  dom = {
    camera: document.getElementById("camera")!,
    background: document.getElementById("background")!,
    selectionBox: document.getElementById("selectionBox")!,
    objects: document.getElementsByClassName(CLASSES.OBJECT)!,
    objectsContainer: document.getElementById("objects")!,
    toolbarButtons: document.getElementsByClassName("toolbar-button")!,
    selectedObjectsWrapper: document.getElementById("selectedItemsWrapper")!,

    selectedObjectsResizeHandleMR: document.getElementById(
      "selectedItemsResizeHandleMR"
    )!,

    selectedObjectsResizeHandleBR: document.getElementById(
      "selectedItemsResizeHandleBR"
    )!,
    drawingSvg: document.getElementById("drawingSvg")!,

    // @ts-ignore
    drawingSvgPath: document.getElementById("drawingSvgPath")!,
    penToolBarWrapper: document.getElementById("pen-toolbar-wrapper")!,
    dialogObjectImage: document.getElementById(
      "dialog-object-image"
    ) as HTMLDialogElement,
    popoverMenu: document.getElementById("popover-menu")!,
    leftToolbarMenu: document.getElementById("left-toolbar")!,
  };
};

// Apply a remote object change to the existing DOM element in place (keeping its
// id). Mirrors the geometry the factories set at creation, per type. Previously
// only handled images, so text/svg moves and *all* resizes never applied on the
// receiving client.
export const updateObject = (obj: Object, isTransition: boolean) => {
  const element = document.getElementById(obj.id);
  if (!element) return;

  // Smoothly animate remote changes. Covers move (transform) AND resize
  // (width/height) — previously only transform was transitioned, so remote
  // resizes snapped instantly.
  const EASING = "cubic-bezier(0.25, 0.1, 0.25, 1)";
  const TRANSITION = `transform 300ms ${EASING}, width 300ms ${EASING}, height 300ms ${EASING}`;
  if (isTransition) {
    element.style.transition = TRANSITION;
  }

  if (obj.type === "image") {
    element.dataset.src = obj.src;
    element.dataset.x = String(obj.x);
    element.dataset.y = String(obj.y);
    element.dataset.width = String(obj.width);
    element.dataset.height = String(obj.height);
    element.dataset.isGrid = String(obj.isGrid);
    element.style.width = `${obj.width}px`;
    element.style.height = `${obj.height}px`;
    element.style.transform = `translate(${obj.x}px, ${obj.y}px)`;
    element.style.backgroundImage = `url(${obj.src})`;
    // Keep the off-screen culling placeholder size in sync with a remote resize
    // (issue #21). content-visibility itself persists from the factory.
    element.style.setProperty(
      "contain-intrinsic-size",
      `auto ${obj.width}px ${obj.height}px`
    );
  }

  if (obj.type === "svg") {
    element.dataset.x = String(obj.x);
    element.dataset.y = String(obj.y);
    element.dataset.width = String(obj.width);
    element.dataset.height = String(obj.height);
    element.style.width = `${obj.width}px`;
    element.style.height = `${obj.height}px`;
    element.style.transform = `translate(${obj.x}px, ${obj.y}px) scale(1)`;
    const path = element.children[0] as SVGPathElement | undefined;
    if (path) {
      path.setAttribute("d", obj.pathValue);
      // Reproduce the resizer's path scale (see Object_SVG.scale). The scale
      // lives on the path, so the resize animation must transition it here too.
      path.dataset.scale = String(obj.scale);
      if (isTransition) path.style.transition = `transform 300ms ${EASING}`;
      path.style.transform = `scale(${obj.scale})`;
      // Stroke colour (may be undefined for pre-colour stored objects).
      if (obj.colour) {
        path.dataset.colour = obj.colour;
        path.style.fill = obj.colour;
        path.style.stroke = obj.colour;
      }
    }
  }

  if (obj.type === "text") {
    const ta = element as HTMLTextAreaElement;
    ta.value = obj.text;
    ta.dataset.x = String(obj.x);
    ta.dataset.y = String(obj.y);
    ta.dataset.width = String(obj.width);
    ta.dataset.widthB = String(obj.width);
    ta.dataset.height = String(obj.height);
    ta.dataset.scale = String(obj.scale);
    ta.dataset.fontSize = String(obj.fontSize);
    ta.style.transform = `translate(${obj.x}px, ${obj.y}px) scale(${obj.scale})`;
    // The factory stores the camera-adjusted width in dataset.width and the
    // unscaled width in style.width (= dataset.width / scale).
    ta.style.width = `${obj.width / (obj.scale || 1)}px`;
    ta.style.height = `${obj.height}px`;
    ta.style.fontSize = `${obj.fontSize}px`;
    ta.style.color = obj.color;
    ta.style.backgroundColor = obj.backgroundColor;
    ta.classList.toggle("font-bold", obj.isBold);
    ta.classList.toggle("italic", obj.isItalic);
  }

  if (isTransition) {
    setTimeout(() => {
      element.style.transition = "";
      if (obj.type === "svg") {
        const path = element.children[0] as SVGPathElement | undefined;
        if (path) path.style.transition = "";
      }
    }, 300);
    // now remove the transition
  }
};
