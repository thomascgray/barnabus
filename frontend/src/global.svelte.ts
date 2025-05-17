import { CLASSES } from "./config.svelte";
import {
  createFreehandSvgElement,
  createImageElement,
  createTextElement,
} from "./factories.svelte";
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

export const exportObject = (obj: HTMLElement) => {
  const type = obj.dataset.objtype;

  if (type === "image") {
    return {
      id: obj.id,
      type: "image",
      src: obj.dataset.src,
      x: obj.dataset.x,
      y: obj.dataset.y,
      width: obj.dataset.width,
      height: obj.dataset.height,
      isGrid: obj.dataset.isGrid === "true",
    };
  }

  if (type === "text") {
    return {
      id: obj.id,
      type: "text",
      text: (obj as HTMLTextAreaElement).value,
      x: obj.dataset.x,
      y: obj.dataset.y,
      width: obj.dataset.width,
      height: obj.dataset.height,
      fontSize: obj.dataset.fontSize,
      color: obj.dataset.color,
      backgroundColor: obj.dataset.backgroundColor,
      scale: obj.dataset.scale,
      isBold: obj.dataset.isBold === "true",
      isItalic: obj.dataset.isItalic === "true",
    };
  }

  if (type === "svg") {
    return {
      id: obj.id,
      type: "svg",
      pathValue: obj.children[0].getAttribute("d"),
      x: obj.dataset.x,
      y: obj.dataset.y,
      width: obj.dataset.width,
      height: obj.dataset.height,
    };
  }
};

export const importObject = (json: any) => {
  if (json.type === "image") {
    return createImageElement({
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
      pathValue: json.pathValue,
      x: json.x,
      y: json.y,
      width: json.width,
      height: json.height,
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
