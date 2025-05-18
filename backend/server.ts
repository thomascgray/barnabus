import { WebSocketServer } from "ws";
var express = require("express");
var cors = require("cors");
var app = express();
import * as Types from "../types";
const fs = require("fs");
const path = require("path");
app.use(cors());

const HTTP_PORT = 5000;
const WS_PORT = 8080;
const PING_INTERVAL = 30000; // 30 seconds between pings
const PING_TIMEOUT = 5000; // 5 seconds to respond to a ping

app.get("/", function (req, res, next) {
  res.json({ msg: "this is a test!" });
});

app.listen(HTTP_PORT, function () {
  console.log(`HTTP server listening on port ${HTTP_PORT}
websocket server listening on port ${WS_PORT}`);
});

const wss = new WebSocketServer({ port: WS_PORT });

const sockets: { [id: string]: WebSocket } = {};
const pendingPings: { [id: string]: NodeJS.Timeout } = {};

type BoardInformation = {
  [id: string]: Types.Object;
};
let boardInformation: BoardInformation = {};

const writeBoardStateToFile = () => {
  // Ensure data directory exists
  const dataDir = path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filePath = path.join(dataDir, "board.json");
  fs.writeFileSync(filePath, JSON.stringify(boardInformation, null, 2));
};

const readBoardStateFromFile = () => {
  const filePath = path.join(__dirname, "data", "board.json");

  // Check if file exists before trying to read it
  if (!fs.existsSync(filePath)) {
    // Return default or empty state if file doesn't exist
    boardInformation = {};
    return;
  }

  try {
    const file = fs.readFileSync(filePath);
    boardInformation = JSON.parse(file.toString());
  } catch (error) {
    console.error(`Error reading board state: ${error.message}`);
    // Handle corrupted files by returning default state
    boardInformation = {};
  }
};

readBoardStateFromFile();

const onJoin = (webSocket: WebSocket, data: Types.Packet_Join) => {
  sockets[data.identity.id] = webSocket as unknown as WebSocket;
  console.log("new client joined:", data.identity.id);
  webSocket.send(
    JSON.stringify({
      type: "joinResponse",
      identity: data.identity,
      payload: {
        boardInformation,
      },
    })
  );
};

const getSiblingSockets = (id: string) => {
  const allSocketIds = Object.keys(sockets);
  console.log("allSocketIds", allSocketIds);
  const siblingIds = Object.keys(sockets).filter((i) => i !== id);
  console.log("siblingIds", siblingIds);
  return siblingIds.map((id) => sockets[id]);
};

const onClose = (webSocket: WebSocket, data: Types.Packet_ConnectionClosed) => {
  console.log("client disconnected:", data.identity.id);
  removeClient(data.identity.id);
};

const onPing = (webSocket: WebSocket, data: Types.Packet_Ping) => {
  // Client sent a ping, respond with the same packet
  webSocket.send(JSON.stringify(data));
};

const onPong = (webSocket: WebSocket, data: Types.Packet_Pong) => {
  // Client responded to our ping, clear the timeout
  if (pendingPings[data.identity.id]) {
    clearTimeout(pendingPings[data.identity.id]);
    delete pendingPings[data.identity.id];
    console.log("received pong from:", data.identity.id);
  }
};

const sendPingToClient = (clientId: string) => {
  const socket = sockets[clientId];
  if (!socket) return;

  console.log("sending ping to:", clientId);

  // Create ping packet
  const pingPacket: Types.Packet_Ping = {
    type: "ping",
    identity: { id: clientId },
  };

  // Send ping to client
  socket.send(JSON.stringify(pingPacket));

  // Set timeout for response
  pendingPings[clientId] = setTimeout(() => {
    console.log("ping timeout for client:", clientId);
    removeClient(clientId);
  }, PING_TIMEOUT);
};

const removeClient = (clientId: string) => {
  // Clean up any pending ping timeout
  if (pendingPings[clientId]) {
    clearTimeout(pendingPings[clientId]);
    delete pendingPings[clientId];
  }

  // Remove from sockets collection
  if (sockets[clientId]) {
    try {
      (sockets[clientId] as WebSocket).close();
    } catch (e) {
      console.error("Error closing socket:", e);
    }
    delete sockets[clientId];
    console.log("client removed:", clientId);
  }
};

const broadcastDiceRoll = (
  senderId: string,
  diceRollData: Types.Packet_DiceRoll
) => {
  // Get all the sockets that AREN'T the sender
  const otherSocketsIds = Object.keys(sockets).filter((id) => id !== senderId);

  otherSocketsIds.forEach((id) => {
    const otherSocket = sockets[id];
    if (otherSocket) {
      otherSocket.send(JSON.stringify(diceRollData));
    }
  });
};

const handleAlterItem = (
  webSocket: WebSocket,
  data: Types.Packet_AlterItem
) => {
  // we need to tell all the siblings which item has changed
  // we also need to change the item in our own server boardstate
  const siblings = getSiblingSockets(data.identity.id);
  siblings.forEach((sibling) => {
    console.log("data", data);
    sibling.send(JSON.stringify(data));
  });

  // update the board state
  boardInformation[data.payload.object.id] = data.payload.object;

  // then write the board state to the file
  writeBoardStateToFile();
};

const handleAddItem = (webSocket: WebSocket, data: Types.Packet_AddItem) => {
  // Broadcast to all clients
  const siblings = getSiblingSockets(data.identity.id);
  siblings.forEach((sibling) => {
    console.log("data", data);
    sibling.send(JSON.stringify(data));
  });
  // update the board state
  boardInformation[data.payload.object.id] = data.payload.object;
  writeBoardStateToFile();
};

// Set up a ping interval to check all clients periodically
setInterval(() => {
  const connectedClients = Object.keys(sockets);
  console.log("Ping check for", connectedClients.length, "clients");

  // DEBUG dont do the ping check

  // Send a ping to each connected client
  connectedClients.forEach((clientId) => {
    // Don't send a ping if we're already waiting for a response
    if (!pendingPings[clientId]) {
      sendPingToClient(clientId);
    } else {
      console.log("already waiting for pong from:", clientId);
    }
  });
}, PING_INTERVAL);

wss.on("connection", function connection(ws) {
  ws.on("message", function message(data: string) {
    try {
      const json: Types.Packet = JSON.parse(data);
      console.log("received packet:", json.type, "from:", json.identity?.id);

      switch (json.type) {
        case "join":
          onJoin(ws as unknown as WebSocket, json);
          break;
        case "ping":
          onPing(ws as unknown as WebSocket, json);
          break;
        case "pong":
          onPong(ws as unknown as WebSocket, json);
          break;
        case "close":
          onClose(ws as unknown as WebSocket, json);
          break;
        case "diceRoll":
          broadcastDiceRoll(json.identity.id, json);
          break;
        case "alterItem":
          handleAlterItem(ws as unknown as WebSocket, json);
          break;
        case "addItem":
          handleAddItem(ws as unknown as WebSocket, json);
          break;
        default:
          console.log("unknown packet type:", json.type);
          break;
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  ws.on("close", () => {
    // Find client ID by socket
    const clientId = Object.keys(sockets).find(
      (id) => sockets[id] === (ws as unknown as WebSocket)
    );

    if (clientId) {
      console.log("client disconnected (socket closed):", clientId);
      removeClient(clientId);
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    // Find client ID by socket
    const clientId = Object.keys(sockets).find(
      (id) => sockets[id] === (ws as unknown as WebSocket)
    );

    if (clientId) {
      console.log("client error:", clientId);
      removeClient(clientId);
    }
  });
});
