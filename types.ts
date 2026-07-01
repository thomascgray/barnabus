// shared types between frontend and backend
export type Packet_Identity = {
  id: string;
  name?: string;
};

export type Packet_Join = {
  type: "join";
  identity: Packet_Identity;
  // Which board to join. Optional for now — the server defaults to the implicit
  // default board when absent (the board-picker UI that sets this lands later).
  boardId?: string;
  // Passphrase for gated boards. Optional: open boards (e.g. the default board,
  // which has no passphrase) ignore it. The per-board username travels on
  // `identity.name`.
  passphrase?: string;
};

// A connected member of a board, used for the presence list. `id` is the
// per-connection nanoid identity; `name` is the per-board username.
export type Member = {
  id: string;
  name: string;
};

// A canvas within a board/room (issue #26). A board holds many canvases, each
// with its own objects; the client switches between them in the boards bar. Only
// the id + display name travel on the wire — ordering is decided server-side and
// canvases arrive already sorted. Structured as its own type so it can grow more
// fields (colour, icon, per-canvas metadata) without touching call sites.
export type Canvas = {
  id: string;
  name: string;
};

export type JoinResponsePacket = {
  type: "joinResponse";
  identity: Packet_Identity;
  payload: {
    // Objects of the *active* canvas only (the one activeCanvasId points at).
    boardInformation: Record<string, Object>;
    // Everyone currently on the board (presence snapshot for the joiner).
    members: Member[];
    // Every canvas in this board/room, in display order, and which one the
    // server put this socket on (its objects are `boardInformation`).
    canvases: Canvas[];
    activeCanvasId: string;
  };
};

// Sent instead of joinResponse when a join is rejected (no such board, or wrong
// passphrase). The client toasts `reason` and returns to the picker.
export type Packet_JoinError = {
  type: "joinError";
  identity: Packet_Identity;
  reason: string;
};

// Presence deltas broadcast to a board's other members as people come and go.
export type Packet_MemberJoined = {
  type: "memberJoined";
  identity: Packet_Identity;
  payload: { member: Member };
};

export type Packet_MemberLeft = {
  type: "memberLeft";
  identity: Packet_Identity;
  payload: { id: string };
};

export type Packet_DiceRoll = {
  type: "diceRoll";
  identity: Packet_Identity;
  payload: any;
};

export type Packet_Ping = {
  type: "ping";
  identity: Packet_Identity;
};

export type Packet_Pong = {
  type: "pong";
  identity: Packet_Identity;
};

export type Packet_ConnectionClosed = {
  type: "close";
  identity: Packet_Identity;
};

export type Packet_AlterItem = {
  type: "alterItem";
  identity: Packet_Identity;
  payload: {
    object: Object;
  };
};

export type Packet_AddItem = {
  type: "addItem";
  identity: Packet_Identity;
  payload: {
    object: Object;
  };
};

export type Packet_RemoveItem = {
  type: "removeItem";
  identity: Packet_Identity;
  payload: {
    id: string;
  };
};

// An ephemeral, broadcast-only packet emitted by the uploader the instant an
// image is added, BEFORE its upload finishes. It carries a tiny blurry
// thumbnail (a small data URL) plus the final geometry so other clients can
// show a placeholder at the right size/position immediately, instead of staring
// at nothing until the upload completes. The relay forwards it to siblings but
// NEVER persists it (like diceRoll) — the real image arrives later as a normal
// addItem with the uploaded URL (and the same id), which replaces the
// placeholder. A failed upload is signalled with a normal removeItem for that id.
export type Packet_ImagePreview = {
  type: "imagePreview";
  identity: Packet_Identity;
  payload: {
    id: string;
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type Object_Image = {
  id: string;
  type: "image";
  width: number;
  height: number;
  src: string;
  x: number;
  y: number;
  isGrid: boolean;
};

export type Object_Text = {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  backgroundColor: string;
  scale: number;
  isBold: boolean;
  isItalic: boolean;
};

export type Object_SVG = {
  id: string;
  type: "svg";
  pathValue: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // Resize scales the inner <path> via a CSS transform (the `d` coordinates
  // never change), so the scale must travel on the wire or remote clients see
  // the stroke at its original size inside a resized, clipping wrapper.
  scale: number;
  // Stroke colour (the <path>'s fill). Must travel on the wire or remote
  // clients / reloads render every stroke in the default colour.
  colour: string;
};

export type Object = Object_Image | Object_Text | Object_SVG;

// --- multi-canvas packets (issue #26) --------------------------------------
// A board/room holds many canvases. One socket views one canvas at a time
// (`socketCanvas` on the server), so object mutations are scoped to the sender's
// active canvas. These packets manage the canvas list and which canvas a socket
// is looking at; the passphrase/room membership stay at the board level, so
// switching canvas needs no re-auth.

// client → server: view a different canvas in the current board. The server
// rebinds this socket and replies with a `canvasState` carrying that canvas's
// objects.
export type Packet_SwitchCanvas = {
  type: "switchCanvas";
  identity: Packet_Identity;
  canvasId: string;
};

// client → server: create a new canvas in the current board. The client mints
// the id (like it mints object ids) so it knows what to switch to immediately;
// the server also moves the creator onto it.
export type Packet_CreateCanvas = {
  type: "createCanvas";
  identity: Packet_Identity;
  canvasId: string;
  name: string;
};

// client → server: rename a canvas.
export type Packet_RenameCanvas = {
  type: "renameCanvas";
  identity: Packet_Identity;
  canvasId: string;
  name: string;
};

// client → server: delete a canvas (the server refuses to delete the first /
// only canvas). Anyone currently viewing it is moved to the first canvas.
export type Packet_DeleteCanvas = {
  type: "deleteCanvas";
  identity: Packet_Identity;
  canvasId: string;
};

// server → client: the objects of the canvas this socket is now viewing. Sent in
// response to switch/create and to force-move a viewer off a deleted canvas. The
// client clears the current objects and imports these.
export type Packet_CanvasState = {
  type: "canvasState";
  identity: Packet_Identity;
  payload: {
    canvasId: string;
    boardInformation: Record<string, Object>;
  };
};

// server → client: broadcast to the whole room whenever the canvas list changes
// (create/rename/delete) so every client's boards bar stays in sync. Does not
// change which canvas a recipient is viewing (that's driven by canvasState).
export type Packet_CanvasList = {
  type: "canvasList";
  identity: Packet_Identity;
  payload: {
    canvases: Canvas[];
  };
};

export type Packet =
  | Packet_Join
  | JoinResponsePacket
  | Packet_JoinError
  | Packet_DiceRoll
  | Packet_ConnectionClosed
  | Packet_AlterItem
  | Packet_Ping
  | Packet_Pong
  | Packet_AddItem
  | Packet_RemoveItem
  | Packet_ImagePreview
  | Packet_MemberJoined
  | Packet_MemberLeft
  | Packet_SwitchCanvas
  | Packet_CreateCanvas
  | Packet_RenameCanvas
  | Packet_DeleteCanvas
  | Packet_CanvasState
  | Packet_CanvasList;

export type PacketWithoutIdentity = {
  [P in Packet["type"]]: Extract<Packet, { type: P }> extends infer T
    ? T extends any
      ? Omit<T, "identity">
      : never
    : never;
}[Packet["type"]];
