import { WebSocketServer, WebSocket } from "ws";
import * as fs from "fs";
import * as path from "path";
import * as Types from "../types";
import { config } from "./config";
import { SqliteStorage } from "./storage/SqliteStorage";
import { DEFAULT_BOARD_ID, type Storage } from "./storage/Storage";
import { FsBlobStore, type BlobStore } from "./storage/BlobStore";

var express = require("express");
var cors = require("cors");
var app = express();
app.use(cors());
app.use(express.json());

const PING_INTERVAL = 30000; // 30 seconds between pings
const PING_TIMEOUT = 5000; // 5 seconds to respond to a ping

// --- persistence -----------------------------------------------------------
const storage: Storage = new SqliteStorage(config.dbPath);
// The built-in board is an *example* of how the app works on a fresh install,
// not a "default" the admin is forced to keep. It's open (no passphrase) and
// seeded with a little welcome content the first time it's created.
storage.ensureBoard(DEFAULT_BOARD_ID, "Example Board");
seedExampleBoard();

// Uploaded image bytes live on the filesystem, not in SQLite.
const blobStore: BlobStore = new FsBlobStore(config.uploadsDir);

// Seed the example board with a little welcome content, but only the first time
// (when it has no objects yet). This makes a fresh install land on something
// that demonstrates the app instead of a blank canvas. If an admin clears it,
// we don't keep re-adding the notes.
function seedExampleBoard(): void {
  if (storage.getObjects(DEFAULT_BOARD_ID).length > 0) return;

  const note = (
    id: string,
    text: string,
    x: number,
    y: number,
    opts: Partial<Types.Object_Text> = {}
  ): Types.Object_Text => ({
    id,
    type: "text",
    text,
    x,
    y,
    width: 360,
    height: 60,
    fontSize: 24,
    color: "#0f172a",
    backgroundColor: "#fef9c3",
    scale: 1,
    isBold: false,
    isItalic: false,
    ...opts,
  });

  // Sizes are in canvas pixels and intentionally generous so the wrapped text
  // isn't clipped (text objects render at their stored height on import).
  const notes: Types.Object_Text[] = [
    note("example-welcome", "👋 Welcome to Barnabus!", 120, 120, {
      fontSize: 40,
      isBold: true,
      backgroundColor: "#bfdbfe",
      width: 640,
      height: 80,
    }),
    note(
      "example-pan-zoom",
      "Drag the background to pan, scroll to zoom — the canvas is infinite.",
      120,
      250,
      { width: 540, height: 100 }
    ),
    note(
      "example-tools",
      "Use the toolbar to add text, draw, drop images (just paste!), and roll dice.",
      120,
      390,
      { width: 540, height: 100 }
    ),
    note(
      "example-share",
      "Admins create their own boards from the Admin panel and share a join link. This example board is yours to scribble on.",
      120,
      530,
      { width: 540, height: 140 }
    ),
  ];

  for (const n of notes) storage.upsertObject(DEFAULT_BOARD_ID, n);
  console.log(`seeded example board with ${notes.length} welcome notes`);
}

// Serve uploaded images as static files. Content-addressed names never change,
// so they're safe to cache aggressively.
app.use(
  "/uploads",
  express.static(config.uploadsDir, {
    immutable: true,
    maxAge: "1y",
  })
);

// --- HTTP API (admin + public board lookup) --------------------------------
// Gate the admin routes on a shared bearer secret. The check lives behind this
// one middleware so a real admin-accounts table can replace it later without
// touching the routes (issue per-account tokens instead of one env secret).
const requireAdmin = (req: any, res: any, next: any) => {
  if (!config.adminSecret) {
    return res.status(503).json({ error: "admin not configured (set BARNABUS_ADMIN_SECRET)" });
  }
  const auth = String(req.headers["authorization"] ?? "");
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (token !== config.adminSecret) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
};

// Create a board with an optional passphrase; returns its id + a join link.
app.post("/api/admin/boards", requireAdmin, (req: any, res: any) => {
  const { name, passphrase, createdBy } = req.body ?? {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }
  const board = storage.createBoard({
    name,
    passphrase: typeof passphrase === "string" ? passphrase : "",
    createdBy: typeof createdBy === "string" ? createdBy : "",
  });
  const joinUrl = `${req.protocol}://${req.get("host")}/?board=${board.id}`;
  res.json({ id: board.id, name: board.name, createdBy: board.createdBy, joinUrl });
});

// List boards (metadata only — never passphrase hashes).
app.get("/api/admin/boards", requireAdmin, (_req: any, res: any) => {
  res.json(storage.listBoards());
});

// Delete a board and (via FK cascade) its objects, plus its uploaded images.
app.delete("/api/admin/boards/:id", requireAdmin, (req: any, res: any) => {
  storage.deleteBoard(req.params.id);
  blobStore.deleteBoard(req.params.id);
  res.json({ ok: true });
});

// Public, non-secret lookup so the join screen can show the board name before
// the passphrase is entered. 404 if no such board; never leaks the hash.
app.get("/api/boards/:id", (req: any, res: any) => {
  const board = storage.getBoard(req.params.id);
  if (!board) return res.status(404).json({ error: "not found" });
  res.json({ id: board.id, name: board.name, createdBy: board.createdBy });
});

// WebP magic bytes: "RIFF"...."WEBP".
const isWebp = (buf: Buffer): boolean =>
  buf.length > 12 &&
  buf.toString("ascii", 0, 4) === "RIFF" &&
  buf.toString("ascii", 8, 12) === "WEBP";

// Image upload. Auth reuses the board passphrase (same check as join), sent as a
// header. Body is the raw WebP bytes (conversion happens client-side). Stored
// content-addressed and board-scoped; returns a same-origin URL for Object_Image.src.
app.post(
  "/api/boards/:id/images",
  express.raw({ type: "image/webp", limit: `${config.maxUploadMb}mb` }),
  (req: any, res: any) => {
    const boardId = req.params.id;
    const passphrase = String(req.headers["x-board-passphrase"] ?? "");
    if (!storage.verifyPassphrase(boardId, passphrase)) {
      return res.status(403).json({ error: "bad board or passphrase" });
    }

    const bytes: Buffer = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      return res.status(400).json({ error: "empty body" });
    }
    if (!isWebp(bytes)) {
      return res.status(415).json({ error: "only webp uploads are accepted" });
    }

    const { url } = blobStore.put(boardId, bytes);
    res.json({ url });
  }
);

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
// Which board each connected client is bound to (set at join). One socket = one
// board, so broadcasts and persistence are scoped by this map.
const socketBoard: { [id: string]: string } = {};
// Per-connection presence info (the username supplied at join). Ephemeral —
// presence lives only here, never in SQLite.
const socketMember: { [id: string]: Types.Member } = {};
const pendingPings: { [id: string]: ReturnType<typeof setTimeout> } = {};

// All members currently on a board (presence snapshot).
const getMembersInRoom = (boardId: string): Types.Member[] =>
  Object.keys(socketBoard)
    .filter((i) => socketBoard[i] === boardId && socketMember[i])
    .map((i) => socketMember[i]);

const onJoin = (webSocket: WebSocket, data: Types.Packet_Join) => {
  const boardId = data.boardId ?? DEFAULT_BOARD_ID;

  // Gate the join: the board must exist and the passphrase must match. We no
  // longer auto-create boards on join — only the default board (ensured at
  // startup) and admin-created boards exist.
  const board = storage.getBoard(boardId);
  if (!board) {
    return sendJoinError(webSocket, data.identity, "No such board");
  }
  if (!storage.verifyPassphrase(boardId, data.passphrase ?? "")) {
    return sendJoinError(webSocket, data.identity, "Incorrect passphrase");
  }

  const member: Types.Member = {
    id: data.identity.id,
    name: data.identity.name ?? "Anonymous",
  };
  sockets[data.identity.id] = webSocket;
  socketBoard[data.identity.id] = boardId;
  socketMember[data.identity.id] = member;
  console.log("client joined:", data.identity.id, "board:", boardId, "as:", member.name);

  // Reconstruct the legacy { [id]: Object } shape the client expects.
  const objects = storage.getObjects(boardId);
  const boardInformation = Object.fromEntries(objects.map((o) => [o.id, o]));

  webSocket.send(
    JSON.stringify({
      type: "joinResponse",
      identity: data.identity,
      payload: { boardInformation, members: getMembersInRoom(boardId) },
    } satisfies Types.JoinResponsePacket)
  );

  // Tell the rest of the room someone arrived.
  broadcastToSiblings(data.identity.id, {
    type: "memberJoined",
    identity: data.identity,
    payload: { member },
  });
};

const sendJoinError = (
  webSocket: WebSocket,
  identity: Types.Packet_Identity,
  reason: string
) => {
  console.log("join rejected for", identity.id, "-", reason);
  webSocket.send(
    JSON.stringify({ type: "joinError", identity, reason } satisfies Types.Packet_JoinError)
  );
};

// Other sockets in a board (optionally excluding one id). The single primitive
// behind every room-scoped broadcast.
const socketsInRoom = (boardId: string, exceptId?: string): WebSocket[] =>
  Object.keys(sockets)
    .filter((i) => socketBoard[i] === boardId && i !== exceptId)
    .map((i) => sockets[i]);

// Siblings = other clients bound to the same board as `id`. This is what scopes
// every broadcast (addItem/alterItem/removeItem/diceRoll) to a single room.
const getSiblingSockets = (id: string): WebSocket[] =>
  socketsInRoom(socketBoard[id], id);

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
    const room = socketBoard[clientId];
    try {
      sockets[clientId].close();
    } catch (e) {
      console.error("Error closing socket:", e);
    }
    delete sockets[clientId];
    delete socketBoard[clientId];
    delete socketMember[clientId];
    console.log("client removed:", clientId);

    // Tell the remaining members of that room someone left.
    if (room) {
      const packet: Types.Packet_MemberLeft = {
        type: "memberLeft",
        identity: { id: clientId },
        payload: { id: clientId },
      };
      socketsInRoom(room).forEach((s) => s.send(JSON.stringify(packet)));
    }
  }
};

const broadcastToSiblings = (senderId: string, data: Types.Packet) => {
  getSiblingSockets(senderId).forEach((sibling) => sibling.send(JSON.stringify(data)));
};

const handleAlterItem = (_webSocket: WebSocket, data: Types.Packet_AlterItem) => {
  broadcastToSiblings(data.identity.id, data);
  storage.upsertObject(socketBoard[data.identity.id], data.payload.object);
};

const handleAddItem = (_webSocket: WebSocket, data: Types.Packet_AddItem) => {
  broadcastToSiblings(data.identity.id, data);
  storage.upsertObject(socketBoard[data.identity.id], data.payload.object);
};

const handleRemoveItem = (_webSocket: WebSocket, data: Types.Packet_RemoveItem) => {
  broadcastToSiblings(data.identity.id, data);
  storage.deleteObject(socketBoard[data.identity.id], data.payload.id);
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
        case "imagePreview":
          // Broadcast-only, like diceRoll: a transient blurry placeholder shown
          // while the uploader's image is in flight. Never persisted — the real
          // image follows as an addItem.
          broadcastToSiblings(json.identity.id, json);
          break;
        case "alterItem":
          handleAlterItem(ws, json);
          break;
        case "addItem":
          handleAddItem(ws, json);
          break;
        case "removeItem":
          handleRemoveItem(ws, json);
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
