import { nanoid } from "nanoid";
import {
  clearObjects,
  importObject,
  importObjects,
  receiveAddItem,
  removeObjectById,
  rollResults,
  showImagePreview,
  updateObject,
} from "./global.svelte";
import { remember } from "./membership.svelte";
import { toast } from "./toast.svelte";
import * as Types from "../../types";

export const identity = $state<{ id: string; name?: string }>({
  id: nanoid(),
});

export const cmState = $state<{
  socket: WebSocket | null;
  connectionState: "idle" | "connecting" | "connected";
  // Which board this tab is on (one board per socket/tab). Set at connect time.
  boardId: string | null;
  boardName: string | null;
  // Kept so image uploads can re-auth with the same passphrase used to join.
  passphrase: string;
}>({
  socket: null,
  connectionState: "idle",
  boardId: null,
  boardName: null,
  passphrase: "",
});

// What we tried to join, stashed so we can persist the membership once the
// server confirms with joinResponse (never on failure).
let lastJoinAttempt: {
  boardId: string;
  boardName: string;
  passphrase: string;
  username: string;
} | null = null;

// Live "who's on this board" list. Seeded from the joinResponse snapshot, then
// kept in sync by memberJoined/memberLeft. The presence-strip UI (Phase 3)
// renders this; for now it's just tracked.
export const presence = $state<{ members: Types.Member[] }>({
  members: [],
});

// Same-origin WebSocket URL. Works in dev (Vite proxies /ws to the backend) and
// in production (the backend serves both on one port), and rides the reverse
// proxy's TLS automatically (wss when the page is https).
const getWsUrl = (): string => {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
};

// Connect to a board over the same origin and join it. The board picker
// (Landing) supplies the board id, passphrase, and username; the default board
// is open so its passphrase can be empty.
export const connect = async (opts?: {
  boardId?: string;
  boardName?: string;
  passphrase?: string;
  name?: string;
}) => {
  if (cmState.connectionState !== "idle") return;
  const boardId = opts?.boardId ?? "default";
  const boardName = opts?.boardName ?? "Default Board";
  identity.name = opts?.name ?? identity.name ?? "Anonymous";
  cmState.boardId = boardId;
  cmState.boardName = boardName;
  cmState.passphrase = opts?.passphrase ?? "";
  lastJoinAttempt = {
    boardId,
    boardName,
    passphrase: opts?.passphrase ?? "",
    username: identity.name!,
  };
  return openSocket(getWsUrl());
};

// Legacy entry point kept so older callers compile; delegates to connect().
export let tryConnection = async (_url?: string) => {
  return connect();
};

const openSocket = async (wsUrl: string) => {
  cmState.connectionState = "connecting";
  cmState.socket = new WebSocket(wsUrl);

  cmState.socket!.onopen = () => {
    cmState.connectionState = "connected";
    sendMessage({
      type: "join",
      boardId: lastJoinAttempt?.boardId,
      passphrase: lastJoinAttempt?.passphrase,
    });
  };

  cmState.socket!.onclose = () => {
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
      case "joinError":
        onJoinError(data);
        break;
      case "diceRoll":
        const { identity, payload } = JSON.parse(event.data);
        rollResults.unshift(payload);
        break;
      case "addItem":
        receiveAddItem(data.payload.object);
        break;
      case "imagePreview":
        showImagePreview(data.payload);
        break;
      case "alterItem":
        updateObject(data.payload.object, true);
        break;
      case "removeItem":
        removeObjectById(data.payload.id);
        break;
      case "memberJoined":
        if (!presence.members.some((m) => m.id === data.payload.member.id)) {
          presence.members.push(data.payload.member);
        }
        break;
      case "memberLeft":
        presence.members = presence.members.filter((m) => m.id !== data.payload.id);
        break;
      case "ping":
        onPing();
        break;
    }
  };
};

const onJoinResponse = (data: Types.JoinResponsePacket) => {
  presence.members = data.payload.members ?? [];
  importObjects(JSON.stringify(Object.values(data.payload.boardInformation)));
  toast(`Joined ${cmState.boardName ?? "board"}`, "success");
  // The server confirmed the join — only now is it safe to remember this board
  // (so a bad passphrase never gets persisted).
  if (lastJoinAttempt) {
    remember({
      boardId: lastJoinAttempt.boardId,
      name: lastJoinAttempt.boardName,
      passphrase: lastJoinAttempt.passphrase,
      username: lastJoinAttempt.username,
    });
  }
};

const onJoinError = (data: Types.Packet_JoinError) => {
  toast(`Couldn't join board: ${data.reason}`, "error");
  presence.members = [];
  cmState.socket?.close();
  cmState.connectionState = "idle";
  cmState.boardId = null;
  cmState.boardName = null;
};

const onPing = () => {
  sendMessage({ type: "pong" });
};

export let closeConnection = () => {
  sendMessage({ type: "close" });
  cmState.socket?.close();
  cmState.connectionState = "idle";
};

// Leave the current board: disconnect, clear its objects from the DOM, and
// reset presence/board state. Container then falls back to the picker. One
// board per tab, so "switching" is leave + connect again.
export let leaveBoard = () => {
  closeConnection();
  clearObjects();
  presence.members = [];
  cmState.boardId = null;
  cmState.boardName = null;
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
