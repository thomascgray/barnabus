import * as Utils from "./utils.svelte";
import { appState, dom, exportObject, importObject } from "./global.svelte";

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
  createTextElement,
} from "./factories.svelte";
import {
  eMeasuringTool,
  eTool,
  type HTMLDivElementWithCustomFuncs,
} from "./types";

let drawing_tlX = Infinity;
let drawing_tlY = Infinity;
let drawing_brX = -Infinity;
let drawing_brY = -Infinity;

// Selection box
export const startDraggingSelectionBox = (e: MouseEvent) => {
  if (!e.shiftKey) {
    deselectObjects();
  }
  appState.isDraggingSelectionBox = true;
  // dom.objectsContainer.style.pointerEvents = "none";
  dom.objectsContainer.style.opacity = "0.99";
};

export const endDraggingSelectionBoxDrag = (e: MouseEvent) => {
  const selectionDomRect = dom.selectionBox.getBoundingClientRect();
  appState.isDraggingSelectionBox = false;
  // dom.objectsContainer.style.pointerEvents = "auto";
  dom.objectsContainer.style.opacity = "1";

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
  const pos = {
    x: e.pageX,
    y: e.pageY,
  };
  appState.drawingPoints.push([pos.x, pos.y]);
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

  const stroke = getStroke(appState.drawingPoints, {
    size: appState.penSize * appState.lastMouseDownCameraZ,
  });
  const pathData = Utils.getSvgPathFromStroke(stroke);
  dom.drawingSvgPath.setAttribute("d", pathData);
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
    {
      size: appState.penSize,
    }
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

  createFreehandSvgElement({
    pathValue: pathValue,
    x: topLeftPos.x - appState.penSize / 2,
    y: topLeftPos.y - appState.penSize / 2,
    width: width + appState.penSize,
    height: height + appState.penSize,
  });

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
  dom.camera.style.opacity = "0.99";
};

export const doPan = (e: MouseEvent) => {
  const deltaX = -e.movementX;
  const deltaY = -e.movementY;
  const [x, y, z] = Utils.getDomElementTransformAsNumbers(dom.camera);
  dom.camera.style.transform = `scale(${z}) translate(${x - deltaX / z}px, ${
    y - deltaY / z
  }px)`;
  dom.camera.dataset.x = String(x - deltaX / z);
  dom.camera.dataset.y = String(y - deltaY / z);
  dom.camera.dataset.z = String(z);
  ui_popoverMenu();
};

export const endPan = (e: MouseEvent) => {
  dom.camera.style.opacity = "1";
};

export const increaseGridSize = (els: HTMLElement[]) => {
  els
    .filter((el) => el.classList.contains(CLASSES.IMAGE_OBJECT))
    .filter((el) => el.dataset.isGrid === "true")
    .forEach((el) => {
      (el as HTMLDivElementWithCustomFuncs).increaseGridSize(2);
    });
};

export const toggleSelectedTextBold = () => {
  appState.selectedObjects
    .filter((el) => el.classList.contains(CLASSES.TEXT_OBJECT))
    .forEach((el) => {
      if (el.dataset.isBold === "true") {
        el.classList.remove("font-bold");
        el.dataset.isBold = "false";
        Utils.relcalculateTextAreaHeight(el as HTMLTextAreaElement);
        return;
      } else {
        el.classList.add("font-bold");
        el.dataset.isBold = "true";
        Utils.relcalculateTextAreaHeight(el as HTMLTextAreaElement);
        return;
      }
    });
};

export const toggleSelectedTextItalic = () => {
  appState.selectedObjects
    .filter((el) => el.classList.contains(CLASSES.TEXT_OBJECT))
    .forEach((el) => {
      if (el.dataset.isItalic === "true") {
        el.classList.remove("italic");
        el.dataset.isItalic = "false";
        Utils.relcalculateTextAreaHeight(el as HTMLTextAreaElement);
        return;
      } else {
        el.classList.add("italic");
        el.dataset.isItalic = "true";
        Utils.relcalculateTextAreaHeight(el as HTMLTextAreaElement);
        return;
      }
    });
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

  // strictly speaking this gets handled when moving; but this is just in case
  calculateSelectedItemsBoundingBox();
  appState.isDraggingObjects = false;
};

export const duplicateSelectedObjects = () => {
  const newObjects: any[] = [];

  appState.selectedObjects.forEach((el) => {
    // const export the object to JSON
    const json = exportObject(el);
    const x = Number(el.dataset?.x || 0);
    const y = Number(el.dataset?.y || 0);
    newObjects.push(
      importObject({
        ...json,
        x: x + 80,
        y: y + 100,
      })
    );
  });

  toast(
    `Duplicated ${appState.selectedObjects.length} object${
      appState.selectedObjects.length > 1 ? "s" : ""
    }`
  );

  deselectObjects();

  selectObjects(newObjects);

  // console.log("newObjects", newObjects);

  calculateSelectedItemsBoundingBox();
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
