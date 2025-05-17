import { appState, dom } from "./global.svelte";

import { CLASSES } from "./config.svelte";
import { storeSelectedElementsOriginalPositions } from "./utils.svelte";

export const performSelectedObjectsChangedUpdate = () => {
  const selectedElements = document.querySelectorAll(
    `.${CLASSES.OBJECT}.selected`
  );
  for (let elem of selectedElements) {
    elem.classList.remove("selected");

    // if the element has a blur method, call it
    // @ts-ignore
    if (elem.blur) {
      // @ts-ignore
      elem.blur();
    }
  }
  for (let elem of appState.selectedObjects) {
    elem.classList.add("selected");
  }

  storeSelectedElementsOriginalPositions();
};

// todo this needs to get split - one to show/hide the menu based on what items are selected, and another to position it
// the show/hide one will be done in mouse down/mouse up events, etc. and the position one when things are moving
export const ui_popoverMenu = () => {
  // and also position the popover menu
  // todo this needs to be totally abstracted, its not being called
  // at the right points right now, etc.

  const selectedObjectsWrapperRect =
    dom.selectedObjectsWrapper.getBoundingClientRect();

  if (selectedObjectsWrapperRect.width <= 0) {
    document.getElementById("popover-menu")!.style.display = "none";
    return;
  }

  dom.popoverMenu.style.display = "flex";
  const popoverMenuRect = dom.popoverMenu.getBoundingClientRect();

  let position = "bottom";
  if (
    position === "top" &&
    selectedObjectsWrapperRect.y - popoverMenuRect.height - 20 < 0
  ) {
    position = "bottom";
  }
  if (
    position === "bottom" &&
    selectedObjectsWrapperRect.y +
      selectedObjectsWrapperRect.height +
      popoverMenuRect.height +
      20 >
      window.innerHeight
  ) {
    position = "top";
  }

  let newX =
    selectedObjectsWrapperRect.x +
    selectedObjectsWrapperRect.width / 2 -
    popoverMenuRect.width / 2;
  let newY = selectedObjectsWrapperRect.y - popoverMenuRect.height;
  switch (position) {
    case "top":
      newX =
        selectedObjectsWrapperRect.x +
        selectedObjectsWrapperRect.width / 2 -
        popoverMenuRect.width / 2;
      newY = selectedObjectsWrapperRect.y - popoverMenuRect.height - 20;
      break;
    case "bottom":
      newX =
        selectedObjectsWrapperRect.x +
        selectedObjectsWrapperRect.width / 2 -
        popoverMenuRect.width / 2;
      newY =
        selectedObjectsWrapperRect.y + selectedObjectsWrapperRect.height + 20;
      break;
  }

  // TODO perf we need to work this out after selection instead of in here, as this runs every mouse move
  const isAllImages = appState.selectedObjects.every((el) =>
    el.classList.contains(CLASSES.IMAGE_OBJECT)
  );
  const isAllText = appState.selectedObjects.every((el) =>
    el.classList.contains(CLASSES.TEXT_OBJECT)
  );

  const isAllLocked = appState.selectedObjects.every(
    (el) => el.dataset.isLocked === "true"
  );

  // datasets
  dom.popoverMenu.dataset.isAllImages = isAllImages ? "true" : "false";
  dom.popoverMenu.dataset.isAllText = isAllText ? "true" : "false";
  dom.popoverMenu.dataset.isAllLocked = isAllLocked ? "true" : "false";

  if (isAllText) {
    // get the font color of all the text objects
    // if they have the SAME font color, use that
    // otherwise, use black
    const fontColor = appState.selectedObjects
      .filter((el) => el.classList.contains(CLASSES.TEXT_OBJECT))
      .map((el) => el.style.color)
      .reduce((prev, curr) => {
        if (prev === curr) {
          return prev;
        } else {
          return "black";
        }
      });
    dom.popoverMenu.style.setProperty("--collective-font-color", fontColor);

    // and do the same for the background color
    const backgroundColor = appState.selectedObjects
      .filter((el) => el.classList.contains(CLASSES.TEXT_OBJECT))
      .map((el) => el.style.backgroundColor)
      .reduce((prev, curr) => {
        if (prev === curr) {
          return prev;
        } else {
          return "white";
        }
      });
    dom.popoverMenu.style.setProperty(
      "--collective-background-color",
      backgroundColor
    );
  }

  // if the position is top
  // and the selected objects wrapper is taller than 50% of the screen
  // then we need to keep it at the top but clamp it to the top of the ceiling
  if (
    position === "top" &&
    selectedObjectsWrapperRect.height > window.innerHeight / 2
  ) {
    newY = Math.max(newY, 0 + 20);
  }

  dom.popoverMenu.style.transform = `translate(${newX}px, ${newY}px)`;
};

export const ui_popoverLockState = () => {};

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
