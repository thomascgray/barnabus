import { nanoid } from "nanoid";
import {
  importObject,
  importObjects,
  removeObjectById,
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

// Same-origin WebSocket URL. Works in dev (Vite proxies /ws to the backend) and
// in production (the backend serves both on one port), and rides the reverse
// proxy's TLS automatically (wss when the page is https).
const getWsUrl = (): string => {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
};

// Connect to the backend over the same origin. Phase 0 connects implicitly to
// the single default board; the board picker (Phase 3) will replace this.
export const connect = async () => {
  if (cmState.connectionState !== "idle") return;
  return openSocket(getWsUrl());
};

// Legacy entry point (the commented-out Landing screen). Kept so it still
// compiles; the host argument is ignored in favor of the same-origin URL.
export let tryConnection = async (_url?: string) => {
  return openSocket(getWsUrl());
};

const openSocket = async (wsUrl: string) => {
  cmState.connectionState = "connecting";
  cmState.socket = new WebSocket(wsUrl);

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
      case "removeItem":
        removeObjectById(data.payload.id);
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
