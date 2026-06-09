// Legacy persistence: a single board kept as a flat { [objectId]: Object } map in
// backend/data/board.json, rewritten on every mutation. This implementation
// preserves the exact on-disk format so swapping it in is a pure refactor with
// no behavior change. It is single-board: the boardId argument is ignored.
import * as fs from "fs";
import * as path from "path";
import type * as Types from "../../types";
import { DEFAULT_BOARD_ID, type BoardMeta, type Storage } from "./Storage";

export class JsonStorage implements Storage {
  private board: { [id: string]: Types.Object } = {};

  constructor(private filePath: string) {
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      this.board = {};
      return;
    }
    try {
      this.board = JSON.parse(fs.readFileSync(this.filePath).toString());
    } catch (error) {
      console.error("Error reading board state:", error);
      this.board = {};
    }
  }

  private persist(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.board, null, 2));
  }

  ensureBoard(): void {
    // Single-board JSON file: nothing to create.
  }

  // JsonStorage is the legacy single-board backend — there is exactly one,
  // always-open board and no passphrase/multi-board support. The board methods
  // exist only to satisfy the interface; SqliteStorage is the real Phase 2
  // implementation.
  private readonly meta: BoardMeta = {
    id: DEFAULT_BOARD_ID,
    name: "Example Board",
    createdBy: "",
    createdAt: 0,
    updatedAt: 0,
  };

  createBoard(): BoardMeta {
    throw new Error("JsonStorage is single-board; createBoard requires SqliteStorage");
  }

  listBoards(): BoardMeta[] {
    return [this.meta];
  }

  getBoard(): BoardMeta {
    return this.meta;
  }

  verifyPassphrase(): boolean {
    return true; // the single legacy board is always open
  }

  deleteBoard(): void {
    this.board = {};
    this.persist();
  }

  getObjects(): Types.Object[] {
    return Object.values(this.board);
  }

  upsertObject(_boardId: string, object: Types.Object): void {
    this.board[object.id] = object;
    this.persist();
  }

  deleteObject(_boardId: string, objectId: string): void {
    delete this.board[objectId];
    this.persist();
  }
}
