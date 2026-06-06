import { WebSocketServer, WebSocket } from "ws";
import * as fs from "fs";
import * as path from "path";
import * as Types from "../types";
import { config } from "./config";
import { SqliteStorage } from "./storage/SqliteStorage";
import { DEFAULT_BOARD_ID, type Storage } from "./storage/Storage";

var express = require("express");
var cors = require("cors");
var app = express();
app.use(cors());

const PING_INTERVAL = 30000; // 30 seconds between pings
const PING_TIMEOUT = 5000; // 5 seconds to respond to a ping

// --- persistence -----------------------------------------------------------
const storage: Storage = new SqliteStorage(config.dbPath);
storage.ensureBoard(DEFAULT_BOARD_ID, "Default Board");

// Phase 0 still runs a single implicit board; the room/board abstraction lands
// in Phase 1. Until then every client operates on DEFAULT_BOARD_ID.
const boardId = DEFAULT_BOARD_ID;

// --- HTTP server (serves the built frontend in production) -----------------
if (fs.existsSync(config.staticDir)) {
  app.use(express.static(config.staticDir));
  // SPA fallback for any non-asset route.
  app.use((_req: any, res: any) => {
    res.sendFile(path.join(config.staticDir, "index.html"));
  });
} else {
  app.get("/", function (_req: any, res: any) {
    res.json({ msg: "barnabus backend (dev) — frontend served by Vite" });
  });
}

const server = app.listen(config.port, function () {
  console.log(
    `barnabus listening on http://localhost:${config.port} (HTTP + WS at /ws)\n` +
      `  db:      ${config.dbPath}\n` +
      `  uploads: ${config.uploadsDir}\n` +
      `  static:  ${fs.existsSync(config.staticDir) ? config.staticDir : "(dev: served by Vite)"}`
  );
});

// --- WebSocket relay (attached to the same HTTP server, one port) ----------
const wss = new WebSocketServer({ server, path: "/ws" });

const sockets: { [id: string]: WebSocket } = {};
const pendingPings: { [id: string]: ReturnType<typeof setTimeout> } = {};

const onJoin = (webSocket: WebSocket, data: Types.Packet_Join) => {
  sockets[data.identity.id] = webSocket;
  console.log("new client joined:", data.identity.id);

  // Reconstruct the legacy { [id]: Object } shape the client expects.
  const objects = storage.getObjects(boardId);
  const boardInformation = Object.fromEntries(objects.map((o) => [o.id, o]));

  webSocket.send(
    JSON.stringify({
      type: "joinResponse",
      identity: data.identity,
      payload: { boardInformation },
    })
  );
};

const getSiblingSockets = (id: string): WebSocket[] => {
  return Object.keys(sockets)
    .filter((i) => i !== id)
    .map((i) => sockets[i]);
};

const onPing = (webSocket: WebSocket, data: Types.Packet_Ping) => {
  // Client sent a ping, echo it back.
  webSocket.send(JSON.stringify(data));
};

const onPong = (_webSocket: WebSocket, data: Types.Packet_Pong) => {
  // Client responded to our ping, clear the timeout.
  if (pendingPings[data.identity.id]) {
    clearTimeout(pendingPings[data.identity.id]);
    delete pendingPings[data.identity.id];
    console.log("received pong from:", data.identity.id);
  }
};

const onClose = (_webSocket: WebSocket, data: Types.Packet_ConnectionClosed) => {
  console.log("client disconnected:", data.identity.id);
  removeClient(data.identity.id);
};

const sendPingToClient = (clientId: string) => {
  const socket = sockets[clientId];
  if (!socket) return;

  const pingPacket: Types.Packet_Ping = {
    type: "ping",
    identity: { id: clientId },
  };
  socket.send(JSON.stringify(pingPacket));

  pendingPings[clientId] = setTimeout(() => {
    console.log("ping timeout for client:", clientId);
    removeClient(clientId);
  }, PING_TIMEOUT);
};

const removeClient = (clientId: string) => {
  if (pendingPings[clientId]) {
    clearTimeout(pendingPings[clientId]);
    delete pendingPings[clientId];
  }
  if (sockets[clientId]) {
    try {
      sockets[clientId].close();
    } catch (e) {
      console.error("Error closing socket:", e);
    }
    delete sockets[clientId];
    console.log("client removed:", clientId);
  }
};

const broadcastToSiblings = (senderId: string, data: Types.Packet) => {
  getSiblingSockets(senderId).forEach((sibling) => sibling.send(JSON.stringify(data)));
};

const handleAlterItem = (_webSocket: WebSocket, data: Types.Packet_AlterItem) => {
  broadcastToSiblings(data.identity.id, data);
  storage.upsertObject(boardId, data.payload.object);
};

const handleAddItem = (_webSocket: WebSocket, data: Types.Packet_AddItem) => {
  broadcastToSiblings(data.identity.id, data);
  storage.upsertObject(boardId, data.payload.object);
};

// Periodically ping clients and drop ones that don't pong in time.
setInterval(() => {
  Object.keys(sockets).forEach((clientId) => {
    if (!pendingPings[clientId]) {
      sendPingToClient(clientId);
    }
  });
}, PING_INTERVAL);

wss.on("connection", function connection(ws: WebSocket) {
  ws.on("message", function message(raw: Buffer | string) {
    try {
      const json: Types.Packet = JSON.parse(raw.toString());
      console.log("received packet:", json.type, "from:", json.identity?.id);

      switch (json.type) {
        case "join":
          onJoin(ws, json);
          break;
        case "ping":
          onPing(ws, json);
          break;
        case "pong":
          onPong(ws, json);
          break;
        case "close":
          onClose(ws, json);
          break;
        case "diceRoll":
          broadcastToSiblings(json.identity.id, json);
          break;
        case "alterItem":
          handleAlterItem(ws, json);
          break;
        case "addItem":
          handleAddItem(ws, json);
          break;
        default:
          console.log("unknown packet type:", (json as any).type);
          break;
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  const cleanup = () => {
    const clientId = Object.keys(sockets).find((id) => sockets[id] === ws);
    if (clientId) removeClient(clientId);
  };

  ws.on("close", cleanup);
  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    cleanup();
  });
});
