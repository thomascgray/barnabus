// shared types between frontend and backend
export type Packet_Identity = {
  id: string;
  name?: string;
};

export type Packet_Join = {
  type: "join";
  identity: Packet_Identity;
};

export type JoinResponsePacket = {
  type: "joinResponse";
  identity: Packet_Identity;
  payload: {
    boardInformation: any;
  };
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
    object: any;
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
};

export type Object = Object_Image | Object_Text | Object_SVG;

export type Packet =
  | Packet_Join
  | JoinResponsePacket
  | Packet_DiceRoll
  | Packet_ConnectionClosed
  | Packet_AlterItem
  | Packet_Ping
  | Packet_Pong
  | Packet_AddItem;

export type PacketWithoutIdentity = {
  [P in Packet["type"]]: Extract<Packet, { type: P }> extends infer T
    ? T extends any
      ? Omit<T, "identity">
      : never
    : never;
}[Packet["type"]];
