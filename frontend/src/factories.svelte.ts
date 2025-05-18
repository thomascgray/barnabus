import * as Utils from "./utils.svelte";
// import { state, dom } from "./global";

// // import { calculateSelectedItemsBoundingBox } from "./main";

// import { CLASSES } from "./consts";
// import { ui_popoverMenu } from "./ui_updaters";
// import {
//   deselectObjects,
//   increaseGridSize,
//   selectObjects,
// } from "./interaction";
import { CLASSES } from "./config.svelte";
import { appState, dom } from "./global.svelte";
import { nanoid } from "nanoid";
import {
  calculateSelectedItemsBoundingBox,
  ui_popoverMenu,
} from "./ui_updaters.svelte";
import { deselectObjects } from "./interactions.svelte";
import type { HTMLDivElementWithCustomFuncs } from "./types";

export function createImageElement(args: {
  id?: string;
  src: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isGrid?: boolean;
}) {
  let { id, src, width, height, x, y, isGrid } = args;
  appState.zIndexCounter++;
  const imageElement = document.createElement(
    "div"
  ) as HTMLDivElementWithCustomFuncs;
  const grid = document.createElement("div");
  // const frontOfImage = document.createElement("div");
  // const backOfImage = document.createElement("div");

  if (id === undefined) {
    id = nanoid(8);
  }

  // do this again,but instead it should be a div object that has the background image as the src
  // might be faster?
  imageElement.id = id;
  imageElement.style.zIndex = `${appState.zIndexCounter}`;
  imageElement.style.display = "block";
  imageElement.classList.add(CLASSES.OBJECT, CLASSES.IMAGE_OBJECT);
  imageElement.draggable = false;
  imageElement.style.width = `${width}px`;
  imageElement.style.height = `${height}px`;
  imageElement.style.top = "0px";
  imageElement.style.left = "0px";
  imageElement.style.position = "absolute";
  imageElement.style.transform = `translate(${x}px, ${y}px)`;
  imageElement.dataset.x = x.toString();
  imageElement.dataset.y = y.toString();
  imageElement.dataset.objtype = "image";
  imageElement.dataset.width = width.toString();
  imageElement.dataset.height = height.toString();
  imageElement.dataset.src = src;
  imageElement.dataset.isLocked = "false";
  imageElement.style.perspective = "2000px";
  imageElement.style.backgroundImage = `url(${src})`;
  imageElement.style.backgroundOrigin = "border-box";
  imageElement.style.backgroundSize = "100% 100%";
  imageElement.style.backgroundRepeat = "no-repeat";

  grid.style.position = "absolute";
  grid.style.top = "0px";
  grid.style.left = "0px";
  grid.style.width = `100%`;
  grid.style.height = `100%`;
  grid.style.pointerEvents = "none";
  grid.style.backgroundImage = `url(/test.svg)`;
  grid.style.backgroundSize = `50px`;

  // this works REALLY nicely...but is slow on chrome :(
  // grid.style.backgroundSize = "40px 40px";
  // grid.style.backgroundImage = `
  //   linear-gradient(to right, #2c3e50 2px, transparent 2px),
  //   linear-gradient(to bottom, #2c3e50 2px, transparent 2px)
  // `;

  imageElement.addGrid = () => {
    imageElement.dataset.isGrid = "true";
    imageElement.dataset.gridSize = "50";
    imageElement.appendChild(grid);
  };

  imageElement.removeGrid = () => {
    imageElement.dataset.isGrid = "false";
    imageElement.dataset.gridSize = "0";
    imageElement.removeChild(grid);
  };

  imageElement.increaseGridSize = (size: number) => {
    const originalSize = Number(imageElement.dataset.gridSize);
    imageElement.dataset.gridSize = (originalSize + size).toString();
    grid.style.backgroundSize = `${originalSize + size}px`;
  };

  document.getElementById("objects")!.appendChild(imageElement);

  if (isGrid) {
    imageElement.addGrid();
  }
  return imageElement;
}

export interface createFreehandSvgElementArgs {
  pathValue: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const createFreehandSvgElement = (
  args: createFreehandSvgElementArgs
) => {
  const { pathValue, x, y, width, height } = args;
  appState.zIndexCounter++;
  const templateSvg = document.getElementById("drawingSvgTemplate")!;
  const svgElement = templateSvg.cloneNode(true) as SVGSVGElement;
  const id = nanoid(8);
  svgElement.id = id;
  svgElement.classList.add(CLASSES.OBJECT, CLASSES.SVG_OBJECT);
  svgElement.style.zIndex = `${appState.zIndexCounter}`;

  const pathElement = svgElement.children[0] as SVGPathElement;
  pathElement.id = id;
  pathElement.style.zIndex = `${appState.zIndexCounter}`;
  pathElement.style.fill = dom?.drawingSvgPath?.style?.fill || "black";
  pathElement.style.stroke = dom?.drawingSvgPath?.style?.stroke || "black";
  pathElement.classList.add(CLASSES.OBJECT, CLASSES.SVG_PATH_OBJECT);
  pathElement.setAttribute("d", pathValue);
  pathElement.dataset.scale = "1";
  pathElement.dataset.isLocked = "false";

  document.getElementById("objects")!.appendChild(svgElement);

  svgElement.style.transform = `translate(${x}px, ${y}px) scale(1)`;

  svgElement.style.width = `${width}px`;
  svgElement.style.height = `${height}px`;
  svgElement.style.transformOrigin = "top left";

  svgElement.dataset.x = x.toString();
  svgElement.dataset.y = y.toString();
  svgElement.dataset.width = `${width}`;
  svgElement.dataset.height = `${height}`;
  svgElement.dataset.objtype = "svg";

  return svgElement;
};

export interface ICreateTextElementArgs {
  text: string;
  x: number;
  y: number;
  shouldAdjustY?: boolean;
  focusOnCreation?: boolean;
  fontSize?: number;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  scale?: number;
  isBold?: boolean;
  isItalic?: boolean;
}

export const createTextElement = (args: ICreateTextElementArgs) => {
  const {
    text,
    x,
    y,
    shouldAdjustY = false,
    focusOnCreation = false,
    fontSize = 24,
    width = 240,
    height = 55,
    color,
    backgroundColor,
    scale = 1,
    isBold = false,
    isItalic = false,
  } = args;

  appState.zIndexCounter++;
  const cameraZ = Number(dom?.camera?.dataset?.z || 1);
  const textAreaElement = document.createElement("textarea");
  let id = nanoid(8);

  textAreaElement.id = id;
  textAreaElement.style.zIndex = `${appState.zIndexCounter}`;
  textAreaElement.style.display = "block";
  textAreaElement.value = `${text.replace(/\\n/g, "\n")}`;
  textAreaElement.style.color = color || "black";
  textAreaElement.style.backgroundColor = backgroundColor || "#eee";
  textAreaElement.style.padding = "0.4em";
  textAreaElement.classList.add("outline-none");
  if (isBold) {
    textAreaElement.classList.add("font-bold");
  }
  if (isItalic) {
    textAreaElement.classList.add("italic");
  }
  textAreaElement.classList.add(
    CLASSES.OBJECT,
    CLASSES.TEXT_OBJECT,
    "placeholder:italic",
    "placeholder:text-slate-400"
  );

  const amountToAdjustY = shouldAdjustY ? 55 / cameraZ / 2 : 0;

  textAreaElement.draggable = false;
  textAreaElement.style.transformOrigin = "top left";
  textAreaElement.style.cursor = "default";
  textAreaElement.style.top = "0px";
  textAreaElement.style.left = "0px";
  textAreaElement.style.position = "absolute";
  textAreaElement.style.transform = `translate(${x}px, ${
    y - amountToAdjustY
  }px) scale(${scale})`;
  textAreaElement.dataset.scale = scale.toString();
  textAreaElement.dataset.isLocked = "false";
  textAreaElement.dataset.x = x.toString();
  textAreaElement.dataset.y = (y - amountToAdjustY).toString();

  const realWidth = width / scale;
  textAreaElement.style.width = `${realWidth}px`;

  textAreaElement.dataset.fontSize = (fontSize / cameraZ).toString();
  textAreaElement.style.fontSize = `${fontSize / cameraZ}px`;

  textAreaElement.style.resize = "none";
  textAreaElement.style.overflowY = "hidden";
  textAreaElement.style.maxWidth = "none";
  textAreaElement.rows = 1;

  textAreaElement.spellcheck = false;
  textAreaElement.placeholder = "Type here...";
  textAreaElement.dataset.objtype = "text";
  textAreaElement.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    textAreaElement.focus();
  };
  setTimeout(() => {
    const realWidth = width / scale;
    textAreaElement.style.width = `${realWidth / cameraZ}px`;
    textAreaElement.dataset.width = (width / cameraZ).toString();
    textAreaElement.dataset.widthB = (width / cameraZ).toString();

    const realHeight = height / scale / cameraZ;

    textAreaElement.style.height = realHeight + "px";
    textAreaElement.dataset.height = height.toString();
    textAreaElement.dataset.heightB = height.toString();

    if (focusOnCreation) {
      // textAreaElement.focus();
      // selectObjects([textAreaElement]);
      // calculateSelectedItemsBoundingBox();
      // ui_popoverMenu();
    }
  });

  textAreaElement.onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      textAreaElement.blur();
      deselectObjects();
    }
  };

  textAreaElement.oninput = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();

    Utils.relcalculateTextAreaHeight(textAreaElement);
    calculateSelectedItemsBoundingBox();
    ui_popoverMenu();
  };

  document.getElementById("objects")!.appendChild(textAreaElement);

  return textAreaElement;
  // todo some stuff here about auto selecting and focusing the text box if you've just made it
};
