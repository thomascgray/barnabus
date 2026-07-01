// One-time migration: import the legacy backend/data/board.json into the SQLite
// default board. Safe to run repeatedly (upserts). Run with: bun run migrate:json
import * as fs from "fs";
import * as path from "path";
import { config } from "../config";
import { SqliteStorage } from "../storage/SqliteStorage";
import { DEFAULT_BOARD_ID } from "../storage/Storage";
import type * as Types from "../../types";

const jsonPath = path.join(process.cwd(), "data", "board.json");

if (!fs.existsSync(jsonPath)) {
  console.log(`No board.json found at ${jsonPath} — nothing to migrate.`);
  process.exit(0);
}

const board = JSON.parse(fs.readFileSync(jsonPath).toString()) as {
  [id: string]: Types.Object;
};

const store = new SqliteStorage(config.dbPath);
store.ensureBoard(DEFAULT_BOARD_ID, "Default Board");
// Legacy JSON is single-canvas — import everything into the board's first canvas.
const canvas = store.ensureDefaultCanvas(DEFAULT_BOARD_ID);

const objects = Object.values(board);
let migrated = 0;
let skipped = 0;
for (const object of objects) {
  // Legacy board.json files can contain malformed entries (e.g. {} under an
  // "undefined" key). Skip anything without a usable id and type.
  if (!object || !object.id || !object.type) {
    skipped++;
    continue;
  }
  store.upsertObject(DEFAULT_BOARD_ID, canvas.id, object);
  migrated++;
}

console.log(
  `Migrated ${migrated} object(s)` +
    (skipped ? `, skipped ${skipped} malformed` : "") +
    ` from ${jsonPath} into board "${DEFAULT_BOARD_ID}" at ${config.dbPath}`
);
