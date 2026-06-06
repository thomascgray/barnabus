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

export type JoinResponsePacket = {
  type: "joinResponse";
  identity: Packet_Identity;
  payload: {
    boardInformation: Record<string, Object>;
    // Everyone currently on the board (presence snapshot for the joiner).
    members: Member[];
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
  | Packet_MemberJoined
  | Packet_MemberLeft;

export type PacketWithoutIdentity = {
  [P in Packet["type"]]: Extract<Packet, { type: P }> extends infer T
    ? T extends any
      ? Omit<T, "identity">
      : never
    : never;
}[Packet["type"]];
