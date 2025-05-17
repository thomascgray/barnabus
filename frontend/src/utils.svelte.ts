// import { CLASSES } from "./consts";
// import { iPos } from "./global";
import { animate } from "motion";
import type { iPos } from "./types";
import { appState } from "./global.svelte";
import { CLASSES } from "./config.svelte";
import {
  calculateSelectedItemsBoundingBox,
  ui_popoverMenu,
} from "./ui_updaters.svelte";
// import { state, dom } from "./global";
// import { ui_popoverMenu } from "./ui_updaters";
// import { calculateSelectedItemsBoundingBox } from "./main";

export const util_withMinMax = (
  val: number,
  min = -Infinity,
  max = Infinity
) => {
  if (val < min) {
    return min;
  } else if (val > max) {
    return max;
  } else {
    return val;
  }
};

export const calculateNewCamera = (
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  point: { x: number; y: number },
  dz: number
) => {
  let zoom = util_withMinMax(cameraZ - dz * cameraZ, 0.05, 10);

  const p1 = screenToCanvas(point.x, point.y, cameraX, cameraY, cameraZ);

  const p2 = screenToCanvas(point.x, point.y, cameraX, cameraY, zoom);

  return {
    x: cameraX + (p2.x - p1.x),
    y: cameraY + (p2.y - p1.y),
    z: zoom,
  };
};

export const screenToCanvas = (
  x: number,
  y: number,
  cameraX: number,
  cameraY: number,
  cameraZ: number
) => {
  return { x: x / cameraZ - cameraX, y: y / cameraZ - cameraY };
};

export const canvasToScreen = (
  pos: iPos,
  cameraX: number,
  cameraY: number,
  cameraZ: number
): iPos => {
  return {
    x: (pos.x + cameraX) * cameraZ,
    y: (pos.y + cameraY) * cameraZ,
  };
};

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const checkOverlap = (obj1: Rect, obj2: Rect) => {
  return (
    obj1.x < obj2.x + obj2.width &&
    obj1.x + obj1.width > obj2.x &&
    obj1.y < obj2.y + obj2.height &&
    obj1.y + obj1.height > obj2.y
  );
};

export const checkOverLapPos = (obj: Rect, pos: iPos) => {
  // return true if the point is inside the object
  return (
    obj.x < pos.x &&
    obj.x + obj.width > pos.x &&
    obj.y < pos.y &&
    obj.y + obj.height > pos.y
  );
};

export const getDomElementTransformAsNumbers = (element: HTMLElement) => {
  const transform = element.style.transform;

  // Check if transform property exists and has values
  if (!transform || transform.trim() === "") {
    return [0, 0, 0]; // Or any default values you prefer
  }

  const match = transform.match(/matrix\((.*?)\)/);

  // If matrix format is used, extract values
  if (match) {
    const [scaleX, skewY, skewX, scaleY, transX, transY] = match[1].split(",");
    return [Number(transX), Number(transY), Number(scaleX)]; // Assuming scaleX is z
  } else {
    // If not matrix format, try to split by spaces (fallback for Chrome-like format)
    const chunks = transform.split(" ");
    const [scale, trans1, trans2] = chunks;

    const z = scale ? scale.substring(6, scale.length - 1) : 0; // Handle cases where scale might not exist
    const x = trans1 ? trans1.substring(10, trans1.length - 3) : 0;
    const y = trans2 ? trans2.substring(0, trans2.length - 3) : 0;

    return [Number(x), Number(y), Number(z)];
  }
};

export const _id = () => {
  return Math.random().toString(36).substring(2, 12);
};

/**
 * 
 ideas to increase performance:
 we can get the bottom right bounding box and hold onto it, and then we dont need to work that out every time
 */
export const resizeBottomRightToTopLeft = (
  distanceX: number,
  distanceY: number,
  selectedObjectsWrapperDom: HTMLElement,
  selectedObjectsResizeHandleBRDom: HTMLElement,
  selectedObjectsResizeHandleMRDom: HTMLElement,
  selectedElements: HTMLElement[],
  maintainAspectRatio = true
) => {
  if (!selectedObjectsWrapperDom) {
    return;
  }

  const oldWidth = Number(selectedObjectsWrapperDom.dataset.width);
  const oldHeight = Number(selectedObjectsWrapperDom.dataset.height);
  let newParentWidth = oldWidth + distanceX;
  let newParentHeight = oldHeight + distanceY;

  let widthRatio =
    newParentWidth / Number(selectedObjectsWrapperDom.dataset.width);
  let heightRatio =
    newParentHeight / Number(selectedObjectsWrapperDom.dataset.height);

  let ratio = Math.min(widthRatio, heightRatio);

  if (ratio === Infinity) {
    ratio = 0.01;
  }

  if (maintainAspectRatio) {
    widthRatio = ratio;
    heightRatio = ratio;
  }

  const xList: number[] = [];
  const yList: number[] = [];

  for (let el of selectedElements) {
    const element = el as HTMLElement;

    const x1 =
      Number(selectedObjectsWrapperDom!.dataset.x) - Number(element.dataset.x);
    const x2 = x1 * widthRatio;
    const x3 = x1 - x2;

    const y1 =
      Number(selectedObjectsWrapperDom!.dataset.y) - Number(element.dataset.y);
    const y2 = y1 * heightRatio;
    const y3 = y1 - y2;

    const newX = Number(element.dataset.x) + x3;
    const newY = Number(element.dataset.y) + y3;
    let newWidth = Number(element.dataset.width) * widthRatio;
    let newHeight = Number(element.dataset.height) * heightRatio;

    xList.push(newX + newWidth);
    yList.push(newY + newHeight);

    // if we're editing a svg object, we need to scale the PATH inside it
    // todo something here to do with keeping the scale of the svg object on the dataset?
    if (element.classList.contains(CLASSES.SVG_OBJECT)) {
      const pathElement = element.children[0] as SVGPathElement;
      // todo perf - we could just get this number on the START of the resize
      const originalScale = Number(pathElement.dataset.scale);
      pathElement.style.transform = `scale(${ratio * originalScale})`;
    }

    if (newWidth <= 0) {
      newWidth = 1;
    }
    if (newHeight <= 0) {
      newHeight = 1;
    }

    if (!element.classList.contains(CLASSES.TEXT_OBJECT)) {
      element.style.transform = `translate(${newX}px, ${newY}px)`;
      element.style.width = `${newWidth}px`;
      element.style.height = `${newHeight}px`;
    } else {
      // the scale for the text object is the ratio of the original scale
      // and the new scale
      const originalScale = Number(element.dataset.scale);
      const newRatio = ratio * originalScale;
      element.style.transform = `translate(${newX}px, ${newY}px) scale(${newRatio})`;
      element.dataset.widthB = `${newWidth}`;
      element.dataset.heightB = `${newHeight}`;
    }
  }

  // move the selected objects box...
  const newWidth =
    Math.max(...xList) - Number(selectedObjectsWrapperDom.dataset.x);
  const newHeight =
    Math.max(...yList) - Number(selectedObjectsWrapperDom.dataset.y);

  selectedObjectsWrapperDom.style.width = `${newWidth}px`;
  selectedObjectsWrapperDom.style.height = `${newHeight}px`;

  const rightX =
    Number(selectedObjectsResizeHandleBRDom!.dataset.x) -
    (Number(selectedObjectsWrapperDom.dataset.width) - newWidth);

  const rightY = Number(selectedObjectsWrapperDom.dataset.y) + newHeight;

  selectedObjectsResizeHandleBRDom.style.transform = `translate(${rightX}px, ${rightY}px)`;

  selectedObjectsResizeHandleMRDom.style.transform = `translate(${rightX}px, ${
    rightY - newHeight / 2
  }px)`;
};

export const keepEveryNth = (array: any[], n: number) => {
  const newArray: any[] = [];
  for (let i = 0; i < array.length; i += n) {
    newArray.push(array[i]);
  }
  return newArray;
};

const average = (a: number, b: number) => (a + b) / 2;

export function getSvgPathFromStroke(points: any[], closed = true) {
  const len = points.length;

  if (len < 4) {
    return ``;
  }

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(
    2
  )},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(
    b[1],
    c[1]
  ).toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(
      2
    )} `;
  }

  if (closed) {
    result += "Z";
  }

  return result;
}

export const parseSVGPath = (path: string): iPos[] => {
  // Create an array to hold the coordinates
  const coordinates: iPos[] = [];

  // Regular expression to match the path commands and their parameters
  const regex = /([a-zA-Z])([^a-zA-Z]*)/g;
  let match: RegExpExecArray | null;

  // Process each command in the path
  while ((match = regex.exec(path)) !== null) {
    const command: string = match[1]; // The command character (M, L, C, Q, etc.)
    const params: number[] = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number); // The parameters of the command

    // Process the command based on its type
    switch (command) {
      case "M": // Move to
      case "L": // Line to
      case "T": // Smooth quadratic curve to
        for (let i = 0; i < params.length; i += 2) {
          coordinates.push({ x: params[i], y: params[i + 1] });
        }
        break;

      case "Q": // Quadratic curve to
      case "C": // Cubic Bezier curve to
        for (let i = 0; i < params.length; i += 2) {
          coordinates.push({ x: params[i], y: params[i + 1] });
        }
        break;

      case "Z": // Close path
        // 'Z' doesn't have any parameters, it just closes the path
        break;

      // Add cases for other commands as needed
      default:
        console.warn("Unsupported command:", command);
    }
  }

  return coordinates;
};

export const debug_pointRender = (pos: iPos, duration = 1) => {
  const newdiv = document.createElement("div");
  newdiv.style.position = "absolute";
  newdiv.style.left = `${pos.x}px`;
  newdiv.style.top = `${pos.y}px`;
  newdiv.style.width = "4px";
  newdiv.style.height = "4px";
  newdiv.style.backgroundColor = "red";
  newdiv.style.zIndex = "9999";
  newdiv.style.pointerEvents = "none";
  document.body.appendChild(newdiv);
  animate(newdiv, { opacity: [1, 0] }, { duration }).finished.then(() =>
    newdiv.remove()
  );
};

export const relcalculateTextAreaHeight = (
  textAreaElement: HTMLTextAreaElement
) => {
  textAreaElement.style.height = "auto";
  textAreaElement.style.height = textAreaElement.scrollHeight + "px";
  const scale = Number(textAreaElement.dataset.scale);
  textAreaElement.dataset.height = (
    textAreaElement.scrollHeight * scale
  ).toString();
  textAreaElement.dataset.heightB = (
    textAreaElement.scrollHeight * scale
  ).toString();

  calculateSelectedItemsBoundingBox();
  ui_popoverMenu();
};

export const bringToFront = (
  bringToFrontElements: HTMLElement[],
  allElements: HTMLElement[]
): void => {
  // Create a Set of the elements we want to bring to the front
  let bringToFrontSet = new Set(bringToFrontElements);

  // Get the z-index of all elements and sort them in ascending order
  let zIndexes = allElements.map((el) => ({
    element: el,
    zIndex: parseInt(window.getComputedStyle(el).zIndex) || 0,
  }));

  // Sort elements by their current z-index (lowest to highest)
  zIndexes.sort((a, b) => a.zIndex - b.zIndex);

  // Start re-assigning z-index from 1 for non-bringToFront elements
  let currentZ = 1;
  zIndexes.forEach(({ element }) => {
    if (!bringToFrontSet.has(element)) {
      element.style.zIndex = currentZ.toString();
      currentZ++;
    }
  });

  // Finally, assign the highest z-indexes to bringToFront elements, keeping their relative order
  bringToFrontElements.forEach((el) => {
    el.style.zIndex = currentZ.toString();
    currentZ++;
  });
};

export const sendToBack = (
  sendToBackElements: HTMLElement[],
  allElements: HTMLElement[]
): void => {
  // Create a Set of the elements we want to send to the back
  let sendToBackSet = new Set(sendToBackElements);

  // Get the z-index of all elements and sort them in ascending order
  let zIndexes = allElements.map((el) => ({
    element: el,
    zIndex: parseInt(window.getComputedStyle(el).zIndex) || 0,
  }));

  // Sort elements by their current z-index (lowest to highest)
  zIndexes.sort((a, b) => a.zIndex - b.zIndex);

  // Start re-assigning z-index from 1 for sendToBack elements
  let currentZ = 1;
  sendToBackElements.forEach((el) => {
    el.style.zIndex = currentZ.toString();
    currentZ++;
  });

  // Finally, assign higher z-indexes to non-sendToBack elements, keeping their relative order
  zIndexes.forEach(({ element }) => {
    if (!sendToBackSet.has(element)) {
      element.style.zIndex = currentZ.toString();
      currentZ++;
    }
  });
};

export const storeSelectedElementsOriginalPositions = () => {
  for (let elem of appState.selectedObjects) {
    appState.selectedElementsOriginalPositions[elem.id] = {
      x: Number(elem.dataset.x),
      y: Number(elem.dataset.y),
    };
  }
};
