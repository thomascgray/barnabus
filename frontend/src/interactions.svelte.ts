import * as Utils from "./utils.svelte";
import { appState, dom, exportObject, importObject } from "./global.svelte";
import * as ConnectionManager from "./ConnectionManager.svelte";
import { getStroke } from "perfect-freehand";
import { CLASSES } from "./config.svelte";
import {
  calculateSelectedItemsBoundingBox,
  performSelectedObjectsChangedUpdate,
  ui_popoverMenu,
} from "./ui_updaters.svelte";
import { toast } from "./toast.svelte";
import {
  createFreehandSvgElement,
  createImageElement,
  createTextElement,
} from "./factories.svelte";
import {
  eMeasuringTool,
  ePenTool,
  eTool,
  type HTMLDivElementWithCustomFuncs,
} from "./types";
import { nanoid } from "nanoid";

let drawing_tlX = Infinity;
let drawing_tlY = Infinity;
let drawing_brX = -Infinity;
let drawing_brY = -Infinity;

// Where the current shape gesture started, in page coords (only used by the
// shape pen tools). Freehand accumulates its own points as the mouse moves;
// shapes are recomputed from start→current corner on every move.
let shapeStartX = 0;
let shapeStartY = 0;

// The shape tools (anything in ePenTool that isn't a freehand pen). These are
// laid out by click-and-drag and finalised into an SVG object exactly like a
// freehand stroke — the only difference is the input points are a computed
// perimeter rather than the mouse's path.
const isShapePenTool = (t: ePenTool) =>
  t === ePenTool.square ||
  t === ePenTool.circle ||
  t === ePenTool.triangle ||
  t === ePenTool.line;

// perfect-freehand options for the current pen tool. Freehand keeps the default
// pressure-tapered look; shapes want a uniform-width outline so a square reads
// as a square, not a tapered ribbon.
const strokeOptionsFor = (size: number) =>
  isShapePenTool(appState.penCurrentTool)
    ? { size, thinning: 0, simulatePressure: false }
    : { size };

// The colour a new stroke is drawn with. The highlighter is just the pen with a
// low-alpha colour (≈20%), encoded as an 8-digit hex so it round-trips through
// the existing Object_SVG `colour` field with no wire-protocol change.
const HIGHLIGHTER_ALPHA_SUFFIX = "33"; // 0x33 / 255 ≈ 0.2
// The brush *cursor* shows the highlighter more opaque than the real ~20% draw
// alpha on purpose: at 0.2 the hue is too washed out to read on a small cursor
// (the grey ring dominates), so it just looks grey. This is only the indicator;
// actual strokes still finalise at the true 20% via getDrawingColour().
const HIGHLIGHTER_CURSOR_OPACITY = 0.5;
const getDrawingColour = () => {
  if (appState.penCurrentTool === ePenTool.highlighter) {
    return appState.penColour + HIGHLIGHTER_ALPHA_SUFFIX;
  }
  return appState.penColour;
};

// Build the perimeter points (page coords) for a shape tool, from the gesture's
// start corner to its current corner. The points are fed straight into
// getStroke just like a freehand path, so the shape becomes a normal SVG object.
const SHAPE_CIRCLE_SEGMENTS = 64;
const SHAPE_POINTS_PER_EDGE = 8;
const SHAPE_LINE_SEGMENTS = 16;
// How far a closed shape overlaps itself at the seam so the start/end caps are
// buried (segments for the circle; the polygons overlap a quarter-edge instead).
const SHAPE_SEAM_OVERLAP_SEGMENTS = 3;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const buildShapePoints = (
  shape: ePenTool,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): number[][] => {
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);

  if (shape === ePenTool.line) {
    // Densify the segment so the stroke is smooth and uniform end to end.
    const pts: number[][] = [];
    for (let i = 0; i <= SHAPE_LINE_SEGMENTS; i++) {
      const t = i / SHAPE_LINE_SEGMENTS;
      pts.push([startX + (endX - startX) * t, startY + (endY - startY) * t]);
    }
    return pts;
  }

  if (shape === ePenTool.circle) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = (maxX - minX) / 2;
    const ry = (maxY - minY) / 2;
    const pts: number[][] = [];
    // Overshoot past the full revolution by a few segments so the loop overlaps
    // itself at the seam — that buries perfect-freehand's start/end caps and
    // closes the otherwise-visible gap where the two ends met exactly.
    for (let i = 0; i <= SHAPE_CIRCLE_SEGMENTS + SHAPE_SEAM_OVERLAP_SEGMENTS; i++) {
      const a = (i / SHAPE_CIRCLE_SEGMENTS) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  }

  // square / triangle. The naive approach (start/end the loop at a corner) leaves
  // a nub at the start corner and a tail at the end corner, because that's where
  // perfect-freehand puts its start/end caps. Instead we start AND end in the
  // middle of the first edge, overlapping slightly: the caps then fall on a
  // straight, self-overlapping stretch of the outline where they're invisible.
  const vertices =
    shape === ePenTool.triangle
      ? [
          [(minX + maxX) / 2, minY], // apex
          [maxX, maxY], // bottom-right
          [minX, maxY], // bottom-left
        ]
      : [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
        ];
  const v0 = vertices[0];
  const v1 = vertices[1];
  const mid = [lerp(v0[0], v1[0], 0.5), lerp(v0[1], v1[1], 0.5)];
  const overshoot = [lerp(v0[0], v1[0], 0.75), lerp(v0[1], v1[1], 0.75)];
  // Mid of edge0 → every later vertex → back to v0 → mid of edge0 → a bit past it.
  const anchors = [mid, ...vertices.slice(1), v0, mid, overshoot];
  const pts: number[][] = [];
  for (let c = 0; c < anchors.length - 1; c++) {
    const [ax, ay] = anchors[c];
    const [bx, by] = anchors[c + 1];
    for (let i = 0; i < SHAPE_POINTS_PER_EDGE; i++) {
      const t = i / SHAPE_POINTS_PER_EDGE;
      pts.push([lerp(ax, bx, t), lerp(ay, by, t)]);
    }
  }
  pts.push([overshoot[0], overshoot[1]]);
  return pts;
};

// Selection box
export const startDraggingSelectionBox = (e: MouseEvent) => {
  if (!e.shiftKey) {
    deselectObjects();
  }
  appState.isDraggingSelectionBox = true;
  // dom.objectsContainer.style.pointerEvents = "none";
  // Deliberately NO promotion of #objects here — it's the same giant (>16k)
  // layer as #camera, so promoting it just moves the GPU tile-thrash onto the
  // selection-box drag (issue #21). The selection box has its own small layer.
};

export const endDraggingSelectionBoxDrag = (e: MouseEvent) => {
  const selectionDomRect = dom.selectionBox.getBoundingClientRect();
  appState.isDraggingSelectionBox = false;
  // dom.objectsContainer.style.pointerEvents = "auto";

  dom.selectionBox.style.display = "none";

  // find all the objects that are within the selection box
  // and add them to the selected elements

  if (selectionDomRect.width === 0 || selectionDomRect.height === 0) {
    return;
  }
  // dom objects needs to NOT be paths
  // todo perf could just get objects on screen or something? probably pointless though?
  const objects = Array.from(dom.objects).filter((obj) => {
    return (
      !obj.classList.contains(CLASSES.SVG_PATH_OBJECT) &&
      !obj.classList.contains(CLASSES.SVG_OBJECT)
    );
  });

  const svgPathObjects = Array.from(dom.objects).filter((obj) => {
    return obj.classList.contains(CLASSES.SVG_PATH_OBJECT);
  });

  const overlappingNonPathObjects = Array.from(objects)
    .filter((obj) => (obj as HTMLElement).dataset.isLocked !== "true")
    .filter((obj) => {
      const objDomRect = obj.getBoundingClientRect();
      return Utils.checkOverlap(objDomRect, selectionDomRect);
    });

  // now test the paths
  const overlappingSvgObjectsBasedOnPath = Array.from(svgPathObjects)
    .filter((obj) => (obj as HTMLElement).dataset.isLocked !== "true")
    .filter((obj) => {
      const pathObj = obj as SVGPathElement;
      const parentSvg = pathObj.parentElement!;

      // note to self - i spent literally 30 mintues trying to figure this out
      // pure trial and error
      // i hate maths

      // todo it works well except lines and stuff dont have lots of points in the middle
      // so its easy to make a box that overlaps the line but happens to not hit a point
      const pathArray = Utils.keepEveryNth(
        Utils.parseSVGPath(obj.getAttribute("d")!).map((pos) => {
          return Utils.canvasToScreen(
            {
              x:
                pos.x * Number(pathObj.dataset.scale) +
                Number(parentSvg.dataset.x),
              y:
                pos.y * Number(pathObj.dataset.scale) +
                Number(parentSvg.dataset.y),
            },
            Number(dom.camera.dataset.x),
            Number(dom.camera.dataset.y),
            Number(dom.camera.dataset.z)
          );
        }),
        1
      );

      // pathArray.forEach((pos) => Utils.debug_pointRender(pos, 2));

      return pathArray.some((pos) =>
        Utils.checkOverLapPos(selectionDomRect, pos)
      );
    })
    .map((pathObj) => pathObj.parentElement!);

  if (e.shiftKey) {
    selectObjects([
      ...appState.selectedObjects,
      ...overlappingNonPathObjects,
      ...overlappingSvgObjectsBasedOnPath,
    ] as HTMLElement[]);
  } else {
    selectObjects([
      ...overlappingNonPathObjects,
      ...overlappingSvgObjectsBasedOnPath,
    ] as HTMLElement[]);
  }

  calculateSelectedItemsBoundingBox();
};
//

// Drawing
export const startDrawing = (e: MouseEvent) => {
  appState.drawingPoints = [];
  shapeStartX = e.pageX;
  shapeStartY = e.pageY;
  appState.drawingPoints.push([e.pageX, e.pageY]);

  // Tint the live preview path with the active drawing colour so the in-progress
  // stroke matches the finished object exactly. The highlighter carries a
  // low-alpha colour (so the preview is see-through at the same ~20% it'll
  // finalise at), and stroke is `none` to avoid the compounding-rim border.
  const colour = getDrawingColour();
  dom.drawingSvgPath.style.fill = colour;
  dom.drawingSvgPath.style.stroke = "none";
};

export const moveWhileDrawing = (e: MouseEvent) => {
  if (e.pageX < drawing_tlX) {
    drawing_tlX = e.pageX;
  }
  if (e.pageY < drawing_tlY) {
    drawing_tlY = e.pageY;
  }
  if (e.pageX > drawing_brX) {
    drawing_brX = e.pageX;
  }
  if (e.pageY > drawing_brY) {
    drawing_brY = e.pageY;
  }

  appState.drawingPoints.push([e.pageX, e.pageY]);

  const stroke = getStroke(
    appState.drawingPoints,
    strokeOptionsFor(appState.penSize * appState.lastMouseDownCameraZ)
  );
  const pathData = Utils.getSvgPathFromStroke(stroke);
  dom.drawingSvgPath.setAttribute("d", pathData);
};

// Brush-cursor preview. Rendered as a *native* CSS cursor (an SVG circle data
// URL) rather than a JS-positioned element: the browser draws the cursor itself,
// so it tracks the pointer with zero lag (a JS follower always trails by a
// frame), and changing the `cursor` style on zoom re-renders it immediately even
// without a mouse move. The circle's diameter is the pen width as it appears on
// screen (penSize × camera zoom) and its fill is the active draw colour
// (translucent for the highlighter), so it shows exactly what's about to be
// drawn. Call this whenever the tool, pen settings, or zoom change.
export const updatePenCursor = () => {
  const bg = dom?.background;
  if (!bg) return;
  // Only the pencil tool gets the brush cursor; otherwise restore the default
  // (clearing the inline style hands control back to the element's CSS class).
  if (appState.currentTool !== eTool.pencil) {
    bg.style.cursor = "";
    return;
  }
  const z = Number(dom.camera.dataset.z) || 1;
  // Browsers ignore cursor images larger than ~128px, so clamp the drawn image
  // to that (hotspot stays centred); at normal sizes/zoom this never triggers.
  const diameter = Math.min(Math.max(appState.penSize * z, 4), 128);
  const r = diameter / 2;
  const hot = Math.round(r);
  // Use a 6-digit hex fill + separate fill-opacity rather than an 8-digit
  // #RRGGBBAA colour (or rgba()): a cursor's standalone SVG is parsed as SVG
  // 1.1, which doesn't understand those and silently falls back to black —
  // which is why the translucent highlighter cursor came out grey/black.
  const fillOpacity =
    appState.penCurrentTool === ePenTool.highlighter
      ? HIGHLIGHTER_CURSOR_OPACITY
      : 1;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}" viewBox="0 0 ${diameter} ${diameter}">` +
    `<circle cx="${r}" cy="${r}" r="${Math.max(
      r - 1,
      0.5
    )}" fill="${appState.penColour}" fill-opacity="${fillOpacity}" stroke="#505050" stroke-opacity="0.8" stroke-width="1"/>` +
    `</svg>`;
  bg.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(
    svg
  )}") ${hot} ${hot}, crosshair`;
};

// Shape variant of moveWhileDrawing: instead of appending the mouse position,
// recompute the shape's whole perimeter from the start corner to the current
// corner, and reset the bounding box to that perimeter's extents (freehand
// accumulates; a shape's box is exact each frame). endDrawing then finalises it
// identically to a freehand stroke.
export const moveWhileDrawingShape = (e: MouseEvent) => {
  const points = buildShapePoints(
    appState.penCurrentTool,
    shapeStartX,
    shapeStartY,
    e.pageX,
    e.pageY
  );
  appState.drawingPoints = points;

  drawing_tlX = Infinity;
  drawing_tlY = Infinity;
  drawing_brX = -Infinity;
  drawing_brY = -Infinity;
  for (const [px, py] of points) {
    if (px < drawing_tlX) drawing_tlX = px;
    if (py < drawing_tlY) drawing_tlY = py;
    if (px > drawing_brX) drawing_brX = px;
    if (py > drawing_brY) drawing_brY = py;
  }

  const stroke = getStroke(
    points,
    strokeOptionsFor(appState.penSize * appState.lastMouseDownCameraZ)
  );
  dom.drawingSvgPath.setAttribute("d", Utils.getSvgPathFromStroke(stroke));
};

export const endDrawing = (e: MouseEvent) => {
  if (appState.drawingPoints.length <= 3) {
    const point = appState.drawingPoints[0];
    appState.drawingPoints = [point, point, point, point];
    drawing_tlX = point[0];
    drawing_tlY = point[1];
    drawing_brX = point[0];
    drawing_brY = point[1];
  }

  const stroke = getStroke(
    appState.drawingPoints
      .map((i) => {
        return [
          i[0] -
            drawing_tlX +
            (appState.penSize * appState.lastMouseDownCameraZ) / 2,
          i[1] -
            drawing_tlY +
            (appState.penSize * appState.lastMouseDownCameraZ) / 2,
        ];
      })
      .map((i) => {
        return [
          i[0] / appState.lastMouseDownCameraZ,
          i[1] / appState.lastMouseDownCameraZ,
        ];
      }),
    strokeOptionsFor(appState.penSize)
  );

  const pathValue = Utils.getSvgPathFromStroke(stroke);

  const topLeftPos = Utils.screenToCanvas(
    drawing_tlX,
    drawing_tlY,
    Number(dom.camera.dataset.x),
    Number(dom.camera.dataset.y),
    Number(dom.camera.dataset.z)
  );

  const bottomRightPos = Utils.screenToCanvas(
    drawing_brX,
    drawing_brY,
    Number(dom.camera.dataset.x),
    Number(dom.camera.dataset.y),
    Number(dom.camera.dataset.z)
  );

  const width = bottomRightPos.x - topLeftPos.x;
  const height = bottomRightPos.y - topLeftPos.y;

  const svgElement = createFreehandSvgElement({
    pathValue: pathValue,
    x: topLeftPos.x - appState.penSize / 2,
    y: topLeftPos.y - appState.penSize / 2,
    width: width + appState.penSize,
    height: height + appState.penSize,
    // Pen → solid colour; highlighter → the same colour at ~20% alpha.
    colour: getDrawingColour(),
  });

  // Broadcast + persist the stroke, like the image/text add paths do. Without
  // this the drawing is local-only and never reaches other clients or storage.
  // First broadcast → addItem (broadcastObjects decides via data-synced).
  if (svgElement) {
    broadcastObjects([svgElement]);
  }

  // we're done drawing, reset stuff
  drawing_tlX = Infinity;
  drawing_tlY = Infinity;
  drawing_brX = -Infinity;
  drawing_brY = -Infinity;
  appState.drawingPoints = [];
  dom.drawingSvgPath.setAttribute("d", "");
};
//

export const resizeFunctions = {
  startResizingBR: (e: MouseEvent) => {
    dom.popoverMenu.style.pointerEvents = "none";
    appState.isResizingBR = true;
  },
  moveWhileResizingBR: (e: MouseEvent) => {
    const mousePoint = Utils.screenToCanvas(
      e.clientX,
      e.clientY,
      Number(dom.camera.dataset.x),
      Number(dom.camera.dataset.y),
      Number(dom.camera.dataset.z)
    );

    const diff = {
      x: mousePoint.x - appState.lastMouseDownCanvasPos.x,
      y: mousePoint.y - appState.lastMouseDownCanvasPos.y,
    };

    Utils.resizeBottomRightToTopLeft(
      diff.x,
      diff.y,
      dom.selectedObjectsWrapper,
      dom.selectedObjectsResizeHandleBR,
      dom.selectedObjectsResizeHandleMR,
      appState.selectedObjects
      // e.ctrlKey || e.metaKey
    );

    ui_popoverMenu();
  },
  endResizingBR: (e: MouseEvent) => {
    dom.popoverMenu.style.pointerEvents = "auto";
    Array.from(appState.selectedObjects)
      .filter(
        (obj) =>
          obj.classList.contains(CLASSES.IMAGE_OBJECT) ||
          obj.classList.contains(CLASSES.SVG_OBJECT)
      )
      .forEach((obj) => {
        const matrix = new DOMMatrixReadOnly(obj.style.transform);
        const x = matrix.m41;
        const y = matrix.m42;
        (obj as HTMLElement).dataset.x = String(x);
        (obj as HTMLElement).dataset.y = String(y);
        (obj as HTMLElement).dataset.width = parseInt(
          obj.style.width
        ).toString();
        (obj as HTMLElement).dataset.height = parseInt(
          obj.style.height
        ).toString();
      });

    // need to take all the text objects that we were resizing and set their font size into the data attribute
    Array.from(appState.selectedObjects)
      .filter((obj) => obj.classList.contains(CLASSES.TEXT_OBJECT))
      .forEach((obj) => {
        const matrix = new DOMMatrixReadOnly(obj.style.transform);
        const scale = matrix.a;

        const fontSize = parseInt(obj.style.fontSize);
        obj.dataset.fontSize = `${fontSize}`;
        obj.dataset.width = `${obj.dataset.widthB}`;
        obj.dataset.height = `${obj.dataset.heightB}`;

        (obj as HTMLElement).dataset.scale = String(scale);
      });

    // do some stuff to all the svgs
    Array.from(appState.selectedObjects)
      .filter((obj) => obj.classList.contains(CLASSES.SVG_OBJECT))
      .forEach((obj) => {
        // get scale as the transform scale
        // get the scale, use regex to get it from the obj.children[0].style.transform
        const scale = Number(
          // @ts-ignore
          obj.children[0].style?.transform?.match(/scale\((.*?)\)/)?.[1] ?? 1
        );
        // @ts-ignore
        obj.children[0].dataset.scale = String(scale);
      });

    calculateSelectedItemsBoundingBox();

    // Broadcast + persist the new size/position to other clients. Via
    // broadcastObjects so a brand-new text box resized before its first
    // blur/edit is introduced as an addItem rather than a no-op alterItem.
    broadcastObjects(appState.selectedObjects);

    appState.isResizingBR = false;
  },

  startResizingMR: (e: MouseEvent) => {
    dom.popoverMenu.style.pointerEvents = "none";
    appState.isResizingMR = true;
  },
  moveWhileResizingMR: (e: MouseEvent) => {
    const mousePoint = Utils.screenToCanvas(
      e.clientX,
      e.clientY,
      Number(dom.camera.dataset.x),
      Number(dom.camera.dataset.y),
      Number(dom.camera.dataset.z)
    );

    const diffX = mousePoint.x - appState.lastMouseDownCanvasPos.x;
    const scaledDiffX = diffX;

    appState.selectedObjects.forEach((el) => {
      const initialScaledWidth = Number(el.dataset.widthB);
      const elementScale = Number(el.dataset.scale);
      const initialWidth = Math.round(initialScaledWidth / elementScale);
      const newWidth = initialWidth + scaledDiffX;
      const newWidthScaled = initialWidth + scaledDiffX / elementScale;

      const newWidthScaledToCamera = newWidthScaled * elementScale;

      el.style.width = `${newWidthScaled}px`;
      el.dataset.width = `${newWidthScaledToCamera}`;
      Utils.relcalculateTextAreaHeight(el as HTMLTextAreaElement);
    });

    calculateSelectedItemsBoundingBox();
    ui_popoverMenu();
  },
  endResizingMR: (e: MouseEvent) => {
    dom.popoverMenu.style.pointerEvents = "auto";
    // todo its only text objects, work it out
    appState.selectedObjects.forEach((el) => {
      el.dataset.widthB = el.dataset.width;
    });

    // Broadcast + persist the new width/position to other clients. Via
    // broadcastObjects so a brand-new text box resized before its first
    // blur/edit is introduced as an addItem rather than a no-op alterItem.
    broadcastObjects(appState.selectedObjects);

    appState.isResizingMR = false;
  },
};

export const mouseDownOnObject = (e: MouseEvent, id: string) => {
  e.preventDefault();
  e.stopPropagation();

  if (appState.currentTool === "text") {
    // we've clicked on an object while the text tool is selected
    // TODOSVELTE
    // window.handler_clickOnToolbarButton(e, "btn-cursor");
  }
  // if we're clicking the focused text box, do nothing - we want the browser to handle this
  if (
    // @ts-ignore
    e.target!.classList.contains(CLASSES.TEXT_OBJECT) &&
    document.activeElement === e.target
  ) {
    return;
  }

  // get the objects that we've already selected...
  const selectedElementIds = appState.selectedObjects.map((elem) => elem.id);

  // ...and if we have some selected objects AND one of those selected ones
  // is the object we've just clicked on, do nothing
  if (appState.selectedObjects.length > 0 && selectedElementIds.includes(id)) {
    // we've already got some things selected, so we're dragging ALL of them
  } else {
    // otherwise, we need to select the object
    const element = document.getElementById(id)!;
    // if we're holding shift, add it to the selection
    if (e.shiftKey) {
      selectObjects([...appState.selectedObjects, element]);
    } else {
      selectObjects([element]);
    }
  }

  performSelectedObjectsChangedUpdate();
  calculateSelectedItemsBoundingBox();
  ui_popoverMenu();
};

export const selectObjects = (elements: HTMLElement[]) => {
  appState.selectedObjects = [...elements];
  performSelectedObjectsChangedUpdate();
};

export const deselectObjects = () => {
  appState.selectedObjects.forEach((el) => {
    el.classList.remove("selected");
    el.dataset.isSelected = "false";
    el.blur();
  });
  appState.selectedObjects = [];
  dom.selectedObjectsWrapper.style.display = "none";
  dom.selectedObjectsResizeHandleBR.style.display = "none";
  dom.selectedObjectsResizeHandleMR.style.display = "none";
  dom.selectedObjectsWrapper.style.pointerEvents = "auto";
  performSelectedObjectsChangedUpdate();
  ui_popoverMenu();
};

export const addObjectToSelectedObjects = () => {};

export const bringObjectsToFront = (elements: HTMLElement[]) => {
  // the objects that we've passed need to get the highest z index
  // and everything else goes down

  Utils.bringToFront(elements, Array.from(dom.objects) as HTMLElement[]);

  toast(
    `${elements.length} object${
      elements.length > 1 ? "s" : ""
    } brought to front`
  );
};

export const sendObjectsToBack = (elements: HTMLElement[]) => {
  Utils.sendToBack(elements, Array.from(dom.objects) as HTMLElement[]);

  toast(
    `${elements.length} object${elements.length > 1 ? "s" : ""} sent to back`
  );
};

export const toggleIsToken = () => {
  // get the selected objects, and if they have a data-is-token attribute, then toggle it
  const selectedObjects = Array.from(
    document.querySelectorAll(`.${CLASSES.OBJECT}.selected`)
  ) as HTMLElement[];

  selectedObjects.forEach((el) => {
    const isToken = el.dataset.isToken === "true";
    if (isToken) {
      el.classList.remove("is-token");
    } else {
      el.classList.add("is-token");
    }
    el.dataset.isToken = String(!isToken);
  });
};

export const deleteSelectedObjects = () => {
  const selectedObjects = Array.from(
    document.querySelectorAll(`.${CLASSES.OBJECT}.selected`)
  ) as HTMLElement[];
  let count = selectedObjects.length;
  for (let obj of selectedObjects) {
    // Tell the other clients (and the server, so it deletes the row) before
    // removing locally. Without this, deletes are local-only and the object
    // reappears for everyone on the next join.
    ConnectionManager.sendMessage({
      type: "removeItem",
      payload: { id: obj.id },
    });
    obj.remove();
  }
  deselectObjects();
  toast(`Deleted ${count} objects`);
};

export const mouseDownOnSelectedObjectsWrapper = (e: MouseEvent) => {
  console.log("mouse down on selected objects wrapper");
  dom.selectedObjectsWrapper.classList.remove("cursor-grab");
  dom.selectedObjectsWrapper.classList.add("cursor-grabbing");
};

export const mouseUpOnSelectItemsWrapper = (e: MouseEvent) => {
  if (
    appState.previousSelectionSelectedObjects.length === 1 &&
    appState.selectedObjects.length === 1 &&
    appState.previousSelectionSelectedObjects[0].id ===
      appState.selectedObjects[0].id &&
    appState.selectedObjects[0].classList.contains(CLASSES.TEXT_OBJECT) &&
    appState.hasMovedItems === false
  ) {
    focusTextBox(appState.selectedObjects[0]);
  }
};

export const flipImage = (els: HTMLElement[]) => {
  els
    .filter((el) => el.classList.contains(CLASSES.IMAGE_OBJECT))
    .forEach((el) => {
      const content = el.children[0] as HTMLElement;
      if (el.dataset.isFlipped === "true") {
        content.style.transform = `rotateY(0deg)`;
        el.dataset.isFlipped = "false";
        return;
      } else {
        content.style.transform = `rotateY(180deg)`;
        el.dataset.isFlipped = "true";
        return;
      }
    });
};

export const toggleGrid = (els: HTMLElement[]) => {
  els
    .filter((el) => el.classList.contains(CLASSES.IMAGE_OBJECT))
    .forEach((el) => {
      if (el.dataset.isGrid === "true") {
        (el as HTMLDivElementWithCustomFuncs).removeGrid();
        el.dataset.isGrid = "false";
        return;
      } else {
        (el as HTMLDivElementWithCustomFuncs).addGrid();
        el.dataset.isGrid = "true";
        return;
      }
    });
};

export const startPan = (e: MouseEvent) => {
  // Deliberately NO layer-promotion hint here. The board can be tens of
  // thousands of px across; promoting #camera (via will-change or the old
  // opacity:0.99 trick) forces Chrome to back the whole >16k layer as one giant
  // tiled texture, which fills the GPU raster-tile budget after a few seconds of
  // panning and then thrashes — the "smooth then janky" symptom in issue #21.
  // will-change is only safe on a viewport-sized layer, which this is not.
};

export const doPan = (e: MouseEvent) => {
  const deltaX = -e.movementX;
  const deltaY = -e.movementY;
  const [x, y, z] = Utils.getDomElementTransformAsNumbers(dom.camera);
  // Cancel any in-flight programmatic camera animation (issue #27) so panning
  // tracks the cursor instantly instead of easing toward each frame.
  dom.camera.style.transition = "";
  dom.camera.style.transform = `scale(${z}) translate(${x - deltaX / z}px, ${
    y - deltaY / z
  }px)`;
  dom.camera.dataset.x = String(x - deltaX / z);
  dom.camera.dataset.y = String(y - deltaY / z);
  dom.camera.dataset.z = String(z);
  // Skip the popover reposition entirely on the per-frame pan path unless
  // something is selected (ui_popoverMenu would early-return anyway, but this
  // avoids the call too). Issue #21.
  if (appState.selectedObjects.length) ui_popoverMenu();
};

export const endPan = (e: MouseEvent) => {
  // No-op: nothing to clean up now that startPan promotes nothing (issue #21).
};

export const increaseGridSize = (els: HTMLElement[]) => {
  els
    .filter((el) => el.classList.contains(CLASSES.IMAGE_OBJECT))
    .filter((el) => el.dataset.isGrid === "true")
    .forEach((el) => {
      (el as HTMLDivElementWithCustomFuncs).increaseGridSize(2);
    });
};

// Broadcast + persist the current state of the given object elements. Style /
// content edits update only the local DOM, so without this the change is
// local-only and silently lost on reload until some *other* gesture (a move /
// resize) happens to re-export the element (issue #32 — text bg colour, bold,
// italic, and typed text were not being saved).
//
// The first broadcast of an element the server/peers have never seen is sent as
// an `addItem`, every subsequent one as an `alterItem`. This matters for text
// boxes: `placeTextObject` creates them straight from the factory with no
// broadcast (you type into an empty box first), so the first edit/blur is what
// introduces them to everyone else. Without the addItem, live peers' `updateObject`
// no-ops on the unknown id and the box only appears for them after a reload.
// Imported objects are pre-marked `data-synced` (see importObject), so editing
// one never re-adds it.
export const broadcastObjects = (els: (HTMLElement | SVGElement)[]) => {
  for (const el of els) {
    // An image still uploading carries a base64 `src` we must never put on the
    // wire (the upload path swaps in the URL, then broadcasts). Skip it; its
    // own completion handler broadcasts the real addItem.
    if (el.classList.contains(CLASSES.IMAGE_UPLOADING)) continue;
    const isNew = el.dataset.synced !== "true";
    el.dataset.synced = "true";
    ConnectionManager.sendMessage({
      type: isNew ? "addItem" : "alterItem",
      payload: { object: exportObject(el) },
    });
  }
};

export const toggleSelectedTextBold = () => {
  const textEls = appState.selectedObjects.filter((el) =>
    el.classList.contains(CLASSES.TEXT_OBJECT)
  );
  textEls.forEach((el) => {
    if (el.dataset.isBold === "true") {
      el.classList.remove("font-bold");
      el.dataset.isBold = "false";
    } else {
      el.classList.add("font-bold");
      el.dataset.isBold = "true";
    }
    Utils.relcalculateTextAreaHeight(el as HTMLTextAreaElement);
  });
  broadcastObjects(textEls);
};

export const toggleSelectedTextItalic = () => {
  const textEls = appState.selectedObjects.filter((el) =>
    el.classList.contains(CLASSES.TEXT_OBJECT)
  );
  textEls.forEach((el) => {
    if (el.dataset.isItalic === "true") {
      el.classList.remove("italic");
      el.dataset.isItalic = "false";
    } else {
      el.classList.add("italic");
      el.dataset.isItalic = "true";
    }
    Utils.relcalculateTextAreaHeight(el as HTMLTextAreaElement);
  });
  broadcastObjects(textEls);
};

// The colour pickers fire `input` continuously as the swatch is dragged, so we
// only update the local DOM here (live preview) and defer the broadcast to the
// `change` event (commit) via `commitSelectedTextStyle` — otherwise we'd flood
// the socket with an alterItem per pointer move. The colour input's `change`
// event is NOT a reliable commit signal: on macOS the native colour panel only
// fires `change` when the panel is dismissed, so a user who picks a colour and
// reloads (or just leaves the panel open) never commits. So we broadcast from
// the live `input` handler, debounced, which is guaranteed to fire (it's what
// paints the colour locally). `change` still calls commit for an immediate
// final write.
let textStyleCommitTimer: ReturnType<typeof setTimeout> | undefined;
const scheduleTextStyleCommit = () => {
  if (textStyleCommitTimer) clearTimeout(textStyleCommitTimer);
  textStyleCommitTimer = setTimeout(() => {
    textStyleCommitTimer = undefined;
    commitSelectedTextStyle();
  }, 150);
};

export const changeTextColor = (e: Event) => {
  const color = e.target as HTMLInputElement;
  appState.selectedObjects
    .filter((el) => el.classList.contains(CLASSES.TEXT_OBJECT))
    .forEach((el) => {
      el.dataset.color = color.value;
      el.style.color = color.value;
    });

  ui_popoverMenu();
  scheduleTextStyleCommit();
};

export const changeTextBackgroundColor = (e: Event) => {
  const color = e.target as HTMLInputElement;
  appState.selectedObjects
    .filter((el) => el.classList.contains(CLASSES.TEXT_OBJECT))
    .forEach((el) => {
      el.dataset.backgroundColor = color.value;
      el.style.backgroundColor = color.value;
    });

  ui_popoverMenu();
  scheduleTextStyleCommit();
};

// Broadcast + persist the selected text objects' current style. Called from the
// debounced `input` path and from the colour picker's `change` (commit) event,
// so colour edits survive a reload even if `change` never fires.
export const commitSelectedTextStyle = () => {
  if (textStyleCommitTimer) {
    clearTimeout(textStyleCommitTimer);
    textStyleCommitTimer = undefined;
  }
  broadcastObjects(
    appState.selectedObjects.filter((el) =>
      el.classList.contains(CLASSES.TEXT_OBJECT)
    )
  );
};

export const placeTextObject = (e: MouseEvent) => {
  // make suyre nothing is selected
  deselectObjects();

  const spawnPoint = Utils.screenToCanvas(
    e.clientX,
    e.clientY,
    Number(dom.camera.dataset.x),
    Number(dom.camera.dataset.y),
    Number(dom.camera.dataset.z)
  );
  // create a text object here
  createTextElement({
    text: "",
    x: spawnPoint.x,
    y: spawnPoint.y,
    shouldAdjustY: true,
    focusOnCreation: true,
  });
  // clickOnToolbarButton(e, "btn-cursor");
  setActiveTool(eTool.cursor);
  endDraggingSelectionBoxDrag(e);
};

export const focusTextBox = (element: HTMLElement) => {
  element.focus();
  dom.selectedObjectsWrapper.style.pointerEvents = "none";
};

export const startDraggingObjects = (e: MouseEvent) => {
  // appState.isDraggingObjects = true;

  // if any of the selected objects are images with a grid enabled
  // TODO this causes massive performance problems when you start dragging a lot of grids at the same time
  // the better way to do this is to store "groups" of objects against the grid, e.g when you stop dragging a token onto a grid,
  // set that token as being part of the grids group
  const gridObjects = Array.from(appState.selectedObjects).filter((el) => {
    return (
      el.classList.contains(CLASSES.IMAGE_OBJECT) &&
      el.dataset.isGrid === "true"
    );
  });

  for (let gridObject of gridObjects) {
    const tokensOnThisImage = Array.from(dom.objects).filter((tokenObject) => {
      return (
        tokenObject.classList.contains(CLASSES.OBJECT) &&
        (tokenObject as HTMLElement).dataset.isToken === "true" &&
        Utils.checkOverlap(
          gridObject.getBoundingClientRect(),
          tokenObject.getBoundingClientRect()
        )
      );
    }) as HTMLElement[];

    selectObjects([...appState.selectedObjects, ...tokensOnThisImage]);
  }
};
export const moveWhileDraggingObjects = (e: MouseEvent) => {
  const diffX =
    (e.clientX - appState.lastMouseDownScreenPos.x) /
    appState.lastMouseDownCameraZ;
  const diffY =
    (e.clientY - appState.lastMouseDownScreenPos.y) /
    appState.lastMouseDownCameraZ;

  const absMax = Math.max(Math.abs(diffX), Math.abs(diffY));

  // give it a dampening effect
  if (absMax < 10 && !appState.hasBrokenDampening) {
    return;
  } else {
    appState.hasBrokenDampening = true;
  }

  appState.hasMovedItems = true;
  appState.isDraggingObjects = true;

  for (let elem of appState.selectedObjects) {
    const origPos = appState.selectedElementsOriginalPositions[elem.id];
    // if the element is a text object, include its scale
    if (elem.classList.contains(CLASSES.TEXT_OBJECT)) {
      elem.style.transform = `translate(${origPos.x + diffX}px, ${
        origPos.y + diffY
      }px) scale(${elem.dataset.scale})`;
    } else {
      elem.style.transform = `translate(${origPos.x + diffX}px, ${
        origPos.y + diffY
      }px)`;
    }
  }

  //  move the selected items wrapper too
  dom.selectedObjectsWrapper.style.transform = `translate(${
    Number(dom.selectedObjectsWrapper.dataset.x) + diffX
  }px, ${Number(dom.selectedObjectsWrapper.dataset.y) + diffY}px)`;

  // do the same for the resize handle
  dom.selectedObjectsResizeHandleBR.style.transform = `translate(${
    Number(dom.selectedObjectsResizeHandleBR.dataset.x) + diffX
  }px, ${Number(dom.selectedObjectsResizeHandleBR.dataset.y) + diffY}px)`;

  dom.selectedObjectsResizeHandleMR.style.transform = `translate(${
    Number(dom.selectedObjectsResizeHandleMR.dataset.x) + diffX
  }px, ${Number(dom.selectedObjectsResizeHandleMR.dataset.y) + diffY}px)`;

  // also move the popover menu
  ui_popoverMenu();
};

export const endDraggingObjects = (e: MouseEvent) => {
  for (let elem of appState.selectedObjects) {
    const style = window.getComputedStyle(elem);
    const matrix = new DOMMatrixReadOnly(style.transform);
    const x = matrix.m41;
    const y = matrix.m42;
    elem.dataset.x = String(x);
    elem.dataset.y = String(y);

    // if (!elem.classList.contains(CLASSES.TEXT_OBJECT)) {
    //   elem.dataset.width = parseInt(elem.style.width).toString();
    //   elem.dataset.height = parseInt(elem.style.height).toString();
    // }

    if (elem.classList.contains(CLASSES.TEXT_OBJECT)) {
      // needs to be the font size WHEN we started resizing. keep it in a data attribute
      const fontSize = parseInt(elem.style.fontSize);
      elem.dataset.fontSize = String(fontSize);

      // and the scale
    }
  }

  // strictly speaking this gets handled when moving; but this is just in case.
  // Via broadcastObjects so a brand-new text box dragged before its first
  // blur/edit is introduced as an addItem rather than a no-op alterItem.
  calculateSelectedItemsBoundingBox();
  broadcastObjects(appState.selectedObjects);

  appState.isDraggingObjects = false;
};

// Create fresh objects from exported JSON, offset so they don't sit exactly on
// the originals. Selects the new objects and broadcasts each as addItem. Shared
// by duplicate (key "d") and clipboard paste (ctrl+v) so both handle every
// object type and any number of objects identically.
export const spawnObjectsFromExports = (exports: any[]): HTMLElement[] => {
  const newObjects: any[] = [];

  exports.forEach((json) => {
    const newObject = {
      ...json,
      id: nanoid(8),
      x: Number(json.x || 0) + 40,
      y: Number(json.y || 0) + 40,
    };
    const el = importObject(newObject);
    if (el) newObjects.push(el);
  });

  if (newObjects.length === 0) return [];

  deselectObjects();

  // Defer one tick: text objects get their width/height/data-* set in a
  // setTimeout by the factory, so doing this synchronously would (a) size the
  // selection wrapper + resize handles from NaN dataset values — leaving the
  // new object only "sort of" selected with a wrong-sized box — and (b)
  // broadcast NaN sizes. By the time this fires, those dataset values are
  // populated, so the duplicate ends up properly selected and correctly sized.
  setTimeout(() => {
    selectObjects(newObjects);
    calculateSelectedItemsBoundingBox();
    ui_popoverMenu();
    newObjects.forEach((obj) => {
      ConnectionManager.sendMessage({
        type: "addItem",
        payload: {
          object: exportObject(obj),
        },
      });
    });
  });

  return newObjects;
};

export const duplicateSelectedObjects = () => {
  const count = appState.selectedObjects.length;
  const exports = appState.selectedObjects.map((el) => exportObject(el));
  spawnObjectsFromExports(exports);
  toast(`Duplicated ${count} object${count > 1 ? "s" : ""}`);
};

export const toggleLock = () => {
  console.log("toggle lock");
  for (let el of appState.selectedObjects) {
    el.dataset.isLocked = el.dataset.isLocked !== "true" ? "true" : "false";
    if (el.dataset.isLocked === "true") {
      toast("Locked object", "info");
      deselectObjects();
    } else {
      toast("Unlocked object", "info");
    }
  }

  ui_popoverMenu();
};

/**
 * Set the active tool to a specific tool
 * @param tool
 */
export const setActiveTool = (tool: eTool) => {
  appState.currentTool = tool;
  deselectObjects();
};
export const setActiveMeasuringTool = (tool: eMeasuringTool) => {
  appState.currentMeasuringTool = tool;
  deselectObjects();
};

// Pick which pen behaviour the pencil tool uses (plain pen, highlighter, or one
// of the shape tools). Also ensures the pencil itself is the active tool so the
// click that picks a pen behaviour starts drawing with it immediately.
export const setActivePenTool = (tool: ePenTool) => {
  appState.penCurrentTool = tool;
  if (appState.currentTool !== eTool.pencil) {
    setActiveTool(eTool.pencil);
  }
};

export const startMeasuring = (e: MouseEvent) => {
  console.log("startMeasuring");
  appState.startMeasuringPoint = {
    x: e.clientX,
    y: e.clientY,
  };
};

export const moveWhileMeasuring = (e: MouseEvent) => {
  if (appState.startMeasuringPoint === null) {
    return;
  }
  appState.currentMeasuringPoint = {
    x: e.clientX,
    y: e.clientY,
  };

  const halfwayPoint = {
    x: (appState.startMeasuringPoint.x + appState.currentMeasuringPoint.x) / 2,
    y: (appState.startMeasuringPoint.y + appState.currentMeasuringPoint.y) / 2,
  };

  const diffX =
    Math.abs(
      appState.currentMeasuringPoint.x - appState.startMeasuringPoint.x
    ) / appState.lastMouseDownCameraZ;
  const diffY =
    Math.abs(
      appState.currentMeasuringPoint.y - appState.startMeasuringPoint.y
    ) / appState.lastMouseDownCameraZ;

  const measuringLineLabel = document.getElementById(
    "measuring-line-label"
  ) as HTMLParagraphElement;

  measuringLineLabel.style.transform = `translate(${halfwayPoint.x}px, ${halfwayPoint.y}px)`;
  // position the label in the middle of the line

  const moved = Math.max(diffX, diffY);

  const numOfSquares = Math.floor(moved / 50);
  measuringLineLabel.innerText = `${numOfSquares} squares`;
};

export const endMeasuring = (e: MouseEvent) => {
  console.log("endMeasuring");
  appState.startMeasuringPoint = null;
  appState.currentMeasuringPoint = null;
};

export const openImageModal = () => {
  // The image modal is its own thing, not a canvas tool — drop any active
  // selection/tool gesture so it doesn't fight with the modal.
  deselectObjects();
  appState.isImageModalOpen = true;
};

export const closeImageModal = () => {
  appState.isImageModalOpen = false;
};

// Add an image to the board from an external URL. Unlike file uploads, the
// external URL is kept as-is (not side-loaded to our backend) — matching how
// pasted image URLs are handled. Spawns centred on the given screen point.
export const addImageFromUrl = (
  imageUrl: string,
  screenX: number,
  screenY: number
) => {
  // Load it first so we know the natural size to centre it by.
  const image = new Image();
  image.onload = () => {
    const width = image.width;
    const height = image.height;

    const spawnPoint = Utils.screenToCanvas(
      screenX,
      screenY,
      Number(dom.camera.dataset.x),
      Number(dom.camera.dataset.y),
      Number(dom.camera.dataset.z)
    );

    const domObj = createImageElement({
      src: imageUrl,
      width,
      height,
      x: spawnPoint.x - width / 2,
      y: spawnPoint.y - height / 2,
    });

    // First broadcast → addItem (broadcastObjects decides via data-synced).
    broadcastObjects([domObj]);

    toast("Image added", "success");
  };
  image.onerror = () => {
    toast("Couldn't load an image from that URL", "error");
  };
  image.src = imageUrl;
};
