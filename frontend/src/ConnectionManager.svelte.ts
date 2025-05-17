import { nanoid } from "nanoid";
import { importObject, importObjects, rollResults } from "./global.svelte";
import { toast } from "./toast.svelte";

type Identity = {
  id: string;
  name?: string;
};

type JoinPacket = {
  type: "join";
  identity: Identity;
};

type AddItemPacket = {
  type: "addItem";
  identity: Identity;
  payload: {
    object: any;
  };
};

type JoinResponsePacket = {
  type: "joinResponse";
  identity: Identity;
  payload: {
    boardInformation: any;
  };
};

type DiceRollPacket = {
  type: "diceRoll";
  identity: Identity;
  payload: any;
};

type ClosePacket = {
  type: "close";
  identity: Identity;
};

type AlterItemPacket = {
  type: "alterItem";
  identity: Identity;
  payload: any;
};

type PingPacket = {
  type: "ping";
  identity: Identity;
};

type Packet =
  | JoinPacket
  | DiceRollPacket
  | ClosePacket
  | AlterItemPacket
  | AddItemPacket
  | JoinResponsePacket;

export const identity = $state({
  id: nanoid(),
});

export const cmState = $state<{
  socket: WebSocket | null;
  connectionState: "idle" | "connecting" | "connected";
}>({
  socket: null,
  connectionState: "idle",
});

export let tryConnection = async (url: string) => {
  cmState.connectionState = "connecting";
  cmState.socket = new WebSocket(`ws://${url}`);

  cmState.socket!.onopen = () => {
    toast("Websocket connected!", "success");
    cmState.connectionState = "connected";
    sendMessage({ type: "join", identity });
  };

  cmState.socket!.onclose = () => {
    toast("Websocket disconnected!", "error");
    cmState.connectionState = "idle";
  };

  cmState.socket.onerror = (e) => {
    console.log("websocket error", e);
    toast(
      "Websocket failed to connect. Double check URL and try again",
      "error"
    );
    cmState.connectionState = "idle";
  };

  cmState.socket.onmessage = (event) => {
    const data: Packet = JSON.parse(event.data);
    console.log("%c received a packet", "color: skyblue", data);
    switch (data.type) {
      case "joinResponse":
        onJoinResponse(data);
        break;
      case "diceRoll":
        const { identity, payload } = JSON.parse(event.data);
        console.log("payload", payload);
        rollResults.unshift(payload);
        break;
      case "addItem":
        importObject(data.payload.object);
        break;
    }
  };
};

const onJoinResponse = (data: JoinResponsePacket) => {
  importObjects(JSON.stringify(data.payload.boardInformation));
};

export let closeConnection = () => {
  sendMessage({ type: "close", identity });
  cmState.socket?.close();
  cmState.connectionState = "idle";
};

export const sendMessage = (packet: Packet) => {
  if (!cmState.socket) return;
  cmState.socket.send(JSON.stringify(packet));
};
