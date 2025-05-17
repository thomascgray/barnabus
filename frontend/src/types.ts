export interface iPos {
  x: number;
  y: number;
}

export enum eTool {
  cursor = "cursor",
  hand = "hand",
  pencil = "pencil",
  image = "image",
  text = "text",
  measuring = "measuring",
}

export enum ePenTool {
  pen = "pen",
  brush = "brush",
  highlighter = "highlighter",
  square = "square",
  circle = "circle",
}

export enum eMeasuringTool {
  line = "line",
  rectangle = "rectangle",
  circle = "circle",
  cone = "cone",
}

export interface iAppState {
  /**
   * is the left mouse button currently being pressed
   */
  isLeftMouseButtonDown: boolean;
  /**
   * is the middle mouse button currently being pressed
   */
  isMiddleMouseButtonDown: boolean;
  /**
   * is the right mouse button currently being pressed
   */
  isRightMouseButtonDown: boolean;
  /**
   * the x and y of where the cursor was, the _last time_ a mouse down event was fired, relative to the screen (e.g this ignores the camera)
   */
  lastMouseDownScreenPos: iPos;
  /**
   * the x and y of where the cursor was, the last time a mouse down event was fired, relative to the global canvas (e.g this takes the camera into account)
   */
  lastMouseDownCanvasPos: iPos;
  isDraggingSelectionBox: boolean;
  leftClickElementId: string | null;
  selectedElementsOriginalPositions: {
    [key: string]: iPos;
  };
  currentTool: eTool;
  penCurrentTool: ePenTool;
  currentMeasuringTool: eMeasuringTool;
  canvasDrawingTopLeftPoint: iPos;
  canvasDrawingBottomRightPoint: iPos;
  penSize: number;
  selectedObjects: HTMLElement[];
  drawingPoints: number[][];
  isResizingBR: boolean;
  isResizingMR: boolean;
  isTrackpad: boolean | null;

  // measuring
  startMeasuringPoint: iPos | null;
  currentMeasuringPoint: iPos | null;

  /**
   * keeping track of the app-wide z index
   */
  zIndexCounter: number;
  hasMovedItems: boolean;
  isDraggingObjects: boolean;
  lastMouseDownCameraZ: number;
  previousSelectionSelectedObjects: HTMLElement[];
  hasBrokenDampening: boolean;
}

export interface HTMLDivElementWithCustomFuncs extends HTMLDivElement {
  addGrid: () => void;
  removeGrid: () => void;
  increaseGridSize: (size: number) => void;
}

export type RollResult = {
  originalRolls: number[];
  keptRolls: number[];
  total: number;
  highestRoll: number;
  successCount?: number;
  rollType: RollType;
};

export enum RollType {
  Basic = "Basic",
  DropKeep = "Drop/Keep",
  SuccessCount = "Success Count",
  Exploding = "Exploding",
}
