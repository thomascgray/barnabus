import { nanoid } from "nanoid";
import {
  importObject,
  importObjects,
  rollResults,
  updateObject,
} from "./global.svelte";
import { toast } from "./toast.svelte";
import * as Types from "../../types";

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
    sendMessage({ type: "join" });
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
    const data: Types.Packet = JSON.parse(event.data);
    console.log("%c received a packet", "color: darkblue", data);
    switch (data.type) {
      case "joinResponse":
        onJoinResponse(data);
        break;
      case "diceRoll":
        const { identity, payload } = JSON.parse(event.data);
        rollResults.unshift(payload);
        break;
      case "addItem":
        importObject(data.payload.object);
        break;
      case "alterItem":
        updateObject(data.payload.object, true);
        break;
      case "ping":
        onPing();
        break;
    }
  };
};

const onJoinResponse = (data: Types.JoinResponsePacket) => {
  importObjects(JSON.stringify(Object.values(data.payload.boardInformation)));
};

const onPing = () => {
  sendMessage({ type: "pong" });
};

export let closeConnection = () => {
  sendMessage({ type: "close" });
  cmState.socket?.close();
  cmState.connectionState = "idle";
};

export const sendMessage = (packet: Types.PacketWithoutIdentity) => {
  if (!cmState.socket) return;
  cmState.socket.send(
    JSON.stringify({
      ...packet,
      identity,
    })
  );
};
